/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// ── Content Types ──────────────────────────────────────────────────────────

export const CONTENT_TYPES = [
  "hey_tony",
  "hook_solve",
  "auditor_showcase",
  "local_tips",
  "machine_series",
  "print_digital",
  "shopify_product",
  "service_spotlight",
  "custom",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  hey_tony: "Hey Tony Value Tips",
  hook_solve: "Hook & Solve",
  auditor_showcase: "Auditor Showcase",
  local_tips: "Local Business Tips",
  machine_series: "Your Website Is a Machine",
  print_digital: "Print + Digital",
  shopify_product: "Shopify Product Spotlight",
  service_spotlight: "Service Spotlight",
  custom: "Custom Post",
};

// ── Post Statuses ──────────────────────────────────────────────────────────

export const POST_STATUSES = [
  "draft",
  "scheduled",
  "pending_review",
  "approved",
  "published",
  "failed",
  "paused",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  pending_review: "Pending Review",
  approved: "Approved",
  published: "Published",
  failed: "Failed",
  paused: "Paused",
};

// ── Client Tiers ───────────────────────────────────────────────────────────

export const CLIENT_TIERS = ["managed", "premium"] as const;
export type ClientTier = (typeof CLIENT_TIERS)[number];

// ── Platforms ──────────────────────────────────────────────────────────────

export const PLATFORMS = ["facebook", "instagram"] as const;
export type Platform = (typeof PLATFORMS)[number];

// ── CTA Types ──────────────────────────────────────────────────────────────

export const CTA_TYPES = ["call", "book_online", "dm", "visit_website", "custom"] as const;
export type CtaType = (typeof CTA_TYPES)[number];

export const CTA_TYPE_LABELS: Record<CtaType, string> = {
  call: "Call Now",
  book_online: "Book Online",
  dm: "Send a DM",
  visit_website: "Visit Website",
  custom: "Custom CTA",
};

// ── Constants ──────────────────────────────────────────────────────────────

export const MAX_BRANDS = 5;
export const META_APP_ID = "868128566280243";
