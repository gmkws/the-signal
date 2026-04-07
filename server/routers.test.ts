import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../shared/const";
import { MAX_BRANDS } from "../shared/types";

// ── Mock db module ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getAllBrands: vi.fn().mockResolvedValue([]),
  getBrandsByClientUserId: vi.fn().mockResolvedValue([]),
  getBrandById: vi.fn().mockResolvedValue(null),
  getBrandBySlug: vi.fn().mockResolvedValue(null),
  getBrandCount: vi.fn().mockResolvedValue(0),
  createBrand: vi.fn().mockResolvedValue({ id: 1 }),
  updateBrand: vi.fn().mockResolvedValue(undefined),
  deleteBrand: vi.fn().mockResolvedValue(undefined),
  getAllPosts: vi.fn().mockResolvedValue([]),
  getPostsByBrandId: vi.fn().mockResolvedValue([]),
  getPostsByStatus: vi.fn().mockResolvedValue([]),
  getPostById: vi.fn().mockResolvedValue(null),
  createPost: vi.fn().mockResolvedValue({ id: 1 }),
  updatePost: vi.fn().mockResolvedValue(undefined),
  deletePost: vi.fn().mockResolvedValue(undefined),
  getPostStats: vi.fn().mockResolvedValue({ total: 0, draft: 0, scheduled: 0, pending_review: 0, approved: 0, published: 0, failed: 0, paused: 0 }),
  getScheduledPosts: vi.fn().mockResolvedValue([]),
  getSocialAccountsByBrandId: vi.fn().mockResolvedValue([]),
  createSocialAccount: vi.fn().mockResolvedValue({ id: 1 }),
  deleteSocialAccount: vi.fn().mockResolvedValue(undefined),
  getNotifications: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  createNotification: vi.fn().mockResolvedValue({ id: 1 }),
  getAnalyticsSummary: vi.fn().mockResolvedValue({ impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0 }),
  getAnalyticsByBrand: vi.fn().mockResolvedValue([]),
  getAllUsers: vi.fn().mockResolvedValue([]),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getUserByEmail: vi.fn().mockResolvedValue(undefined),
  setUserPasswordHash: vi.fn().mockResolvedValue(undefined),
  getUserByResetToken: vi.fn().mockResolvedValue(undefined),
  setPasswordResetToken: vi.fn().mockResolvedValue(undefined),
  clearPasswordResetToken: vi.fn().mockResolvedValue(undefined),
  updateUserStripeInfo: vi.fn().mockResolvedValue(undefined),
  // Shopify
  getShopifyConnectionByBrandId: vi.fn().mockResolvedValue(null),
  createShopifyConnection: vi.fn().mockResolvedValue({ id: 1 }),
  updateShopifyConnection: vi.fn().mockResolvedValue(undefined),
  deleteShopifyConnection: vi.fn().mockResolvedValue(undefined),
  getShopifyProductsByBrandId: vi.fn().mockResolvedValue([]),
  getShopifyProductForContent: vi.fn().mockResolvedValue(null),
  upsertShopifyProduct: vi.fn().mockResolvedValue(undefined),
  markShopifyProductUsed: vi.fn().mockResolvedValue(undefined),
  // Services
  getServicesByBrandId: vi.fn().mockResolvedValue([]),
  getServiceById: vi.fn().mockResolvedValue(null),
  getServiceForContent: vi.fn().mockResolvedValue(null),
  createService: vi.fn().mockResolvedValue({ id: 1 }),
  updateService: vi.fn().mockResolvedValue(undefined),
  deleteService: vi.fn().mockResolvedValue(undefined),
  markServiceUsed: vi.fn().mockResolvedValue(undefined),
  // Events
  getEventsByBrandId: vi.fn().mockResolvedValue([]),
  getUpcomingEvents: vi.fn().mockResolvedValue([]),
  getEventById: vi.fn().mockResolvedValue(null),
  createEvent: vi.fn().mockResolvedValue({ id: 1 }),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
  getEventPromotions: vi.fn().mockResolvedValue([]),
  createEventPromotion: vi.fn().mockResolvedValue({ id: 1 }),
  // Error logs
  createErrorLog: vi.fn().mockResolvedValue({ id: 1 }),
  getErrorLogs: vi.fn().mockResolvedValue([]),
  getErrorLogsByPost: vi.fn().mockResolvedValue([]),
  getErrorStats: vi.fn().mockResolvedValue({ total: 0, errors: 0, warnings: 0, unresolved: 0, last24h: 0 }),
  getErrorLogStats: vi.fn().mockResolvedValue({ total: 0, errors: 0, warnings: 0, unresolved: 0, last24h: 0 }),
  getErrorLogsByBrand: vi.fn().mockResolvedValue([]),
  resolveErrorLog: vi.fn().mockResolvedValue(undefined),
  // Social accounts (additional)
  getSocialAccountById: vi.fn().mockResolvedValue(null),
  // Posts (additional)
  getPostsNeedingApproval: vi.fn().mockResolvedValue([]),
  // Onboarding
  getOnboardingStateByUserId: vi.fn().mockResolvedValue(null),
  upsertOnboardingState: vi.fn().mockResolvedValue(undefined),
  completeOnboarding: vi.fn().mockResolvedValue(undefined),
  getPendingOnboardings: vi.fn().mockResolvedValue([]),
  approveOnboarding: vi.fn().mockResolvedValue(undefined),
  rejectOnboarding: vi.fn().mockResolvedValue(undefined),
  createBrandInvite: vi.fn().mockResolvedValue({ id: 1, token: "test-token-abc123", tier: "managed", brandName: null, email: null, expiresAt: null, usedAt: null }),
  getBrandInviteByToken: vi.fn().mockResolvedValue(null),
  getInvitesByCreator: vi.fn().mockResolvedValue([]),
}));

