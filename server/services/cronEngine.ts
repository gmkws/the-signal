/**
 * Cron-based Auto-Posting Engine for The Signal
 *
 * This service handles:
 * 1. Querying posts due to publish (scheduled/approved, scheduledAt <= now)
 * 2. Publishing to Facebook and/or Instagram via Meta Graph API
 * 3. Retry logic (up to 3 attempts) with exponential backoff tracking
 * 4. Token expiration detection
 * 5. Error logging to System Health dashboard
 * 6. Admin email notifications on failure
 */

import {
  getPostsByStatus,
  updatePost,
  getSocialAccountsByBrandId,
  createErrorLog,
  createNotification,
  getAllBrands,
} from "../db";
import { publishToFacebook, publishToInstagram, publishCarouselToFacebook, publishCarouselToInstagram } from "./meta";
import { notifyOwner } from "../_core/notification";

const MAX_RETRIES = 3;

export interface CronRunResult {
  processed: number;
  published: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Check if a Meta API error indicates token expiration
 */
function isTokenExpiredError(errorMessage: string): boolean {
  const tokenExpiredPatterns = [
    "OAuthException",
    "invalid_token",
    "token has expired",
    "Session has expired",
    "Error validating access token",
    "access token",
    "190",
    "102",
  ];
  return tokenExpiredPatterns.some((pattern) =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Get posts that are due to publish right now.
 * Includes posts with status "scheduled" or "approved" where scheduledAt <= now.
 */
async function getDuePostsForPublishing() {
  const now = new Date();

  // Get scheduled posts
  const scheduledPosts = await getPostsByStatus("scheduled");
  const approvedPosts = await getPostsByStatus("approved");

  // Deduplicate by ID (a post shouldn't appear in both lists, but guard anyway)
  const seen = new Set<number>();
  const allPosts = [...scheduledPosts, ...approvedPosts].filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  // Filter to only posts where scheduledAt has passed and retry count < maxx
  return allPosts.filter((post) => {
    if (!post.scheduledAt) return false;
    if (new Date(post.scheduledAt) > now) return false;
    const retryCount = (post as any).retryCount ?? 0;
    if (retryCount >= MAX_RETRIES) return false;
    return true;
  });
}

/**
 * Publish a single post to all configured platforms
 */
async function publishPost(post: any): Promise<{ success: boolean; error?: string }> {
  const platforms: string[] = post.platforms ?? ["facebook"];
  const socialAccounts = await getSocialAccountsByBrandId(post.brandId);

  if (!socialAccounts || socialAccounts.length === 0) {
    return { success: false, error: "No connected social accounts for this brand" };
  }

  let facebookPostId: string | undefined;
  let instagramPostId: string | undefined;
  const errors: string[] = [];

  for (const platform of platforms) {
    try {
      if (platform === "facebook") {
        const fbAccount = socialAccounts.find(
          (a: any) => a.platform === "facebook" && a.isConnected
        );
        if (!fbAccount) {
          errors.push("No connected Facebook account");
          continue;
        }
        if (post.isCarousel && post.carouselSlides?.length >= 2) {
          // Carousel post — use child_attachments
          const slides = (post.carouselSlides as any[]).map((s: any) => ({
            imageUrl: s.imageUrl || "",
            caption: s.headline ? `${s.headline}\n${s.body}` : s.body,
          })).filter((s: any) => s.imageUrl);
          if (slides.length < 2) {
            errors.push("Facebook carousel requires at least 2 slides with images — skipping");
            continue;
          }
          const result = await publishCarouselToFacebook(
            fbAccount.pageId || fbAccount.platformAccountId,
            fbAccount.accessToken ?? "",
            post.content,
            slides
          );
          facebookPostId = result.id;
        } else {
          const result = await publishToFacebook(
            fbAccount.pageId || fbAccount.platformAccountId,
            fbAccount.accessToken ?? "",
            post.content,
            post.imageUrl || undefined
          );
          facebookPostId = result.id;
        }
      } else if (platform === "instagram") {
        const igAccount = socialAccounts.find(
          (a: any) => a.platform === "instagram" && a.isConnected
        );
        if (!igAccount) {
          errors.push("No connected Instagram account");
          continue;
        }
        if (post.isCarousel && post.carouselSlides?.length >= 2) {
          // Carousel post — use Instagram carousel API
          const slides = (post.carouselSlides as any[]).map((s: any) => ({
            imageUrl: s.imageUrl || "",
            caption: s.headline ? `${s.headline}\n${s.body}` : s.body,
          })).filter((s: any) => s.imageUrl);
          if (slides.length < 2) {
            errors.push("Instagram carousel requires at least 2 slides with images — skipping");
            continue;
          }
          const result = await publishCarouselToInstagram(
            igAccount.instagramBusinessId || igAccount.platformAccountId,
            igAccount.accessToken ?? "",
            post.content,
            slides
          );
          instagramPostId = result.id;
        } else {
          if (!post.imageUrl) {
            errors.push("Instagram requires an image — skipping Instagram publish");
            continue;
          }
          const result = await publishToInstagram(
            igAccount.instagramBusinessId || igAccount.platformAccountId,
            igAccount.accessToken ?? "",
            post.content,
            post.imageUrl
          );
          instagramPostId = result.id;
        }
      }
    } catch (err: any) {
      errors.push(`${platform}: ${err.message}`);
    }
  }

  // If at least one platform succeeded, consider it a partial success
  const anySuccess = facebookPostId || instagramPostId;

  if (anySuccess) {
    // Update post with published IDs
    await updatePost(post.id, {
      status: "published",
      publishedAt: new Date(),
      facebookPostId: facebookPostId || post.facebookPostId,
      instagramPostId: instagramPostId || post.instagramPostId,
    });
    return { success: true };
  }

  return { success: false, error: errors.join("; ") };
}

/**
 * Handle a failed post — increment retry count, mark failed after MAX_RETRIES
 */
async function handlePostFailure(
  post: any,
  errorMessage: string
): Promise<void> {
  const currentRetry = (post.retryCount ?? 0) + 1;
  const isTokenExpired = isTokenExpiredError(errorMessage);

  if (currentRetry >= MAX_RETRIES) {
    // Mark as permanently failed
    await updatePost(post.id, {
      status: "failed",
    });

    // Log to System Health
    await createErrorLog({
      brandId: post.brandId,
      postId: post.id,
      errorType: "retry_exhausted",
      severity: "critical",
      message: `Post #${post.id} failed after ${MAX_RETRIES} attempts: ${errorMessage}`,
      details: { postId: post.id, brandId: post.brandId, errorMessage, retryCount: currentRetry },
      retryCount: currentRetry,
      maxRetries: MAX_RETRIES,
      resolved: false,
    });

    // Create in-app notification for admin
    await createNotification({
      brandId: post.brandId,
      postId: post.id,
      type: "post_failed",
      title: "Post Failed to Publish",
      message: `Post #${post.id} failed after ${MAX_RETRIES} attempts and has been marked as failed. Error: ${errorMessage}`,
      toRole: "admin",
      isRead: false,
    });

    // Notify owner via Manus notification system
    await notifyOwner({
      title: `[The Signal] Post Failed — Brand #${post.brandId}`,
      content: `Post #${post.id} for brand #${post.brandId} failed to publish after ${MAX_RETRIES} attempts.\n\nError: ${errorMessage}\n\nPlease check the System Health dashboard.`,
    }).catch(() => {}); // Don't let notification failure break the cron

  } else {
    // Increment retry count in DB so next cron run knows how many attempts have been made
    await updatePost(post.id, {
      retryCount: currentRetry,
      lastFailureReason: errorMessage,
    });

    // Log warning
    await createErrorLog({
      brandId: post.brandId,
      postId: post.id,
      errorType: isTokenExpired ? "token_expired" : "post_failure",
      severity: isTokenExpired ? "critical" : "warning",
      message: `Post #${post.id} publish attempt ${currentRetry}/${MAX_RETRIES} failed: ${errorMessage}`,
      details: { postId: post.id, brandId: post.brandId, errorMessage, retryCount: currentRetry },
      retryCount: currentRetry,
      maxRetries: MAX_RETRIES,
      resolved: false,
    });

    // If token expired, notify admin immediately
    if (isTokenExpired) {
      await createNotification({
        brandId: post.brandId,
      type: "system",
      title: "Social Account Token Expired",
      message: `The access token for brand #${post.brandId} has expired. Please reconnect your Facebook/Instagram account to resume posting.`,
      toRole: "admin",
        isRead: false,
      });

      await notifyOwner({
        title: `[The Signal] Token Expired — Brand #${post.brandId}`,
        content: `The Meta API access token for brand #${post.brandId} has expired.\n\nPlease go to Integrations and reconnect the social accounts to resume auto-posting.`,
      }).catch(() => {});
    }
  }
}

/**
 * Check for posts approaching their scheduled time that are still unapproved
 * (for brands where auto-post is OFF — posts need manual approval)
 */
async function checkUnapprovedApproachingPosts(): Promise<void> {
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  try {
    const pendingPosts = await getPostsByStatus("pending_review");
    const approaching = pendingPosts.filter((post: any) => {
      if (!post.scheduledAt) return false;
      const scheduledTime = new Date(post.scheduledAt);
      return scheduledTime > now && scheduledTime <= twoHoursFromNow;
    });

    for (const post of approaching) {
      // Create reminder notification
      await createNotification({
        brandId: post.brandId,
        postId: post.id,
      type: "approval",
      title: "Post Needs Approval Soon",
      message: `A post scheduled for ${new Date(post.scheduledAt!).toLocaleString()} still needs your approval. Review it before it's time to publish.`,
      toRole: "client",
        isRead: false,
      }).catch(() => {});
    }
  } catch {
    // Non-critical — don't break the main cron run
  }
}

/**
 * Check for social accounts with tokens expiring soon (within 7 days)
 */
async function checkTokenExpiry(): Promise<void> {
  try {
    const brands = await getAllBrands();
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    for (const brand of brands) {
      const accounts = await getSocialAccountsByBrandId(brand.id);
      for (const account of accounts) {
        if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) <= sevenDaysFromNow) {
          await createNotification({
            brandId: brand.id,
      type: "system",
      title: "Social Account Token Expiring Soon",
      message: `The ${account.platform} access token for "${brand.name}" expires on ${new Date(account.tokenExpiresAt).toLocaleDateString()}. Reconnect soon to avoid posting interruptions.`,
      toRole: "admin",
            isRead: false,
          }).catch(() => {});
        }
      }
    }
  } catch {
    // Non-critical
  }
}

/**
 * Main cron job runner — call this every 5 minutes
 */
export async function runCronPublisher(): Promise<CronRunResult> {
  const result: CronRunResult = {
    processed: 0,
    published: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Get all posts due for publishing
    const duePosts = await getDuePostsForPublishing();
    result.processed = duePosts.length;

    if (duePosts.length === 0) {
      // Still run secondary checks even if no posts to publish
      await checkUnapprovedApproachingPosts();
      await checkTokenExpiry();
      return result;
    }

    // Log cron run start
    await createErrorLog({
      errorType: "system",
      severity: "info",
      message: `Cron publisher started: ${duePosts.length} posts due for publishing`,
      details: { postIds: duePosts.map((p: any) => p.id), timestamp: new Date().toISOString() },
      resolved: true,
    }).catch(() => {});

    // Process each due post
    for (const post of duePosts) {
      try {
        const publishResult = await publishPost(post);

        if (publishResult.success) {
          result.published++;

          // Log success
          await createErrorLog({
            brandId: post.brandId,
            postId: post.id,
            errorType: "system",
            severity: "info",
            message: `Post #${post.id} published successfully`,
            details: { postId: post.id, brandId: post.brandId, platforms: post.platforms },
            resolved: true,
          }).catch(() => {});
        } else {
          result.failed++;
          result.errors.push(`Post #${post.id}: ${publishResult.error}`);
          await handlePostFailure(post, publishResult.error || "Unknown error");
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`Post #${post.id}: ${err.message}`);
        await handlePostFailure(post, err.message);
      }
    }

    // Run secondary checks
    await checkUnapprovedApproachingPosts();
    await checkTokenExpiry();

    // Log cron run completion
    await createErrorLog({
      errorType: "system",
      severity: result.failed > 0 ? "warning" : "info",
      message: `Cron publisher completed: ${result.published} published, ${result.failed} failed, ${result.skipped} skipped`,
      details: { ...result, timestamp: new Date().toISOString() },
      resolved: true,
    }).catch(() => {});

  } catch (err: any) {
    result.errors.push(`Cron engine error: ${err.message}`);

    await createErrorLog({
      errorType: "system",
      severity: "critical",
      message: `Cron publisher crashed: ${err.message}`,
      details: { error: err.message, stack: err.stack },
      resolved: false,
    }).catch(() => {});
  }

  return result;
}

/**
 * Start the in-process scheduler using setInterval.
 * Used as a fallback when Railway cron jobs are not configured.
 * Runs every 5 minutes.
 */
export function startInProcessScheduler(): NodeJS.Timeout {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  console.log("[CronEngine] In-process scheduler started (every 5 minutes)");

  const interval = setInterval(async () => {
    try {
      const result = await runCronPublisher();
      if (result.processed > 0) {
        console.log(
          `[CronEngine] Run complete: ${result.published} published, ${result.failed} failed`
        );
      }
    } catch (err: any) {
      console.error("[CronEngine] Scheduler error:", err.message);
    }
  }, INTERVAL_MS);

  // Run once immediately on startup (with a short delay to let DB connect)
  setTimeout(async () => {
    try {
      await runCronPublisher();
    } catch (err: any) {
      console.error("[CronEngine] Initial run error:", err.message);
    }
  }, 10000); // 10 second delay on startup

  return interval;
}
