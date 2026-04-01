import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { generatePost, generatePostImage, pickContentType } from "./services/contentEngine";
import type { ContentFormat, ContentSourceInfo } from "./services/contentEngine";
import { MAX_BRANDS } from "@shared/types";
import { validateShopifyConnection, fetchShopifyProducts, transformShopifyProduct, fetchShopifyCollections } from "./services/shopify";

// ── Brand Router ───────────────────────────────────────────────────────────

const brandRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin") {
      return db.getAllBrands();
    }
    return db.getBrandsByClientUserId(ctx.user.id);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const brand = await db.getBrandById(input.id);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
      if (ctx.user.role !== "admin" && brand.clientUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return brand;
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
      logoUrl: z.string().optional(),
      industry: z.string().optional(),
      location: z.string().optional(),
      website: z.string().optional(),
      clientTier: z.enum(["managed", "premium"]).default("managed"),
      clientUserId: z.number().optional(),
      voiceSettings: z.object({
        tone: z.string(),
        style: z.string(),
        keywords: z.array(z.string()),
        avoidWords: z.array(z.string()),
        samplePosts: z.array(z.string()),
        customInstructions: z.string(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const count = await db.getBrandCount();
      if (count >= MAX_BRANDS) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Maximum of ${MAX_BRANDS} brands reached` });
      }
      const existing = await db.getBrandBySlug(input.slug);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Brand slug already exists" });
      return db.createBrand(input as any);
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(200).optional(),
      logoUrl: z.string().optional(),
      industry: z.string().optional(),
      location: z.string().optional(),
      website: z.string().optional(),
      clientTier: z.enum(["managed", "premium"]).optional(),
      autoPostEnabled: z.boolean().optional(),
      clientUserId: z.number().nullable().optional(),
      isActive: z.boolean().optional(),
      voiceSettings: z.object({
        tone: z.string(),
        style: z.string(),
        keywords: z.array(z.string()),
        avoidWords: z.array(z.string()),
        samplePosts: z.array(z.string()),
        customInstructions: z.string(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateBrand(id, data as any);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteBrand(input.id);
      return { success: true };
    }),

  toggleAutoPost: protectedProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const brand = await db.getBrandById(input.id);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND" });
      // Only admin or premium clients can toggle auto-post
      if (ctx.user.role !== "admin") {
        if (brand.clientUserId !== ctx.user.id || brand.clientTier !== "premium") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only premium clients can toggle auto-post" });
        }
      }
      await db.updateBrand(input.id, { autoPostEnabled: input.enabled });
      return { success: true };
    }),
});

// ── Post Router ────────────────────────────────────────────────────────────

const postRouter = router({
  list: protectedProcedure
    .input(z.object({
      brandId: z.number().optional(),
      status: z.string().optional(),
      limit: z.number().default(100),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === "admin") {
        if (input.status) return db.getPostsByStatus(input.status, input.brandId);
        return db.getAllPosts(input.limit, input.brandId);
      }
      // Client: only see their brand's posts
      const brands = await db.getBrandsByClientUserId(ctx.user.id);
      const brandIds = brands.map(b => b.id);
      if (input.brandId && !brandIds.includes(input.brandId)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const targetBrandId = input.brandId || brandIds[0];
      if (!targetBrandId) return [];
      if (input.status) return db.getPostsByStatus(input.status, targetBrandId);
      return db.getPostsByBrandId(targetBrandId, input.limit);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const post = await db.getPostById(input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === post.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return post;
    }),

  create: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      content: z.string().min(1),
      imageUrl: z.string().optional(),
      contentType: z.enum(["hey_tony", "hook_solve", "auditor_showcase", "local_tips", "machine_series", "print_digital", "shopify_product", "service_spotlight", "custom"]).default("custom"),
      scheduledAt: z.string().optional(),
      status: z.enum(["draft", "scheduled", "pending_review"]).default("draft"),
      platforms: z.array(z.string()).optional(),
      aiGenerated: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brand = await db.getBrandById(input.brandId);
        if (!brand || brand.clientUserId !== ctx.user.id || brand.clientTier !== "premium") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admin or premium clients can create posts" });
        }
      }
      return db.createPost({
        ...input,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        platforms: input.platforms || ["facebook"],
        createdBy: ctx.user.id,
        lastEditedBy: ctx.user.id,
      } as any);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      content: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      contentType: z.enum(["hey_tony", "hook_solve", "auditor_showcase", "local_tips", "machine_series", "print_digital", "shopify_product", "service_spotlight", "custom"]).optional(),
      scheduledAt: z.string().nullable().optional(),
      status: z.enum(["draft", "scheduled", "pending_review", "approved", "published", "failed", "paused"]).optional(),
      platforms: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const post = await db.getPostById(input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.user.role !== "admin") {
        const brand = await db.getBrandById(post.brandId);
        if (!brand || brand.clientUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Managed clients can only pause
        if (brand.clientTier === "managed") {
          if (input.status && input.status !== "paused") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Managed clients can only pause posts" });
          }
          // Managed clients cannot edit content
          if (input.content || input.imageUrl !== undefined) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Managed clients cannot edit post content" });
          }
        }
      }

      const { id, scheduledAt, ...rest } = input;
      const updateData: any = { ...rest, lastEditedBy: ctx.user.id };
      if (scheduledAt !== undefined) {
        updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      }
      await db.updatePost(id, updateData);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deletePost(input.id);
      return { success: true };
    }),

  // Approve or reject a post (premium client or admin)
  review: protectedProcedure
    .input(z.object({
      id: z.number(),
      action: z.enum(["approve", "reject"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const post = await db.getPostById(input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.user.role !== "admin") {
        const brand = await db.getBrandById(post.brandId);
        if (!brand || brand.clientUserId !== ctx.user.id || brand.clientTier !== "premium") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }

      const newStatus = input.action === "approve" ? "approved" : "draft";
      await db.updatePost(input.id, { status: newStatus as any });

      // Create notification for admin
      if (ctx.user.role !== "admin") {
        await db.createNotification({
          brandId: post.brandId,
          postId: post.id,
          type: input.action === "approve" ? "approval" : "rejection",
          title: `Post ${input.action === "approve" ? "approved" : "rejected"} by client`,
          message: `Post #${post.id} has been ${input.action === "approve" ? "approved" : "rejected"}.`,
          fromUserId: ctx.user.id,
          toRole: "admin",
        });
      }

      return { success: true };
    }),

  stats: protectedProcedure
    .input(z.object({ brandId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && input.brandId) {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return db.getPostStats(input.brandId);
    }),

  calendar: protectedProcedure
    .input(z.object({
      brandId: z.number().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && input.brandId) {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      const from = input.from ? new Date(input.from) : undefined;
      const to = input.to ? new Date(input.to) : undefined;
      return db.getScheduledPosts(from, to, input.brandId);
    }),
});