// ── Mock services ─────────────────────────────────────────────────────────
vi.mock("./services/contentEngine", () => ({
  generatePost: vi.fn().mockResolvedValue({
    content: "Generated post content",
    contentType: "hey_tony",
    suggestedImagePrompt: "A professional image",
  }),
  generatePostImage: vi.fn().mockResolvedValue("https://example.com/image.png"),
  pickContentType: vi.fn().mockReturnValue("hey_tony"),
}));

vi.mock("./services/eventPromotion", () => ({
  generateEventPromoSequence: vi.fn().mockResolvedValue([
    { type: "teaser", content: "Teaser post", scheduledAt: new Date() },
    { type: "reminder", content: "Reminder post", scheduledAt: new Date() },
  ]),
}));

vi.mock("./services/imageOverlay", () => ({
  generateSmartImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/smart-image.svg", width: 1080, height: 1080 }),
  generateTemplateGraphic: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/template.svg", width: 1080, height: 1080 }),
}));

vi.mock("./services/shopify", () => ({
  validateShopifyConnection: vi.fn().mockResolvedValue({ valid: true, shopName: "Test Store" }),
  fetchShopifyProducts: vi.fn().mockResolvedValue([]),
  fetchShopifyCollections: vi.fn().mockResolvedValue([]),
  transformShopifyProduct: vi.fn().mockReturnValue({ shopifyProductId: "123", brandId: 1, title: "Test Product" }),
}));

import * as db from "./db";

// ── Helpers ───────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "gerrit@gmkwebsolutions.com",
    name: "Gerrit",
    loginMethod: "email",
    role: "admin",
    passwordHash: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createClientContext(tier: "managed" | "premium" = "managed"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "client-user",
    email: "client@example.com",
    name: "Client User",
    loginMethod: "email",
    role: "user",
    passwordHash: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Auth Tests ────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated users", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Gerrit");
    expect(result?.role).toBe("admin");
  });
});

// ── Brand Tests ───────────────────────────────────────────────────────────

describe("brand.list", () => {
  it("returns all brands for admin", async () => {
    const mockBrands = [{ id: 1, name: "GMK", slug: "gmk" }];
    vi.mocked(db.getAllBrands).mockResolvedValueOnce(mockBrands as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.brand.list();
    expect(result).toEqual(mockBrands);
    expect(db.getAllBrands).toHaveBeenCalled();
  });

  it("returns only client brands for non-admin", async () => {
    const mockBrands = [{ id: 2, name: "Client Brand", slug: "client" }];
    vi.mocked(db.getBrandsByClientUserId).mockResolvedValueOnce(mockBrands as any);

    const caller = appRouter.createCaller(createClientContext());
    const result = await caller.brand.list();
    expect(result).toEqual(mockBrands);
    expect(db.getBrandsByClientUserId).toHaveBeenCalledWith(2);
  });

  it("rejects unauthenticated access", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    await expect(caller.brand.list()).rejects.toThrow(UNAUTHED_ERR_MSG);
  });
});

