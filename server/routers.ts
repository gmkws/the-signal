import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { generatePost, generatePostImage, pickContentType, generateBatch, buildBatchSlots, generateCarouselPost } from "./services/contentEngine";
import { buildGBPOAuthUrl, exchangeGoogleCode, getGBPAccounts, getGBPLocations } from "./services/googleBusiness";
import { exchangeForLongLivedToken, getUserPages, getInstagramAccount } from "./services/meta";
import { generateCaseStudy } from "./_core/llm";
import type { ContentFormat, ContentSourceInfo } from "./services/contentEngine";
import { MAX_BRANDS, META_APP_ID } from "@shared/types";
import { validateShopifyConnection, fetchShopifyProducts, transformShopifyProduct, fetchShopifyCollections } from "./services/shopify";
import { buildPromoSchedule, generatePromoPostContent, getEventOccurrences } from "./services/eventPromotion";
import { handlePostFailure, checkBrandTokenHealth, checkUnapprovedPosts, handleContentGenerationFailure, generateFallbackPost } from "./services/guardrails";
import { generateSmartImage as renderSmartImage, generateTemplateGraphic } from "./services/imageOverlay";

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

      let result;
      try {
        result = await generatePost(
          brand.name,
          input.contentType as ContentFormat,
          brand.voiceSettings as any,
          input.customTopic,
          sourceInfo
        );
      } catch (err: any) {
        // Fallback to template-based post on AI failure
        const fallback = await handleContentGenerationFailure(
          input.brandId,
          input.contentType,
          err?.message || "Unknown error",
          brand.name,
          brand.location || ""
        );
        result = {
          content: fallback.fallbackContent,
          contentType: input.contentType,
          suggestedImagePrompt: `Professional social media graphic for ${brand.name}`,
          overlayHeadline: brand.name,
          isFallback: true,
        };
      }

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
      const result = await generatePostImage(input.prompt);
      return { imageUrl: result.url };
    }),

  generateSmartImage: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      prompt: z.string().min(1),
      overlayText: z.object({
        headline: z.string().optional(),
        subtext: z.string().optional(),
        ctaText: z.string().optional(),
        brandName: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
      }).optional(),
      style: z.enum(["modern", "bold", "minimal", "vibrant", "dark"]).default("modern"),
    }))
    .mutation(async ({ ctx, input }) => {
      const brand = await db.getBrandById(input.brandId);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });

      // Generate AI background image — prompt sanitization happens downstream
      let bgImageUrl = "";
      let bgBase64 = "";
      try {
        const imgResult = await generatePostImage(input.prompt);
        bgImageUrl = imgResult.url;
        bgBase64 = imgResult.base64 || "";
      } catch (err: any) {
        // Use a solid gradient fallback (no background image)
        console.warn("[SmartImage] Image generation failed, using gradient fallback:", err.message);
      }

      // Render composite image with text overlay
      // Pass base64 so the SVG can embed the image inline (external URLs blocked in <img> tags)
      const result = await renderSmartImage({
        backgroundUrl: bgBase64 ? `data:image/png;base64,${bgBase64}` : bgImageUrl,
        headline: input.overlayText?.headline || "",
        subtext: input.overlayText?.subtext || "",
        ctaText: input.overlayText?.ctaText || "",
        brandName: input.overlayText?.brandName || brand.name,
          hashtags: input.overlayText?.hashtags || [],
        style: input.style,
        brandLogoUrl: brand.logoUrl || "",
      });
      return result;
    }),

  // Preview what slots would be generated (no LLM calls, no DB writes)
  previewSchedule: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      windowDays: z.number().min(1).max(30).default(7),
      postsPerDay: z.union([z.literal(1), z.literal(2)]).default(1),
      firstPostHour: z.number().min(0).max(23).default(9),
      secondPostHour: z.number().min(0).max(23).default(17),
      startDate: z.string().optional(), // ISO date string, defaults to tomorrow
      formatRotation: z.array(z.string()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const brand = await db.getBrandById(input.brandId);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin" && brand.clientUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const startDate = input.startDate ? new Date(input.startDate) : (() => {
        const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); return d;
      })();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + input.windowDays);
      // Get already-scheduled posts in this window
      const existing = await db.getScheduledPosts(startDate, endDate, input.brandId);
      const occupiedSlots = new Set<string>();
      for (const p of existing) {
        if (p.scheduledAt) {
          const d = new Date(p.scheduledAt);
          const key = `${d.toISOString().slice(0,10)}-${String(d.getHours()).padStart(2,"0")}`;
          occupiedSlots.add(key);
        }
      }
      const defaultRotation: ContentFormat[] = ["hey_tony", "hook_solve", "auditor_showcase", "local_tips", "machine_series", "print_digital"];
      const rotation = (input.formatRotation?.length ? input.formatRotation : defaultRotation) as ContentFormat[];
      const slots = buildBatchSlots(
        startDate,
        input.windowDays,
        input.postsPerDay as 1 | 2,
        input.firstPostHour,
        input.secondPostHour,
        occupiedSlots,
        rotation
      );
      return {
        slots: slots.map(s => ({ scheduledAt: s.scheduledAt, contentType: s.contentType })),
        existingCount: existing.length,
        newCount: slots.length,
      };
    }),

  // Actually generate and save the batch
  fillSchedule: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      windowDays: z.number().min(1).max(30).default(7),
      postsPerDay: z.union([z.literal(1), z.literal(2)]).default(1),
      firstPostHour: z.number().min(0).max(23).default(9),
      secondPostHour: z.number().min(0).max(23).default(17),
      startDate: z.string().optional(),
      formatRotation: z.array(z.string()).optional(),
      createAs: z.enum(["draft", "scheduled"]).default("draft"),
      useContentSources: z.boolean().default(true),
      generateImages: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const brand = await db.getBrandById(input.brandId);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin" && brand.clientUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const startDate = input.startDate ? new Date(input.startDate) : (() => {
        const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); return d;
      })();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + input.windowDays);
      // Get occupied slots
      const existing = await db.getScheduledPosts(startDate, endDate, input.brandId);
      const occupiedSlots = new Set<string>();
      for (const p of existing) {
        if (p.scheduledAt) {
          const d = new Date(p.scheduledAt);
          const key = `${d.toISOString().slice(0,10)}-${String(d.getHours()).padStart(2,"0")}`;
          occupiedSlots.add(key);
        }
      }
      const defaultRotation: ContentFormat[] = ["hey_tony", "hook_solve", "auditor_showcase", "local_tips", "machine_series", "print_digital"];
      const rotation = (input.formatRotation?.length ? input.formatRotation : defaultRotation) as ContentFormat[];
      const slots = buildBatchSlots(
        startDate, input.windowDays, input.postsPerDay as 1 | 2,
        input.firstPostHour, input.secondPostHour, occupiedSlots, rotation
      );
      if (slots.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "All slots in this window are already filled" });
      }
      // Build source info for content rotation
      let sourceInfo: ContentSourceInfo | undefined;
      if (input.useContentSources) {
        const shopifyConn = await db.getShopifyConnectionByBrandId(input.brandId);
        const servicesData = await db.getServicesByBrandId(input.brandId);
        sourceInfo = { hasShopify: !!shopifyConn?.isConnected, hasServices: servicesData.length > 0 };
        if (sourceInfo.hasShopify) {
          const product = await db.getShopifyProductForContent(input.brandId);
          if (product) sourceInfo.shopifyProduct = { title: product.title, description: product.description, price: product.price, compareAtPrice: product.compareAtPrice, productType: product.productType, tags: (product.tags as string[]) || [], imageUrl: product.imageUrl, collections: (product.collections as string[]) || [], handle: product.handle };
        }
        if (sourceInfo.hasServices) {
          const service = await db.getServiceForContent(input.brandId);
          if (service) sourceInfo.service = { name: service.name, description: service.description, serviceAreas: (service.serviceAreas as string[]) || [], specials: service.specials, ctaType: service.ctaType, ctaText: service.ctaText, ctaLink: service.ctaLink, ctaPhone: service.ctaPhone, images: (service.images as string[]) || [] };
        }
      }
      // Generate all posts
      const generated = await generateBatch(brand.name, slots, brand.voiceSettings as any, sourceInfo, input.generateImages);
      // Save to DB
      const saved: number[] = [];
      let imagesGenerated = 0;
      let imagesFailed = 0;
      for (const post of generated) {
        if (post.imageUrl) imagesGenerated++;
        if (post.imageGenerationFailed) imagesFailed++;
        const created = await db.createPost({
          brandId: input.brandId,
          content: post.content,
          contentType: post.contentType as any,
          scheduledAt: post.scheduledAt,
          status: input.createAs,
          platforms: ["facebook", "instagram"],
          aiGenerated: true,
          createdBy: ctx.user.id,
          imageUrl: post.imageUrl ?? null,
        });
        saved.push(created.id);
      }
      return { created: saved.length, posts: saved, imagesGenerated, imagesFailed };
    }),

  // Generate a carousel post (multi-slide)
  generateCarousel: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      carouselType: z.enum(["hook_solve", "local_tips", "machine_series", "service_spotlight", "custom"]).default("hook_solve"),
      customTopic: z.string().optional(),
      useContentSources: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const brand = await db.getBrandById(input.brandId);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin" && brand.clientUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      let sourceInfo: ContentSourceInfo | undefined;
      if (input.useContentSources) {
        const servicesData = await db.getServicesByBrandId(input.brandId);
        if (servicesData.length > 0) {
          const service = await db.getServiceForContent(input.brandId);
          if (service) {
            sourceInfo = {
              hasShopify: false,
              hasServices: true,
              service: { name: service.name, description: service.description, serviceAreas: (service.serviceAreas as string[]) || [], specials: service.specials, ctaType: service.ctaType, ctaText: service.ctaText, ctaLink: service.ctaLink, ctaPhone: service.ctaPhone, images: (service.images as string[]) || [] },
            };
          }
        }
      }
      const result = await generateCarouselPost(
        brand.name,
        input.carouselType,
        brand.voiceSettings as any,
        input.customTopic,
        sourceInfo
      );
      return result;
    }),

  // Generate a case study caption from before/after job site photos
  generateCaseStudy: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      serviceType: z.string().min(1),
      beforeImage: z.string().min(1), // base64-encoded image (no data URI prefix)
      afterImage: z.string().min(1),  // base64-encoded image (no data URI prefix)
    }))
    .mutation(async ({ ctx, input }) => {
      const brand = await db.getBrandById(input.brandId);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });
      if (ctx.user.role !== "admin" && brand.clientUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const result = await generateCaseStudy({
        serviceType: input.serviceType,
        beforeImageBase64: input.beforeImage,
        afterImageBase64: input.afterImage,
        brandName: brand.name,
      });
      return { content: result.caption, contentType: "case_study" };
    }),

  // Save a carousel post to the database
  saveCarousel: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      captionText: z.string(),
      contentType: z.string(),
      slides: z.array(z.object({
        headline: z.string(),
        body: z.string(),
        imagePrompt: z.string(),
        imageUrl: z.string().optional(),
      })),
      scheduledAt: z.string().optional(),
      status: z.enum(["draft", "scheduled", "pending_review"]).default("draft"),
      platforms: z.array(z.string()).default(["facebook", "instagram"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const brand = await db.getBrandById(input.brandId);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin" && brand.clientUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const post = await db.createPost({
        brandId: input.brandId,
        content: input.captionText,
        contentType: input.contentType as any,
        isCarousel: true,
        carouselSlides: input.slides,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        status: input.status,
        platforms: input.platforms,
        aiGenerated: true,
        createdBy: ctx.user.id,
      });
      return { id: post.id };
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

