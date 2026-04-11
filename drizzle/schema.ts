import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, json } from "drizzle-orm/mysql-core";

// ── Users ──────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Standalone email/password auth
  passwordHash: varchar("passwordHash", { length: 255 }),
  passwordResetToken: varchar("passwordResetToken", { length: 255 }),
  passwordResetExpires: timestamp("passwordResetExpires"),
  // Stripe subscription
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripeSubscriptionStatus: varchar("stripeSubscriptionStatus", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Brands ─────────────────────────────────────────────────────────────────
export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  logoUrl: text("logoUrl"),
  industry: varchar("industry", { length: 100 }),
  location: varchar("location", { length: 200 }),
  website: varchar("website", { length: 500 }),
  // Brand voice settings stored as JSON
  voiceSettings: json("voiceSettings").$type<{
    tone: string;
    style: string;
    keywords: string[];
    avoidWords: string[];
    samplePosts: string[];
    customInstructions: string;
  }>(),
  // Client tier: managed or premium
  clientTier: mysqlEnum("clientTier", ["managed", "premium"]).default("managed").notNull(),
  // Auto-post toggle
  autoPostEnabled: boolean("autoPostEnabled").default(false).notNull(),
  // Assigned client user ID (nullable for admin-only brands)
  clientUserId: int("clientUserId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

// ── Social Accounts ────────────────────────────────────────────────────────
export const socialAccounts = mysqlTable("social_accounts", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  platform: mysqlEnum("platform", ["facebook", "instagram", "google_business"]).notNull(),
  platformAccountId: varchar("platformAccountId", { length: 200 }).notNull(),
  accountName: varchar("accountName", { length: 300 }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  pageId: varchar("pageId", { length: 200 }),
  instagramBusinessId: varchar("instagramBusinessId", { length: 200 }),
  gbpLocationId: varchar("gbpLocationId", { length: 200 }),
  isConnected: boolean("isConnected").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type InsertSocialAccount = typeof socialAccounts.$inferInsert;

// ── Posts ───────────────────────────────────────────────────────────────────
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  // Content
  content: text("content").notNull(),
  imageUrl: text("imageUrl"),
  // Content type categorization
  contentType: mysqlEnum("contentType", [
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
    "custom"
  ]).default("custom").notNull(),
  // Scheduling
  scheduledAt: timestamp("scheduledAt"),
  publishedAt: timestamp("publishedAt"),
  // Status workflow
  status: mysqlEnum("status", [
    "draft",
    "scheduled",
    "pending_review",
    "approved",
    "published",
    "failed",
    "paused"
  ]).default("draft").notNull(),
  // Platforms to post to
  platforms: json("platforms").$type<string[]>(),
  // Meta API response data
  facebookPostId: varchar("facebookPostId", { length: 200 }),
  instagramPostId: varchar("instagramPostId", { length: 200 }),
  // Google Business Profile API response data
  googleBusinessPostId: varchar("googleBusinessPostId", { length: 200 }),
  // Retry tracking for failed posts
  retryCount: int("retryCount").default(0).notNull(),
  lastFailureReason: text("lastFailureReason"),
  // Carousel support
  isCarousel: boolean("isCarousel").default(false).notNull(),
  carouselSlides: json("carouselSlides").$type<Array<{
    headline: string;
    body: string;
    imagePrompt: string;
    imageUrl?: string;
    uploadedImageUrl?: string;
  }>>(),
  // User-uploaded media override (takes priority over AI-generated imageUrl)
  uploadedMediaUrl: text("uploadedMediaUrl"),
  uploadedMediaType: mysqlEnum("uploadedMediaType", ["image", "video"]),
  // AI generation metadata
  aiGenerated: boolean("aiGenerated").default(false).notNull(),
  // Who created/modified
  createdBy: int("createdBy"),
  lastEditedBy: int("lastEditedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

// ── Notifications ──────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  postId: int("postId"),
  type: mysqlEnum("type", [
    "pause_request",
    "edit_request",
    "approval",
    "rejection",
    "post_published",
    "post_failed",
    "system"
  ]).notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  message: text("message"),
  // Who triggered it
  fromUserId: int("fromUserId"),
  // Who should see it
  toRole: mysqlEnum("toRole", ["admin", "client"]).default("admin").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ── Analytics Snapshots ────────────────────────────────────────────────────
export const analyticsSnapshots = mysqlTable("analytics_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  postId: int("postId"),
  platform: mysqlEnum("platform", ["facebook", "instagram"]).notNull(),
  impressions: int("impressions").default(0),
  reach: int("reach").default(0),
  engagement: int("engagement").default(0),
  likes: int("likes").default(0),
  comments: int("comments").default(0),
  shares: int("shares").default(0),
  clicks: int("clicks").default(0),
  snapshotDate: timestamp("snapshotDate").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;
export type InsertAnalyticsSnapshot = typeof analyticsSnapshots.$inferInsert;


// ── Shopify Connections ────────────────────────────────────────────────────
export const shopifyConnections = mysqlTable("shopify_connections", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull().unique(), // One Shopify store per brand
  shopDomain: varchar("shopDomain", { length: 300 }).notNull(), // e.g., "mystore.myshopify.com"
  accessToken: text("accessToken").notNull(),
  storeName: varchar("storeName", { length: 300 }),
  isConnected: boolean("isConnected").default(true).notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShopifyConnection = typeof shopifyConnections.$inferSelect;
export type InsertShopifyConnection = typeof shopifyConnections.$inferInsert;

// ── Shopify Products ───────────────────────────────────────────────────────
export const shopifyProducts = mysqlTable("shopify_products", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  shopifyProductId: varchar("shopifyProductId", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  handle: varchar("handle", { length: 300 }),
  productType: varchar("productType", { length: 200 }),
  vendor: varchar("vendor", { length: 200 }),
  tags: json("tags").$type<string[]>(),
  // Primary image URL
  imageUrl: text("imageUrl"),
  // All image URLs
  images: json("images").$type<string[]>(),
  // Price info
  price: varchar("price", { length: 50 }),
  compareAtPrice: varchar("compareAtPrice", { length: 50 }),
  // Inventory
  inventoryQuantity: int("inventoryQuantity"),
  // Collection names
  collections: json("collections").$type<string[]>(),
  // Status
  status: varchar("status", { length: 50 }).default("active"),
  // Used for content generation tracking
  lastUsedInPostAt: timestamp("lastUsedInPostAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShopifyProduct = typeof shopifyProducts.$inferSelect;
export type InsertShopifyProduct = typeof shopifyProducts.$inferInsert;

// ── Service Spotlight ──────────────────────────────────────────────────────
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  // Service details
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  // Service areas (cities, regions)
  serviceAreas: json("serviceAreas").$type<string[]>(),
  // Specials/seasonal offers
  specials: text("specials"),
  // CTA info
  ctaType: mysqlEnum("ctaType", ["call", "book_online", "dm", "visit_website", "custom"]).default("visit_website"),
  ctaText: varchar("ctaText", { length: 200 }),
  ctaLink: varchar("ctaLink", { length: 500 }),
  ctaPhone: varchar("ctaPhone", { length: 50 }),
  // Before/after or project images
  images: json("images").$type<string[]>(),
  // Display order
  displayOrder: int("displayOrder").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  // Used for content generation tracking
  lastUsedInPostAt: timestamp("lastUsedInPostAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// ── Events ────────────────────────────────────────────────────────────────
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  // Event details
  name: varchar("name", { length: 300 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 500 }),
  ticketLink: varchar("ticketLink", { length: 500 }),
  // Date/time for one-time events or the first occurrence
  eventDate: timestamp("eventDate").notNull(),
  eventEndDate: timestamp("eventEndDate"),
  // Recurrence
  isRecurring: boolean("isRecurring").default(false).notNull(),
  recurrencePattern: mysqlEnum("recurrencePattern", ["weekly", "biweekly", "monthly"]),
  recurrenceEndDate: timestamp("recurrenceEndDate"),
  // Promotion settings
  promoLeadDays: json("promoLeadDays").$type<number[]>(), // e.g. [3, 1, 0] for 3 days before, day before, day of
  includeRecap: boolean("includeRecap").default(false).notNull(),
  // Event image
  imageUrl: text("imageUrl"),
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

// ── Event Promotions (links events to generated promo posts) ──────────────
export const eventPromotions = mysqlTable("event_promotions", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull(),
  postId: int("postId"),
  brandId: int("brandId").notNull(),
  // Which type of promo this is
  promoType: mysqlEnum("promoType", ["teaser", "reminder", "day_of", "recap"]).notNull(),
  // The specific event occurrence date this promo is for
  eventOccurrenceDate: timestamp("eventOccurrenceDate").notNull(),
  // When this promo post should go out
  scheduledDate: timestamp("scheduledDate").notNull(),
  // Status
  status: mysqlEnum("status", ["pending", "generated", "scheduled", "published", "skipped"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EventPromotion = typeof eventPromotions.$inferSelect;
export type InsertEventPromotion = typeof eventPromotions.$inferInsert;

// ── Error Logs ────────────────────────────────────────────────────────────
export const errorLogs = mysqlTable("error_logs", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId"),
  postId: int("postId"),
  errorType: mysqlEnum("errorType", [
    "post_failure",
    "token_expired",
    "content_generation_failure",
    "api_error",
    "retry_exhausted",
    "system"
  ]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "error", "critical"]).default("error").notNull(),
  message: text("message").notNull(),
  details: json("details").$type<Record<string, any>>(),
  retryCount: int("retryCount").default(0),
  maxRetries: int("maxRetries").default(3),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: int("resolvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;

// ── Onboarding State ──────────────────────────────────────────────────────
export const onboardingState = mysqlTable("onboarding_state", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // One onboarding record per user
  // Current step (1-6)
  currentStep: int("currentStep").default(1).notNull(),
  // Step data saved as JSON blobs
  stepData: json("stepData").$type<{
    step1?: { brandName: string; industry: string; website?: string; location?: string };
    step2?: { tone: string; style: string; keywords: string[]; avoidWords: string[]; samplePosts: string[]; customInstructions: string };
    step3?: { contentSource: "shopify" | "services" | "both" | "general"; shopifyDomain?: string; shopifyToken?: string };
    step4?: { facebookConnected: boolean; instagramConnected: boolean };
    step5?: { postsPerDay: number; preferredTimes: string[]; autoPost: boolean };
  }>(),
  // Whether onboarding is complete
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  // Brand created during onboarding
  brandId: int("brandId"),
  // Admin approval status
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OnboardingState = typeof onboardingState.$inferSelect;
export type InsertOnboardingState = typeof onboardingState.$inferInsert;

// ── Brand Invites ─────────────────────────────────────────────────────────
export const brandInvites = mysqlTable("brand_invites", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  // Pre-set tier for the invited client
  tier: mysqlEnum("tier", ["managed", "premium"]).default("managed").notNull(),
  // Optional: pre-fill brand name
  brandName: varchar("brandName", { length: 200 }),
  // Who created the invite
  createdBy: int("createdBy").notNull(),
  // When it expires (null = never)
  expiresAt: timestamp("expiresAt"),
  // When it was used
  usedAt: timestamp("usedAt"),
  usedByUserId: int("usedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BrandInvite = typeof brandInvites.$inferSelect;
export type InsertBrandInvite = typeof brandInvites.$inferInsert;

// ── DM Chatbot Lead Generation ─────────────────────────────────────────────

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  platform: mysqlEnum("platform", ["instagram", "facebook"]).notNull(),
  senderId: varchar("senderId", { length: 128 }).notNull(),
  // Collected during chatbot conversation
  name: varchar("name", { length: 200 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  serviceNeeded: text("serviceNeeded"),
  preferredTime: varchar("preferredTime", { length: 200 }),
  // Lead lifecycle
  status: mysqlEnum("status", ["new", "contacted", "qualified", "closed", "spam"]).default("new").notNull(),
  notes: text("notes"),
  // Raw conversation context
  conversationId: varchar("conversationId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

export const dmConversations = mysqlTable("dm_conversations", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull(),
  senderId: varchar("senderId", { length: 128 }).notNull(),
  platform: mysqlEnum("platform", ["instagram", "facebook"]).notNull(),
  // State machine: greeting | ask_service | ask_contact | ask_time | closing | complete | opted_out
  state: varchar("state", { length: 50 }).default("greeting").notNull(),
  // Partial data collected so far
  collectedData: json("collectedData").$type<{
    name?: string;
    service?: string;
    contact?: string;
    preferredTime?: string;
  }>(),
  lastMessageAt: timestamp("lastMessageAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DmConversation = typeof dmConversations.$inferSelect;
export type InsertDmConversation = typeof dmConversations.$inferInsert;

export const chatbotFlows = mysqlTable("chatbot_flows", {
  id: int("id").autoincrement().primaryKey(),
  brandId: int("brandId").notNull().unique(),
  // Customizable messages
  greeting: text("greeting").notNull(),
  askName: text("askName").notNull(),
  askContact: text("askContact").notNull(),
  askTime: text("askTime").notNull(),
  closingMessage: text("closingMessage").notNull(),
  // Whether chatbot is active for this brand
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ChatbotFlow = typeof chatbotFlows.$inferSelect;
export type InsertChatbotFlow = typeof chatbotFlows.$inferInsert;