describe("brand.create", () => {
  it("allows admin to create a brand", async () => {
    vi.mocked(db.getBrandCount).mockResolvedValueOnce(0);
    vi.mocked(db.getBrandBySlug).mockResolvedValueOnce(null);
    vi.mocked(db.createBrand).mockResolvedValueOnce({ id: 1 } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.brand.create({
      name: "Test Brand",
      slug: "test-brand",
      clientTier: "managed",
    });
    expect(result).toEqual({ id: 1 });
    expect(db.createBrand).toHaveBeenCalled();
  });

  it("rejects non-admin brand creation", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.brand.create({
      name: "Test",
      slug: "test",
      clientTier: "managed",
    })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });

  it("enforces MAX_BRANDS limit", async () => {
    vi.mocked(db.getBrandCount).mockResolvedValueOnce(MAX_BRANDS);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.brand.create({
      name: "Overflow Brand",
      slug: "overflow",
      clientTier: "managed",
    })).rejects.toThrow(`Maximum of ${MAX_BRANDS} brands reached`);
  });

  it("rejects duplicate slugs", async () => {
    vi.mocked(db.getBrandCount).mockResolvedValueOnce(1);
    vi.mocked(db.getBrandBySlug).mockResolvedValueOnce({ id: 1 } as any);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.brand.create({
      name: "Duplicate",
      slug: "existing-slug",
      clientTier: "managed",
    })).rejects.toThrow("Brand slug already exists");
  });
});

describe("brand.delete", () => {
  it("allows admin to delete a brand", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.brand.delete({ id: 1 });
    expect(result).toEqual({ success: true });
    expect(db.deleteBrand).toHaveBeenCalledWith(1);
  });

  it("rejects non-admin deletion", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.brand.delete({ id: 1 })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});

// ── Post Tests ────────────────────────────────────────────────────────────

describe("post.list", () => {
  it("returns all posts for admin", async () => {
    const mockPosts = [{ id: 1, content: "Test post" }];
    vi.mocked(db.getAllPosts).mockResolvedValueOnce(mockPosts as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.post.list({ limit: 10 });
    expect(result).toEqual(mockPosts);
  });

  it("rejects unauthenticated access", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    await expect(caller.post.list({ limit: 10 })).rejects.toThrow(UNAUTHED_ERR_MSG);
  });
});

describe("post.create", () => {
  it("allows admin to create a post", async () => {
    vi.mocked(db.createPost).mockResolvedValueOnce({ id: 1 } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.post.create({
      brandId: 1,
      content: "Test post content",
      contentType: "hey_tony",
      status: "draft",
    });
    expect(result).toEqual({ id: 1 });
    expect(db.createPost).toHaveBeenCalled();
  });

  it("rejects managed client post creation", async () => {
    vi.mocked(db.getBrandById).mockResolvedValueOnce({
      id: 1, clientUserId: 2, clientTier: "managed",
    } as any);

    const caller = appRouter.createCaller(createClientContext("managed"));
    await expect(caller.post.create({
      brandId: 1,
      content: "Test",
      contentType: "custom",
      status: "draft",
    })).rejects.toThrow("Only admin or premium clients can create posts");
  });
});

describe("post.delete", () => {
  it("allows admin to delete a post", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.post.delete({ id: 1 });
    expect(result).toEqual({ success: true });
    expect(db.deletePost).toHaveBeenCalledWith(1);
  });

  it("rejects non-admin deletion", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.post.delete({ id: 1 })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});

describe("post.review", () => {
  it("allows admin to approve a post", async () => {
    vi.mocked(db.getPostById).mockResolvedValueOnce({
      id: 1, brandId: 1, status: "pending_review",
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.post.review({ id: 1, action: "approve" });
    expect(result).toEqual({ success: true });
    expect(db.updatePost).toHaveBeenCalledWith(1, { status: "approved" });
  });

  it("rejects review of non-existent post", async () => {
    vi.mocked(db.getPostById).mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.post.review({ id: 999, action: "approve" })).rejects.toThrow("NOT_FOUND");
  });
});

describe("post.stats", () => {
  it("returns stats for admin", async () => {
    const mockStats = { total: 10, draft: 2, scheduled: 3, pending_review: 1, approved: 1, published: 2, failed: 0, paused: 1 };
    vi.mocked(db.getPostStats).mockResolvedValueOnce(mockStats);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.post.stats({});
    expect(result).toEqual(mockStats);
  });
});

// ── Notification Tests ────────────────────────────────────────────────────

describe("notification.list", () => {
  it("returns notifications for admin", async () => {
    const mockNotifs = [{ id: 1, title: "Test" }];
    vi.mocked(db.getNotifications).mockResolvedValueOnce(mockNotifs as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.notification.list({ limit: 10 });
    expect(result).toEqual(mockNotifs);
    expect(db.getNotifications).toHaveBeenCalledWith("admin", undefined, 10);
  });
});

describe("notification.markRead", () => {
  it("marks a notification as read", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.notification.markRead({ id: 1 });
    expect(result).toEqual({ success: true });
    expect(db.markNotificationRead).toHaveBeenCalledWith(1);
  });
});

describe("notification.requestPause", () => {
  it("pauses a post and notifies admin", async () => {
    vi.mocked(db.getPostById).mockResolvedValueOnce({
      id: 1, brandId: 1, status: "scheduled",
    } as any);

    const caller = appRouter.createCaller(createClientContext());
    const result = await caller.notification.requestPause({ postId: 1 });
    expect(result).toEqual({ success: true });
    expect(db.updatePost).toHaveBeenCalledWith(1, { status: "paused" });
    expect(db.createNotification).toHaveBeenCalled();
  });
});

describe("notification.requestEdit", () => {
  it("creates an edit request notification", async () => {
    vi.mocked(db.getPostById).mockResolvedValueOnce({
      id: 1, brandId: 1,
    } as any);

    const caller = appRouter.createCaller(createClientContext());
    const result = await caller.notification.requestEdit({ postId: 1, notes: "Please change the headline" });
    expect(result).toEqual({ success: true });
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "edit_request",
      message: "Please change the headline",
      toRole: "admin",
    }));
  });
});

