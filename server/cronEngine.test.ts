/**
 * Tests for the Cron-based Auto-Posting Engine
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { runCronPublisher, startInProcessScheduler } from "./services/cronEngine";

// ── Mock dependencies ──────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getPostsByStatus: vi.fn().mockResolvedValue([]),
  updatePost: vi.fn().mockResolvedValue(undefined),
  getSocialAccountsByBrandId: vi.fn().mockResolvedValue([]),
  createErrorLog: vi.fn().mockResolvedValue({ id: 1 }),
  createNotification: vi.fn().mockResolvedValue({ id: 1 }),
  getAllBrands: vi.fn().mockResolvedValue([]),
}));

vi.mock("./services/meta", () => ({
  publishToFacebook: vi.fn().mockResolvedValue({ id: "fb_post_123" }),
  publishToInstagram: vi.fn().mockResolvedValue({ id: "ig_post_456" }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ── Import mocked modules ──────────────────────────────────────────────────
import * as db from "./db";
import * as meta from "./services/meta";
import * as notification from "./_core/notification";

// ── Helper factories ───────────────────────────────────────────────────────
function makePost(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    brandId: 1,
    content: "Test post content",
    imageUrl: null,
    platforms: ["facebook"],
    status: "scheduled",
    scheduledAt: new Date(Date.now() - 60_000), // 1 minute ago (due)
    publishedAt: null,
    facebookPostId: null,
    instagramPostId: null,
    retryCount: 0,
    ...overrides,
  };
}

function makeSocialAccount(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    brandId: 1,
    platform: "facebook",
    platformAccountId: "page_123",
    accountName: "GMK Web Solutions",
    accessToken: "valid_token_abc",
    tokenExpiresAt: null,
    pageId: "page_123",
    instagramBusinessId: null,
    isConnected: true,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("runCronPublisher", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish default mock implementations after reset
    vi.mocked(db.getPostsByStatus).mockResolvedValue([]);
    vi.mocked(db.updatePost).mockResolvedValue(undefined);
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([]);
    vi.mocked(db.createErrorLog).mockResolvedValue({ id: 1 } as any);
    vi.mocked(db.createNotification).mockResolvedValue({ id: 1 } as any);
    vi.mocked(db.getAllBrands).mockResolvedValue([]);
    vi.mocked(meta.publishToFacebook).mockResolvedValue({ id: "fb_post_123" });
    vi.mocked(meta.publishToInstagram).mockResolvedValue({ id: "ig_post_456" });
    vi.mocked(notification.notifyOwner).mockResolvedValue(true);
  });

  it("returns empty result when no posts are due", async () => {
    vi.mocked(db.getPostsByStatus).mockResolvedValue([]);

    const result = await runCronPublisher();

    expect(result.processed).toBe(0);
    expect(result.published).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("skips posts scheduled in the future", async () => {
    const futurePost = makePost({
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    });
    vi.mocked(db.getPostsByStatus).mockResolvedValue([futurePost]);

    const result = await runCronPublisher();

    expect(result.processed).toBe(0);
    expect(result.published).toBe(0);
    expect(meta.publishToFacebook).not.toHaveBeenCalled();
  });

  it("skips posts that have already hit max retries", async () => {
    const exhaustedPost = makePost({ retryCount: 3 });
    vi.mocked(db.getPostsByStatus).mockResolvedValue([exhaustedPost]);

    const result = await runCronPublisher();

    expect(result.processed).toBe(0);
    expect(meta.publishToFacebook).not.toHaveBeenCalled();
  });

  it("publishes a due scheduled post to Facebook", async () => {
    const post = makePost();
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return [post];
      return [];
    });
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([makeSocialAccount()]);

    const result = await runCronPublisher();

    expect(result.processed).toBe(1);
    expect(result.published).toBe(1);
    expect(result.failed).toBe(0);
    expect(meta.publishToFacebook).toHaveBeenCalledWith(
      "page_123",
      "valid_token_abc",
      "Test post content",
      undefined
    );
    expect(db.updatePost).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: "published" })
    );
  });

  it("publishes a due approved post", async () => {
    const post = makePost({ status: "approved" });
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "approved") return [post];
      return [];
    });
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([makeSocialAccount()]);

    const result = await runCronPublisher();

    expect(result.published).toBe(1);
    expect(meta.publishToFacebook).toHaveBeenCalled();
  });

  it("publishes to Instagram when platform is instagram and image is present", async () => {
    const post = makePost({
      platforms: ["instagram"],
      imageUrl: "https://example.com/image.jpg",
    });
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return [post];
      return [];
    });
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([
      makeSocialAccount({
        platform: "instagram",
        instagramBusinessId: "ig_biz_789",
      }),
    ]);

    const result = await runCronPublisher();

    expect(result.published).toBe(1);
    expect(meta.publishToInstagram).toHaveBeenCalledWith(
      "ig_biz_789",
      "valid_token_abc",
      "Test post content",
      "https://example.com/image.jpg"
    );
  });

  it("skips Instagram publish when no image is provided", async () => {
    const post = makePost({
      platforms: ["instagram"],
      imageUrl: null, // No image
    });
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return [post];
      return [];
    });
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([
      makeSocialAccount({ platform: "instagram" }),
    ]);

    const result = await runCronPublisher();

    // No platform succeeded, so it's a failure
    expect(result.failed).toBe(1);
    expect(meta.publishToInstagram).not.toHaveBeenCalled();
  });

  it("marks post as failed after MAX_RETRIES (3) attempts", async () => {
    const post = makePost({ retryCount: 2 }); // On 3rd attempt
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return [post];
      return [];
    });
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([]);

    const result = await runCronPublisher();

    expect(result.failed).toBe(1);
    expect(db.updatePost).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: "failed" })
    );
    expect(db.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "post_failed" })
    );
    expect(notification.notifyOwner).toHaveBeenCalled();
  });

  it("logs error and creates notification when no social accounts are connected", async () => {
    const post = makePost();
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return [post];
      return [];
    });
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([]); // No accounts

    const result = await runCronPublisher();

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain("No connected social accounts");
    expect(db.createErrorLog).toHaveBeenCalled();
  });

  it("handles token expiration errors and notifies admin", async () => {
    const post = makePost({ retryCount: 0 });
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return [post];
      return [];
    });
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([makeSocialAccount()]);
    vi.mocked(meta.publishToFacebook).mockRejectedValue(
      new Error("OAuthException: Error validating access token")
    );

    const result = await runCronPublisher();

    expect(result.failed).toBe(1);
    // Should log a token_expired error
    expect(db.createErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({ errorType: "token_expired" })
    );
    // Should notify admin about token expiration
    expect(db.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "system",
        title: expect.stringContaining("Token Expired"),
      })
    );
    expect(notification.notifyOwner).toHaveBeenCalled();
  });

  it("processes multiple posts in a single run", async () => {
    const posts = [
      makePost({ id: 1 }),
      makePost({ id: 2, content: "Second post", scheduledAt: new Date(Date.now() - 120_000) }),
      makePost({ id: 3, content: "Third post", scheduledAt: new Date(Date.now() - 180_000) }),
    ];
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return posts;
      return [];
    });
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([makeSocialAccount()]);

    const result = await runCronPublisher();

    expect(result.processed).toBe(3);
    expect(result.published).toBe(3);
    expect(meta.publishToFacebook).toHaveBeenCalledTimes(3);
  });

  it("continues processing remaining posts even if one fails", async () => {
    const posts = [
      makePost({ id: 1 }),
      makePost({ id: 2, content: "Second post" }),
    ];
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return posts;
      return [];
    });
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([makeSocialAccount()]);
    vi.mocked(meta.publishToFacebook)
      .mockRejectedValueOnce(new Error("API rate limit exceeded"))
      .mockResolvedValueOnce({ id: "fb_post_success" });

    const result = await runCronPublisher();

    expect(result.processed).toBe(2);
    expect(result.published).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("handles a post with no scheduledAt gracefully", async () => {
    const post = makePost({ scheduledAt: null });
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return [post];
      return [];
    });

    const result = await runCronPublisher();

    expect(result.processed).toBe(0); // Filtered out
    expect(meta.publishToFacebook).not.toHaveBeenCalled();
  });

  it("logs cron run start and completion to error_logs", async () => {
    const post = makePost();
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return [post];
      return [];
    });
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([makeSocialAccount()]);

    await runCronPublisher();

    // Should have logged at least start + per-post success + completion
    const logCalls = vi.mocked(db.createErrorLog).mock.calls.map((c) => c[0]);
    const messages = logCalls.map((c: any) => c.message);
    expect(messages.some((m: string) => m.includes("Cron publisher started"))).toBe(true);
    expect(messages.some((m: string) => m.includes("published successfully") || m.includes("Cron publisher completed"))).toBe(true);
  });

  it("uses pageId when available, falls back to platformAccountId", async () => {
    const post = makePost();
    vi.mocked(db.getPostsByStatus).mockImplementation(async (status: string) => {
      if (status === "scheduled") return [post];
      return [];
    });
    // Account with pageId set
    vi.mocked(db.getSocialAccountsByBrandId).mockResolvedValue([
      makeSocialAccount({ pageId: "specific_page_id", platformAccountId: "fallback_id" }),
    ]);

    await runCronPublisher();

    expect(meta.publishToFacebook).toHaveBeenCalledWith(
      "specific_page_id", // Should use pageId
      expect.any(String),
      expect.any(String),
      undefined
    );
  });
});

describe("startInProcessScheduler", () => {
  it("returns a NodeJS.Timeout interval handle", () => {
    const handle = startInProcessScheduler();
    expect(handle).toBeDefined();
    clearInterval(handle);
  });
});