// ── AI Content Router ──────────────────────────────────────────────────────

const aiRouter = router({
  generatePost: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      contentType: z.enum(["hey_tony", "hook_solve", "auditor_showcase", "local_tips", "machine_series", "print_digital", "shopify_product", "service_spotlight", "custom"]).default("custom"),
      customTopic: z.string().optional(),
      useContentSources: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify brand access
      const brand = await db.getBrandById(input.brandId);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
      if (ctx.user.role !== "admin" && brand.clientUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Build content source info
      let sourceInfo: ContentSourceInfo | undefined;
      if (input.useContentSources) {
        const shopifyConn = await db.getShopifyConnectionByBrandId(input.brandId);
        const servicesData = await db.getServicesByBrandId(input.brandId);
        const hasShopify = !!shopifyConn?.isConnected;
        const hasServices = servicesData.length > 0;

        sourceInfo = { hasShopify, hasServices };

        if (hasShopify) {
          const product = await db.getShopifyProductForContent(input.brandId);
          if (product) {
            sourceInfo.shopifyProduct = {
              title: product.title,
              description: product.description,
              price: product.price,
              compareAtPrice: product.compareAtPrice,
              productType: product.productType,
              tags: (product.tags as string[]) || [],
              imageUrl: product.imageUrl,
              collections: (product.collections as string[]) || [],
              handle: product.handle,
            };
          }
        }

        if (hasServices) {
          const service = await db.getServiceForContent(input.brandId);
          if (service) {
            sourceInfo.service = {
              name: service.name,
              description: service.description,
              serviceAreas: (service.serviceAreas as string[]) || [],
              specials: service.specials,
              ctaType: service.ctaType,
              ctaText: service.ctaText,
              ctaLink: service.ctaLink,
              ctaPhone: service.ctaPhone,
              images: (service.images as string[]) || [],
            };
          }
        }
      }

      const result = await generatePost(
        brand.name,
        input.contentType as ContentFormat,
        brand.voiceSettings as any,
        input.customTopic,
        sourceInfo
      );

      // Mark the used content source as used for rotation tracking
      if (result.contentType === "shopify_product" && sourceInfo?.shopifyProduct) {
        const product = await db.getShopifyProductForContent(input.brandId);
        if (product) await db.markShopifyProductUsed(product.id);
      }
      if (result.contentType === "service_spotlight" && sourceInfo?.service) {
        const service = await db.getServiceForContent(input.brandId);
        if (service) await db.markServiceUsed(service.id);
      }

      return result;
    }),

  generateImage: protectedProcedure
    .input(z.object({ prompt: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const imageUrl = await generatePostImage(input.prompt);
      return { imageUrl };
    }),
});