// ── Event Router ─────────────────────────────────────────────────────────

const eventRouter = router({
  list: protectedProcedure
    .input(z.object({ brandId: z.number(), includeInactive: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return db.getEventsByBrandId(input.brandId, input.includeInactive);
    }),

  upcoming: protectedProcedure
    .input(z.object({ brandId: z.number().optional(), days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && input.brandId) {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return db.getUpcomingEvents(input.brandId, input.days);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const event = await db.getEventById(input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === event.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return event;
    }),

  create: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      name: z.string().min(1).max(300),
      description: z.string().optional(),
      location: z.string().optional(),
      ticketLink: z.string().optional(),
      eventDate: z.string(), // ISO string from frontend
      eventEndDate: z.string().optional(),
      isRecurring: z.boolean().default(false),
      recurrencePattern: z.enum(["weekly", "biweekly", "monthly"]).optional(),
      recurrenceEndDate: z.string().optional(),
      promoLeadDays: z.array(z.number().min(0).max(30)).default([0]),
      includeRecap: z.boolean().default(false),
      imageUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Permission check
      if (ctx.user.role !== "admin") {
        const brand = await db.getBrandById(input.brandId);
        if (!brand || brand.clientUserId !== ctx.user.id || brand.clientTier !== "premium") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admin or premium clients can create events" });
        }
      }
      const result = await db.createEvent({
        ...input,
        eventDate: new Date(input.eventDate),
        eventEndDate: input.eventEndDate ? new Date(input.eventEndDate) : null,
        recurrenceEndDate: input.recurrenceEndDate ? new Date(input.recurrenceEndDate) : null,
        createdBy: ctx.user.id,
      } as any);
      return result;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(300).optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      ticketLink: z.string().optional(),
      eventDate: z.string().optional(),
      eventEndDate: z.string().optional(),
      isRecurring: z.boolean().optional(),
      recurrencePattern: z.enum(["weekly", "biweekly", "monthly"]).optional(),
      recurrenceEndDate: z.string().optional(),
      promoLeadDays: z.array(z.number().min(0).max(30)).optional(),
      includeRecap: z.boolean().optional(),
      imageUrl: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const event = await db.getEventById(input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        const brand = await db.getBrandById(event.brandId);
        if (!brand || brand.clientUserId !== ctx.user.id || brand.clientTier !== "premium") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.eventDate) updateData.eventDate = new Date(data.eventDate);
      if (data.eventEndDate) updateData.eventEndDate = new Date(data.eventEndDate);
      if (data.recurrenceEndDate) updateData.recurrenceEndDate = new Date(data.recurrenceEndDate);
      await db.updateEvent(id, updateData);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const event = await db.getEventById(input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        const brand = await db.getBrandById(event.brandId);
        if (!brand || brand.clientUserId !== ctx.user.id || brand.clientTier !== "premium") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      await db.deleteEvent(input.id);
      return { success: true };
    }),

  generatePromoSequence: protectedProcedure
    .input(z.object({ eventId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const event = await db.getEventById(input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });

      // Permission check
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === event.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }

      const brand = await db.getBrandById(event.brandId);
      if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found" });

      // Build the promo schedule
      const promoSlots = buildPromoSchedule(event);
      if (promoSlots.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No upcoming event occurrences found to generate promotions for" });
      }

      // Delete any existing pending promotions for this event
      await db.deleteEventPromotionsByEventId(event.id);

      // Generate posts for each promo slot
      const generated: Array<{ promoType: string; scheduledDate: Date; postId: number }> = [];

      for (const slot of promoSlots) {
        try {
          // Generate AI content for this promo
          const promoContent = await generatePromoPostContent(event, brand, slot.promoType, slot.eventOccurrenceDate);

          // Create the post
          const post = await db.createPost({
            brandId: event.brandId,
            content: promoContent.content,
            contentType: promoContent.contentType as any,
            scheduledAt: slot.scheduledDate,
            status: "scheduled",
            platforms: ["facebook", "instagram"],
            aiGenerated: true,
            createdBy: ctx.user.id,
          });

          // Create the event promotion record
          const promo = await db.createEventPromotion({
            eventId: event.id,
            postId: post.id,
            brandId: event.brandId,
            promoType: slot.promoType,
            eventOccurrenceDate: slot.eventOccurrenceDate,
            scheduledDate: slot.scheduledDate,
            status: "generated",
          });

          generated.push({
            promoType: slot.promoType,
            scheduledDate: slot.scheduledDate,
            postId: post.id,
          });
        } catch (err) {
          console.error(`[EventPromo] Failed to generate promo for slot ${slot.promoType}:`, err);
        }
      }

      return { generated, total: promoSlots.length };
    }),

  getPromotions: protectedProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ ctx, input }) => {
      const event = await db.getEventById(input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === event.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return db.getEventPromotionsByEventId(input.eventId);
    }),

  getPromoPostIds: protectedProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return db.getEventPromoPostIds(input.brandId);
    }),

  previewSchedule: protectedProcedure
    .input(z.object({ eventId: z.number() }))
    .query(async ({ ctx, input }) => {
      const event = await db.getEventById(input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.some(b => b.id === event.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      const slots = buildPromoSchedule(event);
      const occurrences = getEventOccurrences(event);
      return { slots, occurrences, totalPosts: slots.length };
    }),
});

