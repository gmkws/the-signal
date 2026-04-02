/**
 * Failure Guardrails & Notification Service
 *
 * Handles post failure retry logic, token expiration detection,
 * content generation fallbacks, and email notifications.
 */

import { notifyOwner } from "../_core/notification";
import * as db from "../db";

// ── Post Failure Handling ──────────────────────────────────────────────────

const MAX_RETRIES = 3;

export interface PostFailureResult {
  shouldRetry: boolean;
  retryCount: number;
  errorLogId: number;
}

/**
 * Handle a post that failed to publish.
 * Marks as failed, creates error log, and retries up to MAX_RETRIES times.
 */
export async function handlePostFailure(
  postId: number,
  brandId: number,
  error: string,
  details?: Record<string, any>
): Promise<PostFailureResult> {
  // Get current retry count from error logs
  const existingLogs = await db.getErrorLogsByPost(postId);
  const retryCount = existingLogs.filter(l => l.errorType === "post_failure").length;

  const shouldRetry = retryCount < MAX_RETRIES;

  // Create error log
  const errorLog = await db.createErrorLog({
    brandId,
    postId,
    errorType: "post_failure",
    severity: shouldRetry ? "warning" : "critical",
    message: shouldRetry
      ? `Post failed (attempt ${retryCount + 1}/${MAX_RETRIES}): ${error}`
      : `Post failed after ${MAX_RETRIES} retries: ${error}`,
    details: { ...details, retryCount: retryCount + 1, maxRetries: MAX_RETRIES },
    retryCount: retryCount + 1,
    maxRetries: MAX_RETRIES,
  });

  // Update post status
  await db.updatePost(postId, { status: "failed" });

  // Create notification for admin
  await db.createNotification({
    brandId,
    postId,
    type: "post_failed",
    title: shouldRetry ? "Post Failed — Retrying" : "Post Failed — Retries Exhausted",
    message: shouldRetry
      ? `A post failed to publish (attempt ${retryCount + 1}/${MAX_RETRIES}). Auto-retrying...`
      : `A post has failed after ${MAX_RETRIES} attempts. Manual intervention required.`,
    toRole: "admin",
  });

  // Email admin for critical failures
  if (!shouldRetry) {
    await notifyOwner({
      title: "🚨 Post Failed — Retries Exhausted",
      content: `Post #${postId} for brand #${brandId} has failed after ${MAX_RETRIES} attempts.\n\nError: ${error}\n\nPlease check the System Health dashboard for details.`,
    });
  }

  return { shouldRetry, retryCount: retryCount + 1, errorLogId: errorLog.id };
}

// ── Token Expiration Detection ─────────────────────────────────────────────

export interface TokenStatus {
  isValid: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
  platform: string;
  accountName: string;
}

/**
 * Check if a social account token is expired or expiring soon.
 * Meta tokens typically expire in 60 days.
 */
export async function checkTokenStatus(socialAccountId: number): Promise<TokenStatus> {
  const account = await db.getSocialAccountById(socialAccountId);
  if (!account) {
    return { isValid: false, isExpiringSoon: false, daysUntilExpiry: null, platform: "unknown", accountName: "unknown" };
  }

  // If no token, it's invalid
  if (!account.accessToken) {
    return { isValid: false, isExpiringSoon: false, daysUntilExpiry: null, platform: account.platform, accountName: account.accountName || "Unknown" };
  }

  // Check token expiry (Meta tokens last ~60 days from issue)
  const tokenAge = account.tokenExpiresAt
    ? new Date(account.tokenExpiresAt).getTime() - Date.now()
    : null;

  const daysUntilExpiry = tokenAge ? Math.floor(tokenAge / (1000 * 60 * 60 * 24)) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7;
  const isValid = daysUntilExpiry === null || daysUntilExpiry > 0;

  return {
    isValid,
    isExpiringSoon,
    daysUntilExpiry,
    platform: account.platform,
    accountName: account.accountName || "Unknown",
  };
}

/**
 * Check all social accounts for a brand and return token health.
 */
export async function checkBrandTokenHealth(brandId: number): Promise<{
  healthy: TokenStatus[];
  expiring: TokenStatus[];
  expired: TokenStatus[];
}> {
  const accounts = await db.getSocialAccountsByBrandId(brandId);
  const results = { healthy: [] as TokenStatus[], expiring: [] as TokenStatus[], expired: [] as TokenStatus[] };

  for (const account of accounts) {
    const status = await checkTokenStatus(account.id);
    if (!status.isValid) {
      results.expired.push(status);
    } else if (status.isExpiringSoon) {
      results.expiring.push(status);
    } else {
      results.healthy.push(status);
    }
  }

  // Notify admin about expiring/expired tokens
  if (results.expired.length > 0) {
    const expiredNames = results.expired.map(t => `${t.platform}: ${t.accountName}`).join(", ");
    await db.createErrorLog({
      brandId,
      errorType: "token_expired",
      severity: "critical",
      message: `Expired tokens detected: ${expiredNames}`,
      details: { expired: results.expired },
    });

    await notifyOwner({
      title: "⚠️ Social Account Token Expired",
      content: `Brand #${brandId} has expired tokens for: ${expiredNames}.\n\nPlease reconnect the accounts in the Integrations page.`,
    });
  }

  if (results.expiring.length > 0) {
    const expiringNames = results.expiring.map(t => `${t.platform}: ${t.accountName} (${t.daysUntilExpiry}d)`).join(", ");
    await db.createErrorLog({
      brandId,
      errorType: "token_expired",
      severity: "warning",
      message: `Tokens expiring soon: ${expiringNames}`,
      details: { expiring: results.expiring },
    });
  }

  return results;
}