// ── Notification Router ────────────────────────────────────────────────────

const notificationRouter = router({
  list: protectedProcedure
    .input(z.object({
      brandId: z.number().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const role = ctx.user.role === "admin" ? "admin" : "client";
      return db.getNotifications(role as any, input.brandId, input.limit);
    }),

  unreadCount: protectedProcedure
    .input(z.object({ brandId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const role = ctx.user.role === "admin" ? "admin" : "client";
      return db.getUnreadNotificationCount(role as any, input.brandId);
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.markNotificationRead(input.id);
      return { success: true };
    }),

  markAllRead: protectedProcedure
    .input(z.object({ brandId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const role = ctx.user.role === "admin" ? "admin" : "client";
      await db.markAllNotificationsRead(role as any, input.brandId);
      return { success: true };
    }),

  // Client requests (pause, edit request)
  requestPause: protectedProcedure
    .input(z.object({ postId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const post = await db.getPostById(input.postId);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });

      // Pause the post
      await db.updatePost(input.postId, { status: "paused" as any });

      // Notify admin
      await db.createNotification({
        brandId: post.brandId,
        postId: post.id,
        type: "pause_request",
        title: "Client paused a scheduled post",
        message: input.reason || `Post #${post.id} was paused by client.`,
        fromUserId: ctx.user.id,
        toRole: "admin",
      });

      return { success: true };
    }),

  requestEdit: protectedProcedure
    .input(z.object({ postId: z.number(), notes: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const post = await db.getPostById(input.postId);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });

      // Notify admin
      await db.createNotification({
        brandId: post.brandId,
        postId: post.id,
        type: "edit_request",
        title: "Client requested an edit",
        message: input.notes,
        fromUserId: ctx.user.id,
        toRole: "admin",
      });

      return { success: true };
    }),
});

// ── Social Account Router ──────────────────────────────────────────────────

const socialRouter = router({
  listByBrand: protectedProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      const accounts = await db.getSocialAccountsByBrandId(input.brandId);
      // Mask access tokens for security
      return accounts.map(a => ({
        ...a,
        accessToken: a.accessToken ? "••••••••" : null,
      }));
    }),

  connect: adminProcedure
    .input(z.object({
      brandId: z.number(),
      platform: z.enum(["facebook", "instagram"]),
      platformAccountId: z.string(),
      accountName: z.string().optional(),
      accessToken: z.string(),
      pageId: z.string().optional(),
      instagramBusinessId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return db.createSocialAccount(input as any);
    }),

  disconnect: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteSocialAccount(input.id);
      return { success: true };
    }),
});

// ── Analytics Router ───────────────────────────────────────────────────────

const analyticsRouter = router({
  summary: protectedProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return db.getAnalyticsSummary(input.brandId);
    }),

  timeline: protectedProcedure
    .input(z.object({ brandId: z.number(), days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return db.getAnalyticsByBrand(input.brandId, input.days);
    }),
});

// ── Shopify Router ────────────────────────────────────────────────────────