// ── System Health Router ──────────────────────────────────────────────────

const systemHealthRouter = router({
  errorLogs: adminProcedure
    .input(z.object({ limit: z.number().default(100), includeResolved: z.boolean().default(false) }))
    .query(async ({ input }) => {
      return db.getErrorLogs(input.limit, input.includeResolved);
    }),

  errorLogsByBrand: adminProcedure
    .input(z.object({ brandId: z.number(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      return db.getErrorLogsByBrand(input.brandId, input.limit);
    }),

  errorStats: adminProcedure.query(async () => {
    return db.getErrorLogStats();
  }),

  resolveError: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.resolveErrorLog(input.id, ctx.user.id);
      return { success: true };
    }),

  tokenHealth: adminProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ input }) => {
      return checkBrandTokenHealth(input.brandId);
    }),

  checkUnapproved: adminProcedure
    .input(z.object({ hoursBeforePublish: z.number().default(24) }))
    .mutation(async ({ input }) => {
      const reminded = await checkUnapprovedPosts(input.hoursBeforePublish);
      return { reminded };
    }),

  retryPost: adminProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const post = await db.getPostById(input.postId);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      if (post.status !== "failed") throw new TRPCError({ code: "BAD_REQUEST", message: "Post is not in failed state" });
      // Reset to scheduled for retry
      await db.updatePost(input.postId, { status: "scheduled" as any });
      return { success: true };
    }),
});

