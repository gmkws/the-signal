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
}));

// ── Mock services ─────────────────────────────────────────────────────────
vi.mock("./services/contentEngine", () => ({
  generatePost: vi.fn().mockResolvedValue({
    content: "Generated post content",
    contentType: "hey_tony",
    suggestedImagePrompt: "A professional image",
  }),
  generatePostImage: vi.fn().mockResolvedValue("https://example.com/image.png"),
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
    loginMethod: "manus",
    role: "admin",
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
    loginMethod: "manus",
    role: "user",
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