const shopifyRouter = router({
  getConnection: protectedProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      const conn = await db.getShopifyConnectionByBrandId(input.brandId);
      if (!conn) return null;
      return { ...conn, accessToken: "••••••••" };
    }),

  connect: adminProcedure
    .input(z.object({
      brandId: z.number(),
      shopDomain: z.string().min(1),
      accessToken: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      // Normalize domain
      let domain = input.shopDomain.trim();
      if (!domain.includes(".")) domain = `${domain}.myshopify.com`;
      domain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

      // Validate connection
      const validation = await validateShopifyConnection(domain, input.accessToken);
      if (!validation.valid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: validation.error || "Invalid Shopify credentials" });
      }

      // Check if already connected
      const existing = await db.getShopifyConnectionByBrandId(input.brandId);
      if (existing) {
        await db.updateShopifyConnection(existing.id, {
          shopDomain: domain,
          accessToken: input.accessToken,
          storeName: validation.shopName || null,
          isConnected: true,
        });
        return { id: existing.id, storeName: validation.shopName };
      }

      const result = await db.createShopifyConnection({
        brandId: input.brandId,
        shopDomain: domain,
        accessToken: input.accessToken,
        storeName: validation.shopName || null,
      });
      return { id: result.id, storeName: validation.shopName };
    }),

  disconnect: adminProcedure
    .input(z.object({ brandId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteShopifyConnection(input.brandId);
      return { success: true };
    }),

  syncProducts: adminProcedure
    .input(z.object({ brandId: z.number() }))
    .mutation(async ({ input }) => {
      const conn = await db.getShopifyConnectionByBrandId(input.brandId);
      if (!conn || !conn.isConnected) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active Shopify connection" });
      }

      // Fetch products and collections
      const [products, collections] = await Promise.all([
        fetchShopifyProducts(conn.shopDomain, conn.accessToken),
        fetchShopifyCollections(conn.shopDomain, conn.accessToken),
      ]);

      // Upsert products
      let synced = 0;
      for (const product of products) {
        const transformed = transformShopifyProduct(product, input.brandId);
        await db.upsertShopifyProduct(transformed as any);
        synced++;
      }

      // Update last sync time
      await db.updateShopifyConnection(conn.id, { lastSyncAt: new Date() });

      return { synced, total: products.length };
    }),

  listProducts: protectedProcedure
    .input(z.object({ brandId: z.number(), limit: z.number().default(100) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return db.getShopifyProductsByBrandId(input.brandId, input.limit);
    }),
});

// ── Service Spotlight Router ──────────────────────────────────────────────

const serviceRouter = router({
  list: protectedProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return db.getServicesByBrandId(input.brandId);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const service = await db.getServiceById(input.id);
      if (!service) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === service.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return service;
    }),

  create: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      name: z.string().min(1).max(300),
      description: z.string().optional(),
      serviceAreas: z.array(z.string()).optional(),
      specials: z.string().optional(),
      ctaType: z.enum(["call", "book_online", "dm", "visit_website", "custom"]).default("visit_website"),
      ctaText: z.string().optional(),
      ctaLink: z.string().optional(),
      ctaPhone: z.string().optional(),
      images: z.array(z.string()).optional(),
      displayOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brand = await db.getBrandById(input.brandId);
        if (!brand || brand.clientUserId !== ctx.user.id || brand.clientTier !== "premium") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admin or premium clients can manage services" });
        }
      }
      return db.createService(input as any);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(300).optional(),
      description: z.string().optional(),
      serviceAreas: z.array(z.string()).optional(),
      specials: z.string().optional(),
      ctaType: z.enum(["call", "book_online", "dm", "visit_website", "custom"]).optional(),
      ctaText: z.string().optional(),
      ctaLink: z.string().optional(),
      ctaPhone: z.string().optional(),
      images: z.array(z.string()).optional(),
      displayOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = await db.getServiceById(input.id);
      if (!service) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        const brand = await db.getBrandById(service.brandId);
        if (!brand || brand.clientUserId !== ctx.user.id || brand.clientTier !== "premium") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      const { id, ...data } = input;
      await db.updateService(id, data as any);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const service = await db.getServiceById(input.id);
      if (!service) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        const brand = await db.getBrandById(service.brandId);
        if (!brand || brand.clientUserId !== ctx.user.id || brand.clientTier !== "premium") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      await db.deleteService(input.id);
      return { success: true };
    }),
});

// ── User Management Router (Admin) ─────────────────────────────────────────

const userRouter = router({
  list: adminProcedure.query(async () => {
    return db.getAllUsers();
  }),
});

// ── Main App Router ────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  brand: brandRouter,
  post: postRouter,
  ai: aiRouter,
  notification: notificationRouter,
  social: socialRouter,
  analytics: analyticsRouter,
  user: userRouter,
  shopify: shopifyRouter,
  service: serviceRouter,
});

export type AppRouter = typeof appRouter;
