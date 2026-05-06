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
  "product_spotlight",
  "service_highlight",
  "event_teaser",
  "event_reminder",
  "event_day_of",
  "event_recap",
  "custom",
  "carousel_hook_solve",
  "carousel_local_tips",
  "carousel_machine_series",
  "carousel_service_spotlight",
  "carousel_custom",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  hey_tony: "Hey Tony Value Tips",
  hook_solve: "Hook & Solve",
  auditor_showcase: "Auditor Showcase",
  local_tips: "Local Business Tips",
  machine_series: "Your Website Is a Machine",
  print_digital: "Print + Digital",
  product_spotlight: "Shopify Product Spotlight",
  service_highlight: "Service Spotlight",
  event_teaser: "Event Teaser",
  event_reminder: "Event Reminder",
  event_day_of: "Event Day-Of",
  event_recap: "Event Recap",
  custom: "Custom Post",
  carousel_hook_solve: "Carousel: Hook & Solve",
  carousel_local_tips: "Carousel: Local Tips",
  carousel_machine_series: "Carousel: Website Machine",
  carousel_service_spotlight: "Carousel: Service Spotlight",
  carousel_custom: "Carousel: Custom",
};

// ── Event Content Types (subset) ──────────────────────────────────────────

export const EVENT_CONTENT_TYPES = [
  "event_teaser",
  "event_reminder",
  "event_day_of",
  "event_recap",
] as const;

export type EventContentType = (typeof EVENT_CONTENT_TYPES)[number];

// ── Promo Types ───────────────────────────────────────────────────────────

export const PROMO_TYPES = ["teaser", "reminder", "day_of", "recap"] as const;
export type PromoType = (typeof PROMO_TYPES)[number];

export const PROMO_TYPE_LABELS: Record<PromoType, string> = {
  teaser: "Teaser / Announcement",
  reminder: "Reminder / Hype",
  day_of: "Day-Of Push",
  recap: "Post-Event Recap",
};

export const PROMO_TYPE_TO_CONTENT_TYPE: Record<PromoType, EventContentType> = {
  teaser: "event_teaser",
  reminder: "event_reminder",
  day_of: "event_day_of",
  recap: "event_recap",
};

// ── Recurrence Patterns ───────────────────────────────────────────────────

export const RECURRENCE_PATTERNS = ["weekly", "biweekly", "monthly"] as const;
export type RecurrencePattern = (typeof RECURRENCE_PATTERNS)[number];

export const RECURRENCE_PATTERN_LABELS: Record<RecurrencePattern, string> = {
  weekly: "Every Week",
  biweekly: "Every 2 Weeks",
  monthly: "Every Month",
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
export const META_APP_ID = "1660350928634461";