// ── Onboarding Router ────────────────────────────────────────────────────

const onboardingRouter = router({
  // Get current user's onboarding state
  getState: protectedProcedure.query(async ({ ctx }) => {
    return db.getOnboardingStateByUserId(ctx.user.id);
  }),

  // Save progress for a step
  saveStep: protectedProcedure
    .input(z.object({
      step: z.number().min(1).max(6),
      data: z.record(z.string(), z.any()),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getOnboardingStateByUserId(ctx.user.id);
      const currentStepData = (existing?.stepData as Record<string, any>) || {};
      const updatedStepData = { ...currentStepData, [`step${input.step}`]: input.data };
      await db.upsertOnboardingState(ctx.user.id, {
        currentStep: Math.max(input.step, existing?.currentStep || 1),
        stepData: updatedStepData,
      });
      return { success: true };
    }),

  // Complete onboarding — creates the brand record
  complete: protectedProcedure
    .input(z.object({
      brandName: z.string().min(1).max(200),
      industry: z.string().optional(),
      website: z.string().optional(),
      location: z.string().optional(),
      tone: z.string().default("professional"),
      style: z.string().default("direct"),
      keywords: z.array(z.string()).default([]),
      avoidWords: z.array(z.string()).default([]),
      samplePosts: z.array(z.string()).default([]),
      customInstructions: z.string().default(""),
      postsPerDay: z.number().min(1).max(4).default(1),
      autoPost: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check brand limit
      const count = await db.getBrandCount();
      if (count >= MAX_BRANDS) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Maximum of ${MAX_BRANDS} brands reached. Please contact GMK Web Solutions.` });
      }
      // Generate slug from brand name
      const slug = input.brandName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 100);
      // Create the brand (inactive until admin approves)
      const { id: brandId } = await db.createBrand({
        name: input.brandName,
        slug: `${slug}-${Date.now()}`,
        industry: input.industry,
        website: input.website,
        location: input.location,
        clientUserId: ctx.user.id,
        clientTier: "managed", // Default until admin sets it
        autoPostEnabled: input.autoPost,
        isActive: false, // Inactive until approved
        voiceSettings: {
          tone: input.tone,
          style: input.style,
          keywords: input.keywords,
          avoidWords: input.avoidWords,
          samplePosts: input.samplePosts,
          customInstructions: input.customInstructions,
        },
      });
      // Mark onboarding complete
      await db.completeOnboarding(ctx.user.id, brandId);
      // Notify admin
      try {
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: `New brand signup: ${input.brandName}`,
          content: `${ctx.user.name || ctx.user.email} has completed onboarding for brand "${input.brandName}". Review and approve in the admin dashboard.`,
        });
      } catch (e) {
        console.warn("[Onboarding] Failed to notify owner:", e);
      }
      return { brandId, success: true };
    }),

  // AI assistant for onboarding questions
  askAssistant: protectedProcedure
    .input(z.object({
      question: z.string().min(1).max(1000),
      currentStep: z.number().min(1).max(6),
      brandName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("./_core/llm");
      const systemPrompt = `You are a friendly onboarding assistant for "The Signal" — a social media automation platform by GMK Web Solutions. 
You help new clients set up their brand profile. Be concise, helpful, and encouraging.

The Signal helps businesses automate their social media with AI-generated content for Facebook and Instagram.
Key features: AI content generation, scheduled posting, multiple content formats (tips, product spotlights, service highlights, event promotion).

The user is on step ${input.currentStep} of 6:
1. Brand basics (name, industry, website, location)
2. Brand voice (tone, style, keywords)
3. Content sources (Shopify store, services, or general)
4. Social accounts (Facebook/Instagram connection)
5. Schedule preferences (how often to post)
6. Review & launch

Answer questions about these steps concisely. If asked about pricing or billing, say to contact GMK Web Solutions directly.`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.question },
        ],
      });
      return { answer: response.choices[0]?.message?.content || "I'm not sure — please contact GMK Web Solutions for help." };
    }),

  // Admin: get pending onboardings for approval
  getPending: adminProcedure.query(async () => {
    return db.getPendingOnboardings();
  }),

  // Admin: approve a brand
  approve: adminProcedure
    .input(z.object({
      userId: z.number(),
      tier: z.enum(["managed", "premium"]).default("managed"),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.approveOnboarding(input.userId, ctx.user.id, input.tier);
      // Notify the client
      const state = await db.getOnboardingStateByUserId(input.userId);
      if (state?.brandId) {
        await db.createNotification({
          brandId: state.brandId,
          type: "system",
          title: "Your brand has been approved!",
          message: `Your brand is now live on The Signal. You can start creating and scheduling content.`,
          toRole: "client",
        });
      }
      return { success: true };
    }),

  // Admin: reject a brand
  reject: adminProcedure
    .input(z.object({
      userId: z.number(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.rejectOnboarding(input.userId, ctx.user.id, input.reason);
      return { success: true };
    }),

  // Admin: generate invite link
  createInvite: adminProcedure
    .input(z.object({
      email: z.string().email().optional(),
      tier: z.enum(["managed", "premium"]).default("managed"),
      brandName: z.string().optional(),
      expiresInDays: z.number().default(7),
    }))
    .mutation(async ({ ctx, input }) => {
      const { nanoid } = await import("nanoid");
      const token = nanoid(48);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);
      const invite = await db.createBrandInvite({
        token,
        email: input.email,
        tier: input.tier,
        brandName: input.brandName,
        createdBy: ctx.user.id,
        expiresAt,
      });
      return { token: invite.token, inviteUrl: `/onboarding?invite=${invite.token}` };
    }),

  // Validate an invite token (public — used before login)
  validateInvite: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const invite = await db.getBrandInviteByToken(input.token);
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      if (invite.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Invite already used" });
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" });
      }
      return { valid: true, tier: invite.tier, brandName: invite.brandName, email: invite.email };
    }),

  // Get all invites (admin)
  listInvites: adminProcedure.query(async ({ ctx }) => {
    return db.getInvitesByCreator(ctx.user.id);
  }),
});

// ── User Management Router (Admin) ─────────────────────────────────────────

const userRouter = router({
  list: adminProcedure.query(async () => {
    return db.getAllUsers();
  }),
});

/// ── Leads Router ─────────────────────────────────────────────────────────
const leadsRouter = router({
  list: protectedProcedure
    .input(z.object({ brandId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === "admin") {
        if (input?.brandId) return db.getLeadsByBrand(input.brandId);
        return db.getAllLeads();
      }
      // Client: only their own brands
      const brands = await db.getBrandsByClientUserId(ctx.user.id);
      const brandIds = brands.map(b => b.id);
      if (input?.brandId && !brandIds.includes(input.brandId)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const targetBrandId = input?.brandId ?? brandIds[0];
      if (!targetBrandId) return [];
      return db.getLeadsByBrand(targetBrandId);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "contacted", "qualified", "closed", "spam"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const lead = await db.getLeadById(input.id);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
      // Verify access
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.find(b => b.id === lead.brandId)) throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.updateLead(input.id, {
        ...(input.status && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes }),
      });
      return { success: true };
    }),

  getChatbotFlow: protectedProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.find(b => b.id === input.brandId)) throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.getChatbotFlow(input.brandId);
    }),

  saveChatbotFlow: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      greeting: z.string().min(1).optional(),
      askName: z.string().min(1).optional(),
      askContact: z.string().min(1).optional(),
      askTime: z.string().min(1).optional(),
      closingMessage: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.find(b => b.id === input.brandId)) throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { brandId, ...rest } = input;
      return db.upsertChatbotFlow(brandId, rest);
    }),
});

// ── Google Business Profile Router ────────────────────────────────────────

const gbpRouter = router({
  /**
   * Returns the Google OAuth URL for the connect popup.
   * The state param carries the brandId so the callback can close correctly.
   */
  getOAuthUrl: protectedProcedure
    .input(z.object({ brandId: z.number().optional().default(0), redirectUri: z.string().url() }))
    .query(({ input }) => {
      const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
      if (!clientId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GOOGLE_CLIENT_ID not configured" });
      const url = buildGBPOAuthUrl(clientId, input.redirectUri, String(input.brandId));
      return { url };
    }),

  /**
   * Exchange the authorization code for OAuth tokens and return the list of
   * GBP locations the user manages so they can pick one.
   */
  handleCallback: protectedProcedure
    .input(z.object({
      brandId: z.number().optional(),
      code: z.string().min(1),
      redirectUri: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
      if (!clientId || !clientSecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Google credentials not configured" });
      }

      const tokens = await exchangeGoogleCode(input.code, input.redirectUri, clientId, clientSecret);

      // Fetch all accounts then their locations
      const accounts = await getGBPAccounts(tokens.access_token);
      const locations: Array<{ name: string; title: string; accountName: string }> = [];
      for (const account of accounts) {
        const locs = await getGBPLocations(account.name, tokens.access_token).catch(() => []);
        for (const loc of locs) {
          locations.push({ name: loc.name, title: loc.title, accountName: account.name });
        }
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        locations,
      };
    }),

  /**
   * Save the selected GBP location as a connected social account.
   */
  connect: protectedProcedure
    .input(z.object({
      brandId: z.number(),
      locationName: z.string().min(1),
      locationTitle: z.string(),
      accessToken: z.string().min(1),
      refreshToken: z.string().nullable(),
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Clients can only connect GBP to their own brands
      if (ctx.user.role !== "admin") {
        const brands = await db.getBrandsByClientUserId(ctx.user.id);
        if (!brands.find((b: any) => b.id === input.brandId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      const existing = await db.getSocialAccountsByBrandId(input.brandId);
      const gbpAccount = existing.find((a: any) => a.platform === "google_business");

      const accountData = {
        brandId: input.brandId,
        platform: "google_business" as const,
        platformAccountId: input.locationName,
        accountName: input.locationTitle,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? undefined,
        gbpLocationId: input.locationName,
        tokenExpiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        isConnected: true,
      };

      if (gbpAccount) {
        await db.updateSocialAccount(gbpAccount.id, accountData as any);
        return { id: gbpAccount.id };
      }
      const result = await db.createSocialAccount(accountData as any);
      return { id: result.id };
    }),

  /**
   * Remove a connected GBP account.
   */
  disconnect: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteSocialAccount(input.id);
      return { success: true };
    }),
});

// ── Meta OAuth Router ─────────────────────────────────────────────────────
const GRAPH_API_OAUTH_VERSION = "v19.0";
const META_REDIRECT_URI = "https://thesignal.gmkwebsolutions.com/api/meta/callback";
const META_CONFIG_ID = "2079086999617974";
const META_OAUTH_SCOPES = "public_profile,instagram_basic,instagram_content_publish,pages_show_list,pages_manage_posts,pages_read_engagement";

const metaRouter = router({
  /**
   * Build a Facebook OAuth authorisation URL. The brandId is embedded in
   * the `state` parameter so the callback can pass it back via postMessage.
   * redirect_uri is hardcoded to the production URL so it always matches
   * the value registered in Meta's app settings.
   */
  getOAuthUrl: adminProcedure
    .input(z.object({ brandId: z.number() }))
    .query(({ input }) => {
      const url = new URL(`https://www.facebook.com/${GRAPH_API_OAUTH_VERSION}/dialog/oauth`);
      url.searchParams.set("client_id", META_APP_ID);
      url.searchParams.set("config_id", META_CONFIG_ID);
      url.searchParams.set("redirect_uri", META_REDIRECT_URI);
      url.searchParams.set("scope", META_OAUTH_SCOPES);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", input.brandId.toString());
      return { url: url.toString() };
    }),

  /**
   * Exchange the one-time authorisation code for a long-lived user token,
   * then return all Facebook Pages the user manages along with any linked
   * Instagram Business Accounts.
   */
  handleCallback: adminProcedure
    .input(z.object({ brandId: z.number(), code: z.string() }))
    .mutation(async ({ input }) => {
      const appSecret = process.env.META_APP_SECRET;
      if (!appSecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "META_APP_SECRET is not configured on the server" });
      }

      // Step 1: exchange auth code → short-lived user access token
      const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_API_OAUTH_VERSION}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", META_APP_ID);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("redirect_uri", META_REDIRECT_URI);
      tokenUrl.searchParams.set("code", input.code);

      const tokenRes = await fetch(tokenUrl.toString());
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({})) as Record<string, unknown>;
        throw new TRPCError({ code: "BAD_REQUEST", message: `Meta token exchange failed: ${JSON.stringify(err)}` });
      }
      const { access_token: shortLivedToken } = await tokenRes.json() as { access_token: string };

      // Step 2: extend to a long-lived user token (~60 days)
      const longLived = await exchangeForLongLivedToken(shortLivedToken, META_APP_ID, appSecret);

      // Step 3: fetch all Facebook Pages the user administers
      const pages = await getUserPages(longLived.access_token);
      if (!pages.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Facebook Pages found. Ensure you are an admin of at least one Page.",
        });
      }

      // Step 4: enrich each page with its linked Instagram Business Account
      const enrichedPages = await Promise.all(
        pages.map(async (page) => {
          const instagramAccount = await getInstagramAccount(page.id, page.access_token).catch(() => null);
          return { ...page, instagramAccount };
        })
      );

      return { pages: enrichedPages };
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
  event: eventRouter,
  health: systemHealthRouter,
  onboarding: onboardingRouter,
  leads: leadsRouter,
  gbp: gbpRouter,
  meta: metaRouter,
});

export type AppRouter = typeof appRouter;