// ── Social Account Tests ──────────────────────────────────────────────────

describe("social.connect", () => {
  it("allows admin to connect a social account", async () => {
    vi.mocked(db.createSocialAccount).mockResolvedValueOnce({ id: 1 } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.social.connect({
      brandId: 1,
      platform: "facebook",
      platformAccountId: "123456",
      accessToken: "token123",
    });
    expect(result).toEqual({ id: 1 });
  });

  it("rejects non-admin social account connection", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.social.connect({
      brandId: 1,
      platform: "facebook",
      platformAccountId: "123456",
      accessToken: "token123",
    })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});

describe("social.disconnect", () => {
  it("allows admin to disconnect a social account", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.social.disconnect({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

// ── User Management Tests ─────────────────────────────────────────────────

describe("user.list", () => {
  it("allows admin to list users", async () => {
    const mockUsers = [{ id: 1, name: "Gerrit" }];
    vi.mocked(db.getAllUsers).mockResolvedValueOnce(mockUsers as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.user.list();
    expect(result).toEqual(mockUsers);
  });

  it("rejects non-admin user listing", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.user.list()).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});

// ── AI Content Tests ──────────────────────────────────────────────────────

describe("ai.generatePost", () => {
  it("generates content for a valid brand", async () => {
    vi.mocked(db.getBrandById).mockResolvedValueOnce({
      id: 1, name: "GMK", voiceSettings: { tone: "Professional", style: "Educational" },
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.ai.generatePost({
      brandId: 1,
      contentType: "hey_tony",
    });
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("suggestedImagePrompt");
  });

  it("rejects generation for non-existent brand", async () => {
    vi.mocked(db.getBrandById).mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.ai.generatePost({
      brandId: 999,
      contentType: "custom",
    })).rejects.toThrow("Brand not found");
  });
});

// ── Analytics Tests ───────────────────────────────────────────────────────

describe("analytics.summary", () => {
  it("returns analytics summary for admin", async () => {
    const mockSummary = { impressions: 100, reach: 50, likes: 20, comments: 5, shares: 3, clicks: 10 };
    vi.mocked(db.getAnalyticsSummary).mockResolvedValueOnce(mockSummary);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.summary({ brandId: 1 });
    expect(result).toEqual(mockSummary);
  });
});

// ── Shopify Tests ─────────────────────────────────────────────────────────

describe("shopify.getConnection", () => {
  it("returns null when no connection exists", async () => {
    vi.mocked(db.getShopifyConnectionByBrandId).mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.shopify.getConnection({ brandId: 1 });
    expect(result).toBeNull();
  });

  it("masks access token in response", async () => {
    vi.mocked(db.getShopifyConnectionByBrandId).mockResolvedValueOnce({
      id: 1, brandId: 1, shopDomain: "test.myshopify.com",
      accessToken: "shpat_secret123", storeName: "Test Store",
      isConnected: true, lastSyncAt: null, createdAt: new Date(), updatedAt: new Date(),
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.shopify.getConnection({ brandId: 1 });
    expect(result).toBeDefined();
    expect(result!.accessToken).toBe("••••••••");
    expect(result!.storeName).toBe("Test Store");
  });

  it("rejects unauthorized client access", async () => {
    vi.mocked(db.getBrandsByClientUserId).mockResolvedValueOnce([]);

    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.shopify.getConnection({ brandId: 1 })).rejects.toThrow("FORBIDDEN");
  });
});

describe("shopify.connect", () => {
  it("allows admin to connect a Shopify store", async () => {
    vi.mocked(db.getShopifyConnectionByBrandId).mockResolvedValueOnce(null);
    vi.mocked(db.createShopifyConnection).mockResolvedValueOnce({ id: 1 } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.shopify.connect({
      brandId: 1,
      shopDomain: "teststore",
      accessToken: "shpat_test123",
    });
    expect(result).toHaveProperty("storeName", "Test Store");
  });

  it("rejects non-admin Shopify connection", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.shopify.connect({
      brandId: 1,
      shopDomain: "test.myshopify.com",
      accessToken: "shpat_test",
    })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});

describe("shopify.disconnect", () => {
  it("allows admin to disconnect Shopify", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.shopify.disconnect({ brandId: 1 });
    expect(result).toEqual({ success: true });
    expect(db.deleteShopifyConnection).toHaveBeenCalledWith(1);
  });
});

describe("shopify.listProducts", () => {
  it("returns products for admin", async () => {
    const mockProducts = [{ id: 1, title: "Product 1" }];
    vi.mocked(db.getShopifyProductsByBrandId).mockResolvedValueOnce(mockProducts as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.shopify.listProducts({ brandId: 1 });
    expect(result).toEqual(mockProducts);
  });
});

// ── Service Spotlight Tests ───────────────────────────────────────────────

describe("service.list", () => {
  it("returns services for admin", async () => {
    const mockServices = [{ id: 1, name: "Roof Repair", brandId: 1 }];
    vi.mocked(db.getServicesByBrandId).mockResolvedValueOnce(mockServices as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.service.list({ brandId: 1 });
    expect(result).toEqual(mockServices);
  });

  it("rejects unauthorized client access", async () => {
    vi.mocked(db.getBrandsByClientUserId).mockResolvedValueOnce([]);

    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.service.list({ brandId: 1 })).rejects.toThrow("FORBIDDEN");
  });
});

describe("service.create", () => {
  it("allows admin to create a service", async () => {
    vi.mocked(db.createService).mockResolvedValueOnce({ id: 1 } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.service.create({
      brandId: 1,
      name: "Roof Repair",
      description: "Full roof repair and replacement",
      serviceAreas: ["Hillsboro", "Beaverton"],
      ctaType: "call",
      ctaPhone: "(503) 555-1234",
    });
    expect(result).toEqual({ id: 1 });
    expect(db.createService).toHaveBeenCalled();
  });

  it("allows premium client to create a service", async () => {
    vi.mocked(db.getBrandById).mockResolvedValueOnce({
      id: 1, clientUserId: 2, clientTier: "premium",
    } as any);
    vi.mocked(db.createService).mockResolvedValueOnce({ id: 1 } as any);

    const caller = appRouter.createCaller(createClientContext("premium"));
    const result = await caller.service.create({
      brandId: 1,
      name: "Deep Cleaning",
      ctaType: "book_online",
    });
    expect(result).toEqual({ id: 1 });
  });

  it("rejects managed client service creation", async () => {
    vi.mocked(db.getBrandById).mockResolvedValueOnce({
      id: 1, clientUserId: 2, clientTier: "managed",
    } as any);

    const caller = appRouter.createCaller(createClientContext("managed"));
    await expect(caller.service.create({
      brandId: 1,
      name: "Test Service",
      ctaType: "visit_website",
    })).rejects.toThrow("Only admin or premium clients can manage services");
  });
});

describe("service.update", () => {
  it("allows admin to update a service", async () => {
    vi.mocked(db.getServiceById).mockResolvedValueOnce({
      id: 1, brandId: 1, name: "Old Name",
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.service.update({ id: 1, name: "New Name" });
    expect(result).toEqual({ success: true });
    expect(db.updateService).toHaveBeenCalledWith(1, { name: "New Name" });
  });

  it("rejects update for non-existent service", async () => {
    vi.mocked(db.getServiceById).mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.service.update({ id: 999, name: "Test" })).rejects.toThrow("NOT_FOUND");
  });
});

describe("service.delete", () => {
  it("allows admin to delete a service", async () => {
    vi.mocked(db.getServiceById).mockResolvedValueOnce({
      id: 1, brandId: 1, name: "Test",
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.service.delete({ id: 1 });
    expect(result).toEqual({ success: true });
    expect(db.deleteService).toHaveBeenCalledWith(1);
  });

  it("rejects managed client service deletion", async () => {
    vi.mocked(db.getServiceById).mockResolvedValueOnce({
      id: 1, brandId: 1, name: "Test",
    } as any);
    vi.mocked(db.getBrandById).mockResolvedValueOnce({
      id: 1, clientUserId: 2, clientTier: "managed",
    } as any);

    const caller = appRouter.createCaller(createClientContext("managed"));
    await expect(caller.service.delete({ id: 1 })).rejects.toThrow("FORBIDDEN");
  });
});

// ── AI with Content Sources Tests ────────────────────────────────────────

describe("ai.generatePost with content sources", () => {
  it("checks Shopify and services when useContentSources is true", async () => {
    vi.mocked(db.getBrandById).mockResolvedValueOnce({
      id: 1, name: "GMK", voiceSettings: { tone: "Professional" },
    } as any);
    vi.mocked(db.getShopifyConnectionByBrandId).mockResolvedValueOnce({
      id: 1, isConnected: true,
    } as any);
    vi.mocked(db.getServicesByBrandId).mockResolvedValueOnce([
      { id: 1, name: "Roof Repair" },
    ] as any);
    vi.mocked(db.getShopifyProductForContent).mockResolvedValueOnce({
      id: 1, title: "Product", description: "Desc", price: "29.99",
      tags: [], collections: [], handle: "product",
    } as any);
    vi.mocked(db.getServiceForContent).mockResolvedValueOnce({
      id: 1, name: "Roof Repair", description: "Fix roofs",
      serviceAreas: ["Hillsboro"], ctaType: "call", ctaPhone: "555-1234",
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.ai.generatePost({
      brandId: 1,
      contentType: "hey_tony",
      useContentSources: true,
    });
    expect(result).toHaveProperty("content");
    expect(db.getShopifyConnectionByBrandId).toHaveBeenCalledWith(1);
    expect(db.getServicesByBrandId).toHaveBeenCalledWith(1);
  });

  it("skips content sources when useContentSources is false", async () => {
    vi.mocked(db.getBrandById).mockResolvedValueOnce({
      id: 1, name: "GMK", voiceSettings: { tone: "Professional" },
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.ai.generatePost({
      brandId: 1,
      contentType: "custom",
      useContentSources: false,
    });
    expect(result).toHaveProperty("content");
    expect(db.getShopifyConnectionByBrandId).not.toHaveBeenCalled();
    expect(db.getServicesByBrandId).not.toHaveBeenCalled();
  });
});

// ── Event Tests ───────────────────────────────────────────────────────────

describe("event.create", () => {
  it("allows admin to create an event", async () => {
    // Admin skips the brand permission check, so no getBrandById mock needed
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.event.create({
      brandId: 1,
      name: "Saturday Night Live at The Venue",
      eventDate: "2026-06-07T20:00:00Z",
      promoLeadDays: [3, 1, 0],
      recurrencePattern: "weekly",
      isRecurring: true,
    });
    expect(result).toHaveProperty("id");
    expect(db.createEvent).toHaveBeenCalled();
  });

  it("rejects event creation for non-existent brand (client gets FORBIDDEN)", async () => {
    // Admin can create for any brand (brand check only happens for non-admins)
    // For clients, a null brand means FORBIDDEN ("Only admin or premium clients can create events")
    vi.mocked(db.getBrandById).mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(createClientContext("managed"));
    await expect(caller.event.create({
      brandId: 999,
      name: "Test Event",
      eventDate: "2026-06-07T20:00:00Z",
    })).rejects.toThrow("Only admin or premium clients can create events");
  });

  it("rejects managed client event creation", async () => {
    vi.mocked(db.getBrandById).mockResolvedValueOnce({
      id: 1, clientUserId: 2, clientTier: "managed",
    } as any);

    const caller = appRouter.createCaller(createClientContext("managed"));
    await expect(caller.event.create({
      brandId: 1,
      name: "Test Event",
      eventDate: "2026-06-07T20:00:00Z",
    })).rejects.toThrow("Only admin or premium clients can create events");
  });

  it("allows premium client to create an event", async () => {
    // Premium client with matching clientUserId=2 can create events
    // createClientContext returns user.id=2, so clientUserId must also be 2
    // The router checks: brand.clientUserId !== ctx.user.id || brand.clientTier !== "premium"
    vi.mocked(db.getBrandById).mockResolvedValueOnce({
      id: 1, name: "Client Brand", clientUserId: 2, clientTier: "premium",
    } as any);
    vi.mocked(db.createEvent).mockResolvedValueOnce({ id: 5 } as any);

    const caller = appRouter.createCaller(createClientContext("premium"));
    // user.id=2 matches clientUserId=2 and tier is premium → should succeed
    const result = await caller.event.create({
      brandId: 1,
      name: "Premium Client Event",
      eventDate: "2026-07-01T18:00:00Z",
      isRecurring: false,
    });
    // The router returns the result from db.createEvent
    expect(result).toBeDefined();
    expect(result).toHaveProperty("id");
  });
});

describe("event.upcoming", () => {
  it("returns upcoming events", async () => {
    const mockEvents = [
      { id: 1, name: "Test Event", eventDate: new Date("2026-06-07"), brandId: 1 },
    ];
    vi.mocked(db.getUpcomingEvents).mockResolvedValueOnce(mockEvents as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.event.upcoming({ days: 30 });
    expect(result).toEqual(mockEvents);
    expect(db.getUpcomingEvents).toHaveBeenCalledWith(undefined, 30);
  });

  it("filters by brandId when provided", async () => {
    vi.mocked(db.getUpcomingEvents).mockResolvedValueOnce([]);

    const caller = appRouter.createCaller(createAdminContext());
    await caller.event.upcoming({ brandId: 1, days: 7 });
    expect(db.getUpcomingEvents).toHaveBeenCalledWith(1, 7);
  });
});

describe("event.delete", () => {
  it("allows admin to delete an event", async () => {
    vi.mocked(db.getEventById).mockResolvedValueOnce({
      id: 1, brandId: 1, name: "Test Event",
    } as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.event.delete({ id: 1 });
    expect(result).toEqual({ success: true });
    expect(db.deleteEvent).toHaveBeenCalledWith(1);
  });

  it("rejects deletion of non-existent event", async () => {
    vi.mocked(db.getEventById).mockResolvedValueOnce(null);

    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.event.delete({ id: 999 })).rejects.toThrow("NOT_FOUND");
  });

  it("rejects non-owner client event deletion", async () => {
    vi.mocked(db.getEventById).mockResolvedValueOnce({
      id: 1, brandId: 1, name: "Test Event",
    } as any);
    // Default getBrandById mock returns null, which triggers FORBIDDEN
    // (null brand means: !brand is true → throw FORBIDDEN)
    // No need to override - the default mock returns null

    const caller = appRouter.createCaller(createClientContext("premium"));
    // getBrandById returns null (default mock) → FORBIDDEN
    await expect(caller.event.delete({ id: 1 })).rejects.toThrow("FORBIDDEN");
  });
});

// ── System Health / Guardrails Tests ─────────────────────────────────────

describe("health.errorLogs", () => {
  it("returns error logs for admin", async () => {
    const mockLogs = [
      { id: 1, type: "post_failure", severity: "error", message: "Failed to post", createdAt: new Date() },
    ];
    vi.mocked(db.getErrorLogs).mockResolvedValueOnce(mockLogs as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.health.errorLogs({ limit: 10 });
    expect(result).toEqual(mockLogs);
    expect(db.getErrorLogs).toHaveBeenCalledWith(10, false);
  });

  it("rejects non-admin access to error logs", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.health.errorLogs({ limit: 10 })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});

describe("health.errorStats", () => {
  it("returns error statistics for admin", async () => {
    const mockStats = { total: 5, errors: 2, warnings: 3, unresolved: 4, last24h: 1 };
    vi.mocked(db.getErrorLogStats).mockResolvedValueOnce(mockStats as any);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.health.errorStats();
    expect(result).toEqual(mockStats);
  });
});

describe("health.checkUnapproved", () => {
  it("checks for unapproved posts approaching publish time", async () => {
    vi.mocked(db.getPostsNeedingApproval).mockResolvedValueOnce([]);

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.health.checkUnapproved({ hoursBeforePublish: 24 });
    // The router returns { reminded } from checkUnapprovedPosts service
    expect(result).toHaveProperty("reminded");
    expect(typeof result.reminded).toBe("number");
  });
});

// ─── Onboarding Router Tests ────────────────────────────────────────────────

describe("onboarding.getState", () => {
  it("returns null when no onboarding state exists", async () => {
    vi.mocked(db.getOnboardingStateByUserId).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(createClientContext());
    const result = await caller.onboarding.getState();
    expect(result).toBeNull();
  });

  it("returns onboarding state when it exists", async () => {
    const mockState = {
      id: 1, userId: 2, currentStep: 3,
      stepData: { step1: { brandName: "Test Brand" } },
      completed: false, approvalStatus: "pending",
      createdAt: new Date(), updatedAt: new Date(),
    };
    vi.mocked(db.getOnboardingStateByUserId).mockResolvedValueOnce(mockState as any);
    const caller = appRouter.createCaller(createClientContext());
    const result = await caller.onboarding.getState();
    expect(result).toEqual(mockState);
  });

  it("rejects unauthenticated access", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    await expect(caller.onboarding.getState()).rejects.toThrow(UNAUTHED_ERR_MSG);
  });
});

describe("onboarding.saveStep", () => {
  it("saves step data for authenticated user", async () => {
    vi.mocked(db.getOnboardingStateByUserId).mockResolvedValueOnce(null);
    vi.mocked(db.upsertOnboardingState).mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createClientContext());
    const result = await caller.onboarding.saveStep({ step: 1, data: { brandName: "My Brand" } });
    expect(result).toEqual({ success: true });
    expect(db.upsertOnboardingState).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ currentStep: 1 })
    );
  });

  it("rejects unauthenticated access", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    await expect(caller.onboarding.saveStep({ step: 1, data: {} })).rejects.toThrow(UNAUTHED_ERR_MSG);
  });
});

describe("onboarding.complete", () => {
  it("creates brand and marks onboarding complete", async () => {
    vi.mocked(db.getBrandCount).mockResolvedValueOnce(0);
    vi.mocked(db.createBrand).mockResolvedValueOnce({ id: 10 } as any);
    vi.mocked(db.completeOnboarding).mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createClientContext());
    const result = await caller.onboarding.complete({
      brandName: "Acme Roofing",
      tone: "professional", style: "direct",
      keywords: ["roofing"], avoidWords: [],
      samplePosts: [], customInstructions: "",
      postsPerDay: 1, autoPost: false,
    });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("brandId");
    expect(db.createBrand).toHaveBeenCalled();
  });

  it("rejects when brand limit is reached", async () => {
    vi.mocked(db.getBrandCount).mockResolvedValueOnce(5);
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.onboarding.complete({
      brandName: "New Brand",
      tone: "professional", style: "direct",
      keywords: [], avoidWords: [],
      samplePosts: [], customInstructions: "",
      postsPerDay: 1, autoPost: false,
    })).rejects.toThrow(/Maximum of 5 brands/);
  });
});

describe("onboarding.getPending (admin)", () => {
  it("returns pending onboardings for admin", async () => {
    const mockPending = [{ id: 1, userId: 2, currentStep: 5, completed: true, approvalStatus: "pending", stepData: {} }];
    vi.mocked(db.getPendingOnboardings).mockResolvedValueOnce(mockPending as any);
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.onboarding.getPending();
    expect(result).toEqual(mockPending);
  });

  it("rejects non-admin access", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.onboarding.getPending()).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});

describe("onboarding.approve (admin)", () => {
  it("approves a pending onboarding", async () => {
    vi.mocked(db.approveOnboarding).mockResolvedValueOnce(undefined);
    vi.mocked(db.getBrandById).mockResolvedValueOnce({ id: 5, name: "Test Brand", clientUserId: 2 } as any);
    const caller = appRouter.createCaller(createAdminContext());
    vi.mocked(db.getOnboardingStateByUserId).mockResolvedValueOnce(null);
    const result = await caller.onboarding.approve({ userId: 2, tier: "premium" });
    expect(result).toHaveProperty("success", true);
    expect(db.approveOnboarding).toHaveBeenCalledWith(2, 1, "premium");
  });

  it("rejects non-admin access", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.onboarding.approve({ userId: 2, tier: "managed" })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});

describe("onboarding.reject (admin)", () => {
  it("rejects a pending onboarding with reason", async () => {
    vi.mocked(db.rejectOnboarding).mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.onboarding.reject({ userId: 2, reason: "Duplicate account" });
    expect(result).toHaveProperty("success", true);
    // router calls rejectOnboarding(userId, adminId, reason)
    expect(db.rejectOnboarding).toHaveBeenCalledWith(2, 1, "Duplicate account");
  });

  it("rejects non-admin access", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.onboarding.reject({ userId: 2, reason: "test" })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});

describe("onboarding.createInvite (admin)", () => {
  it("creates an invite link for a new client", async () => {
    vi.mocked(db.createBrandInvite).mockResolvedValueOnce({
      id: 1, token: "test-token-abc123", tier: "managed",
      brandName: "Invited Brand", email: "client@example.com",
      expiresAt: null, usedAt: null,
    } as any);
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.onboarding.createInvite({
      email: "client@example.com", tier: "managed",
      brandName: "Invited Brand",
    });
    expect(result).toHaveProperty("inviteUrl");
    expect(result.inviteUrl).toContain("test-token-abc123");
  });

  it("rejects non-admin access", async () => {
    const caller = appRouter.createCaller(createClientContext());
    await expect(caller.onboarding.createInvite({
      email: "x@x.com", tier: "managed",
    })).rejects.toThrow(NOT_ADMIN_ERR_MSG);
  });
});