// ── Unapproved Post Reminders ──────────────────────────────────────────────

/**
 * Check for posts approaching their scheduled time that haven't been approved.
 * Sends reminders to clients and notifications to admin.
 */
export async function checkUnapprovedPosts(hoursBeforePublish = 24): Promise<number> {
  const now = new Date();
  const threshold = new Date(now.getTime() + hoursBeforePublish * 60 * 60 * 1000);

  const pendingPosts = await db.getPostsNeedingApproval(threshold);
  let reminded = 0;

  for (const post of pendingPosts) {
    // Notify client
    await db.createNotification({
      brandId: post.brandId,
      postId: post.id,
      type: "system",
      title: "Post Needs Approval",
      message: `A post scheduled for ${new Date(post.scheduledAt!).toLocaleString()} needs your approval. Please review it soon.`,
      toRole: "client",
    });

    // Notify admin
    await db.createNotification({
      brandId: post.brandId,
      postId: post.id,
      type: "system",
      title: "Unapproved Post Approaching Deadline",
      message: `Post #${post.id} is scheduled for ${new Date(post.scheduledAt!).toLocaleString()} but hasn't been approved yet.`,
      toRole: "admin",
    });

    reminded++;
  }

  return reminded;
}

// ── Content Generation Fallback ────────────────────────────────────────────

const FALLBACK_TEMPLATES: Record<string, string[]> = {
  hey_tony: [
    "Quick tip from {brandName}: Your website should load in under 3 seconds. If it doesn't, you're losing customers. 💡\n\n#WebTips #{location}Business",
    "Hey {location} business owners — when's the last time you checked your website on mobile? 📱 Over 60% of your customers are browsing from their phone.\n\n#MobileFriendly #{location}",
  ],
  hook_solve: [
    "Problem: Your website looks great but nobody can find it.\nSolution: SEO isn't optional anymore — it's how customers find you.\n\nLet's fix that. 🔧\n\n#{location}SEO #SmallBusiness",
    "Problem: You're posting on social media but getting zero engagement.\nSolution: It's not about posting more — it's about posting smarter.\n\n#{location}Marketing #SocialMedia",
  ],
  local_tips: [
    "Supporting local businesses in {location} is what we do. Here's a tip: Make sure your Google Business Profile is up to date — it's free and it works. 📍\n\n#{location}Business #LocalSEO",
    "{location} business owners: Your online reputation matters. Ask happy customers for reviews — it's the easiest marketing win. ⭐\n\n#{location} #SmallBusiness",
  ],
  service_highlight: [
    "Looking for {serviceName} in {location}? We've got you covered. Professional service, local expertise. {ctaText}\n\n#{location} #{serviceName}",
    "{serviceName} done right. Serving {location} and surrounding areas. {ctaText}\n\n#Professional #{location}Business",
  ],
  product_spotlight: [
    "Check out {productName} — now available! {ctaText}\n\n#NewProduct #ShopLocal",
    "Featured: {productName}. Quality you can trust. {ctaText}\n\n#Featured #ShopNow",
  ],
  custom: [
    "At {brandName}, we believe in delivering value first. Follow us for tips, insights, and updates. 💼\n\n#{location}Business",
    "{brandName} — your trusted partner in {location}. Let's build something great together. 🤝\n\n#{location} #Business",
  ],
};

/**
 * Generate a fallback template-based post when AI generation fails.
 */
export function generateFallbackPost(
  contentType: string,
  brandName: string,
  location: string,
  extraVars?: Record<string, string>
): string {
  const templates = FALLBACK_TEMPLATES[contentType] || FALLBACK_TEMPLATES.custom;
  const template = templates[Math.floor(Math.random() * templates.length)];

  let result = template
    .replace(/{brandName}/g, brandName)
    .replace(/{location}/g, location || "your area");

  if (extraVars) {
    for (const [key, value] of Object.entries(extraVars)) {
      result = result.replace(new RegExp(`{${key}}`, "g"), value);
    }
  }

  // Clean up any remaining template vars
  result = result.replace(/{[^}]+}/g, "");

  return result;
}

/**
 * Handle content generation failure with fallback and notification.
 */
export async function handleContentGenerationFailure(
  brandId: number,
  contentType: string,
  error: string,
  brandName: string,
  location: string
): Promise<{ fallbackContent: string; errorLogId: number }> {
  const errorLog = await db.createErrorLog({
    brandId,
    errorType: "content_generation_failure",
    severity: "warning",
    message: `AI content generation failed for type "${contentType}": ${error}`,
    details: { contentType, error },
  });

  await db.createNotification({
    brandId,
    type: "system",
    title: "AI Content Generation Failed",
    message: `Failed to generate ${contentType} content. A template-based fallback was used instead.`,
    toRole: "admin",
  });

  const fallbackContent = generateFallbackPost(contentType, brandName, location);

  return { fallbackContent, errorLogId: errorLog.id };
}
