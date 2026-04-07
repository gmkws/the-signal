import { eq, desc, and, gte, lte, sql, asc, or, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  brands, InsertBrand, Brand,
  posts, InsertPost, Post,
  socialAccounts, InsertSocialAccount,
  notifications, InsertNotification,
  analyticsSnapshots, InsertAnalyticsSnapshot,
  shopifyConnections, InsertShopifyConnection,
  shopifyProducts, InsertShopifyProduct,
  services, InsertService,
  events, InsertEvent,
  eventPromotions, InsertEventPromotion,
  errorLogs, InsertErrorLog,
  onboardingState, InsertOnboardingState, OnboardingState,
  brandInvites, InsertBrandInvite, BrandInvite,
  leads, InsertLead, Lead,
  dmConversations, InsertDmConversation, DmConversation,
  chatbotFlows, InsertChatbotFlow, ChatbotFlow,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function setUserPasswordHash(openId: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.openId, openId));
}

export async function getUserByResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.passwordResetToken, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function setPasswordResetToken(openId: string, token: string, expires: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordResetToken: token, passwordResetExpires: expires }).where(eq(users.openId, openId));
}

export async function clearPasswordResetToken(openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordResetToken: null, passwordResetExpires: null }).where(eq(users.openId, openId));
}

export async function updateUserStripeInfo(openId: string, data: { stripeCustomerId?: string; stripeSubscriptionId?: string; stripeSubscriptionStatus?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.openId, openId));
}

// ── Brands ─────────────────────────────────────────────────────────────────

export async function createBrand(brand: InsertBrand) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(brands).values(brand);
  return { id: result[0].insertId };
}

export async function updateBrand(id: number, data: Partial<InsertBrand>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(brands).set(data).where(eq(brands.id, id));
}

export async function deleteBrand(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(brands).where(eq(brands.id, id));
}

export async function getBrandById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
  return result[0];
}

export async function getBrandBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
  return result[0];
}

export async function getAllBrands() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brands).orderBy(desc(brands.createdAt));
}

export async function getBrandsByClientUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brands).where(eq(brands.clientUserId, userId));
}

export async function getBrandCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(brands);
  return result[0]?.count ?? 0;
}

// ── Posts ───────────────────────────────────────────────────────────────────

export async function createPost(post: InsertPost) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(posts).values(post);
  return { id: result[0].insertId };
}

export async function updatePost(id: number, data: Partial<InsertPost>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(posts).set(data).where(eq(posts.id, id));
}

export async function deletePost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(posts).where(eq(posts.id, id));
}

export async function getPostById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return result[0];
}

export async function getPostsByBrandId(brandId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).where(eq(posts.brandId, brandId)).orderBy(desc(posts.createdAt)).limit(limit);
}

export async function getPostsByStatus(status: string, brandId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(posts.status, status as any)];
  if (brandId) conditions.push(eq(posts.brandId, brandId));
  return db.select().from(posts).where(and(...conditions)).orderBy(desc(posts.createdAt));
}

export async function getScheduledPosts(from?: Date, to?: Date, brandId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [
    or(eq(posts.status, "scheduled"), eq(posts.status, "approved"), eq(posts.status, "pending_review"))
  ];
  if (brandId) conditions.push(eq(posts.brandId, brandId));
  if (from) conditions.push(gte(posts.scheduledAt, from));
  if (to) conditions.push(lte(posts.scheduledAt, to));
  return db.select().from(posts).where(and(...conditions)).orderBy(asc(posts.scheduledAt));
}

export async function getAllPosts(limit = 100, brandId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (brandId) conditions.push(eq(posts.brandId, brandId));
  const query = conditions.length > 0
    ? db.select().from(posts).where(and(...conditions))
    : db.select().from(posts);
  return query.orderBy(desc(posts.createdAt)).limit(limit);
}

export async function getPostStats(brandId?: number) {
  const db = await getDb();
  if (!db) return { total: 0, published: 0, scheduled: 0, draft: 0, failed: 0 };
  const conditions: any[] = [];
  if (brandId) conditions.push(eq(posts.brandId, brandId));
  const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;

  const [total] = await db.select({ count: sql<number>`count(*)` }).from(posts).where(baseWhere);
  const [published] = await db.select({ count: sql<number>`count(*)` }).from(posts).where(and(eq(posts.status, "published"), ...(conditions)));
  const [scheduled] = await db.select({ count: sql<number>`count(*)` }).from(posts).where(and(eq(posts.status, "scheduled"), ...(conditions)));
  const [draft] = await db.select({ count: sql<number>`count(*)` }).from(posts).where(and(eq(posts.status, "draft"), ...(conditions)));
  const [failed] = await db.select({ count: sql<number>`count(*)` }).from(posts).where(and(eq(posts.status, "failed"), ...(conditions)));

  return {
    total: total?.count ?? 0,
    published: published?.count ?? 0,
    scheduled: scheduled?.count ?? 0,
    draft: draft?.count ?? 0,
    failed: failed?.count ?? 0,
  };
}

// ── Social Accounts ────────────────────────────────────────────────────────

export async function createSocialAccount(account: InsertSocialAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(socialAccounts).values(account);
  return { id: result[0].insertId };
}

export async function updateSocialAccount(id: number, data: Partial<InsertSocialAccount>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(socialAccounts).set(data).where(eq(socialAccounts.id, id));
}

export async function deleteSocialAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(socialAccounts).where(eq(socialAccounts.id, id));
}

export async function getSocialAccountsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(socialAccounts).where(eq(socialAccounts.brandId, brandId));
}

// ── Notifications ──────────────────────────────────────────────────────────

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(notification);
  return { id: result[0].insertId };
}

export async function getNotifications(role: "admin" | "client", brandId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(notifications.toRole, role)];
  if (brandId) conditions.push(eq(notifications.brandId, brandId));
  return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getUnreadNotificationCount(role: "admin" | "client", brandId?: number) {
  const db = await getDb();
  if (!db) return 0;
  const conditions: any[] = [eq(notifications.toRole, role), eq(notifications.isRead, false)];
  if (brandId) conditions.push(eq(notifications.brandId, brandId));
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(...conditions));
  return result?.count ?? 0;
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(role: "admin" | "client", brandId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [eq(notifications.toRole, role), eq(notifications.isRead, false)];
  if (brandId) conditions.push(eq(notifications.brandId, brandId));
  await db.update(notifications).set({ isRead: true }).where(and(...conditions));
}

// ── Analytics ──────────────────────────────────────────────────────────────

export async function createAnalyticsSnapshot(snapshot: InsertAnalyticsSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(analyticsSnapshots).values(snapshot);
}

export async function getAnalyticsByBrand(brandId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  return db.select().from(analyticsSnapshots)
    .where(and(eq(analyticsSnapshots.brandId, brandId), gte(analyticsSnapshots.snapshotDate, fromDate)))
    .orderBy(desc(analyticsSnapshots.snapshotDate));
}

export async function getAnalyticsSummary(brandId: number) {
  const db = await getDb();
  if (!db) return { impressions: 0, reach: 0, engagement: 0, likes: 0, comments: 0, shares: 0, clicks: 0 };
  const [result] = await db.select({
    impressions: sql<number>`COALESCE(SUM(impressions), 0)`,
    reach: sql<number>`COALESCE(SUM(reach), 0)`,
    engagement: sql<number>`COALESCE(SUM(engagement), 0)`,
    likes: sql<number>`COALESCE(SUM(likes), 0)`,
    comments: sql<number>`COALESCE(SUM(comments), 0)`,
    shares: sql<number>`COALESCE(SUM(shares), 0)`,
    clicks: sql<number>`COALESCE(SUM(clicks), 0)`,
  }).from(analyticsSnapshots).where(eq(analyticsSnapshots.brandId, brandId));
  return result ?? { impressions: 0, reach: 0, engagement: 0, likes: 0, comments: 0, shares: 0, clicks: 0 };
}


// ── Shopify Connections ────────────────────────────────────────────────────

export async function createShopifyConnection(conn: InsertShopifyConnection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(shopifyConnections).values(conn);
  return { id: result[0].insertId };
}

export async function getShopifyConnectionByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shopifyConnections).where(eq(shopifyConnections.brandId, brandId)).limit(1);
  return result[0];
}

export async function updateShopifyConnection(id: number, data: Partial<InsertShopifyConnection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(shopifyConnections).set(data).where(eq(shopifyConnections.id, id));
}

export async function deleteShopifyConnection(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(shopifyConnections).where(eq(shopifyConnections.brandId, brandId));
  // Also delete synced products
  await db.delete(shopifyProducts).where(eq(shopifyProducts.brandId, brandId));
}

// ── Shopify Products ───────────────────────────────────────────────────────

export async function upsertShopifyProduct(product: InsertShopifyProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if product already exists
  const existing = await db.select().from(shopifyProducts)
    .where(and(
      eq(shopifyProducts.brandId, product.brandId),
      eq(shopifyProducts.shopifyProductId, product.shopifyProductId)
    )).limit(1);

  if (existing.length > 0) {
    await db.update(shopifyProducts).set(product).where(eq(shopifyProducts.id, existing[0].id));
    return { id: existing[0].id };
  } else {
    const result = await db.insert(shopifyProducts).values(product);
    return { id: result[0].insertId };
  }
}

export async function getShopifyProductsByBrandId(brandId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shopifyProducts)
    .where(eq(shopifyProducts.brandId, brandId))
    .orderBy(desc(shopifyProducts.updatedAt))
    .limit(limit);
}

export async function getShopifyProductForContent(brandId: number) {
  const db = await getDb();
  if (!db) return undefined;
  // Get the product least recently used in content, or never used
  const result = await db.select().from(shopifyProducts)
    .where(and(
      eq(shopifyProducts.brandId, brandId),
      eq(shopifyProducts.status, "active")
    ))
    .orderBy(asc(shopifyProducts.lastUsedInPostAt))
    .limit(1);
  return result[0];
}

export async function markShopifyProductUsed(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(shopifyProducts).set({ lastUsedInPostAt: new Date() }).where(eq(shopifyProducts.id, id));
}

export async function deleteShopifyProductsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(shopifyProducts).where(eq(shopifyProducts.brandId, brandId));
}

// ── Services (Service Spotlight) ──────────────────────────────────────────

export async function createService(service: InsertService) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(services).values(service);
  return { id: result[0].insertId };
}

export async function updateService(id: number, data: Partial<InsertService>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(services).set(data).where(eq(services.id, id));
}

export async function deleteService(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(services).where(eq(services.id, id));
}

export async function getServiceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return result[0];
}

export async function getServicesByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services)
    .where(eq(services.brandId, brandId))
    .orderBy(asc(services.displayOrder));
}

export async function getServiceForContent(brandId: number) {
  const db = await getDb();
  if (!db) return undefined;
  // Get the service least recently used in content, or never used
  const result = await db.select().from(services)
    .where(and(
      eq(services.brandId, brandId),
      eq(services.isActive, true)
    ))
    .orderBy(asc(services.lastUsedInPostAt))
    .limit(1);
  return result[0];
}

export async function markServiceUsed(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(services).set({ lastUsedInPostAt: new Date() }).where(eq(services.id, id));
}

// ── Events ─────────────────────────────────────────────────────────────────


export async function createEvent(event: InsertEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(events).values(event);
  return { id: result[0].insertId };
}

export async function updateEvent(id: number, data: Partial<InsertEvent>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(events).set(data).where(eq(events.id, id));
}

export async function deleteEvent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete associated promotions first
  await db.delete(eventPromotions).where(eq(eventPromotions.eventId, id));
  await db.delete(events).where(eq(events.id, id));
}

export async function getEventById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return result[0];
}

export async function getEventsByBrandId(brandId: number, includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(events.brandId, brandId)];
  if (!includeInactive) conditions.push(eq(events.isActive, true));
  return db.select().from(events)
    .where(and(...conditions))
    .orderBy(asc(events.eventDate));
}

export async function getUpcomingEvents(brandId?: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);
  const conditions: any[] = [
    eq(events.isActive, true),
    gte(events.eventDate, now),
    lte(events.eventDate, future),
  ];
  if (brandId) conditions.push(eq(events.brandId, brandId));
  return db.select().from(events)
    .where(and(...conditions))
    .orderBy(asc(events.eventDate));
}

// ── Event Promotions ───────────────────────────────────────────────────────

export async function createEventPromotion(promo: InsertEventPromotion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(eventPromotions).values(promo);
  return { id: result[0].insertId };
}

export async function updateEventPromotion(id: number, data: Partial<InsertEventPromotion>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(eventPromotions).set(data).where(eq(eventPromotions.id, id));
}

export async function getEventPromotionsByEventId(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventPromotions)
    .where(eq(eventPromotions.eventId, eventId))
    .orderBy(asc(eventPromotions.scheduledDate));
}

export async function getEventPromotionsByBrandId(brandId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventPromotions)
    .where(eq(eventPromotions.brandId, brandId))
    .orderBy(asc(eventPromotions.scheduledDate))
    .limit(limit);
}

export async function getPendingEventPromotions(brandId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(eventPromotions.status, "pending")];
  if (brandId) conditions.push(eq(eventPromotions.brandId, brandId));
  return db.select().from(eventPromotions)
    .where(and(...conditions))
    .orderBy(asc(eventPromotions.scheduledDate));
}

export async function deleteEventPromotionsByEventId(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(eventPromotions).where(eq(eventPromotions.eventId, eventId));
}

export async function getEventPromoPostIds(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ postId: eventPromotions.postId })
    .from(eventPromotions)
    .where(and(eq(eventPromotions.brandId, brandId)));
  return result.map(r => r.postId).filter(Boolean) as number[];
}

// ── Error Logs ────────────────────────────────────────────────────────────

export async function createErrorLog(log: Omit<InsertErrorLog, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(errorLogs).values(log);
  return { id: result[0].insertId };
}

export async function getErrorLogs(limit = 100, includeResolved = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (!includeResolved) conditions.push(eq(errorLogs.resolved, false));
  return db.select().from(errorLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(errorLogs.createdAt))
    .limit(limit);
}

export async function getErrorLogsByBrand(brandId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(errorLogs)
    .where(eq(errorLogs.brandId, brandId))
    .orderBy(desc(errorLogs.createdAt))
    .limit(limit);
}

export async function getErrorLogsByPost(postId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(errorLogs)
    .where(eq(errorLogs.postId, postId))
    .orderBy(desc(errorLogs.createdAt));
}

export async function resolveErrorLog(id: number, resolvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(errorLogs).set({
    resolved: true,
    resolvedAt: new Date(),
    resolvedBy,
  }).where(eq(errorLogs.id, id));
}

export async function getErrorLogStats() {
  const db = await getDb();
  if (!db) return { total: 0, unresolved: 0, critical: 0, byType: {} };
  const all = await db.select().from(errorLogs)
    .where(eq(errorLogs.resolved, false));
  const byType: Record<string, number> = {};
  let critical = 0;
  for (const log of all) {
    byType[log.errorType] = (byType[log.errorType] || 0) + 1;
    if (log.severity === "critical") critical++;
  }
  return { total: all.length, unresolved: all.length, critical, byType };
}

export async function getSocialAccountById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(socialAccounts).where(eq(socialAccounts.id, id)).limit(1);
  return result[0];
}

export async function getPostsNeedingApproval(beforeDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts)
    .where(and(
      eq(posts.status, "pending_review"),
      lte(posts.scheduledAt, beforeDate)
    ))
    .orderBy(asc(posts.scheduledAt));
}

// ── Onboarding State ──────────────────────────────────────────────────────

export async function getOnboardingStateByUserId(userId: number): Promise<OnboardingState | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(onboardingState).where(eq(onboardingState.userId, userId)).limit(1);
  return result[0];
}

export async function upsertOnboardingState(userId: number, data: Partial<InsertOnboardingState>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getOnboardingStateByUserId(userId);
  if (existing) {
    await db.update(onboardingState).set({ ...data, updatedAt: new Date() }).where(eq(onboardingState.userId, userId));
  } else {
    await db.insert(onboardingState).values({ userId, ...data });
  }
  return getOnboardingStateByUserId(userId);
}

export async function completeOnboarding(userId: number, brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(onboardingState).set({
    completed: true,
    completedAt: new Date(),
    brandId,
    updatedAt: new Date(),
  }).where(eq(onboardingState.userId, userId));
}

export async function getPendingOnboardings(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(onboardingState)
    .where(and(
      eq(onboardingState.completed, true),
      eq(onboardingState.approvalStatus, "pending")
    ))
    .orderBy(desc(onboardingState.completedAt))
    .limit(limit);
}

export async function approveOnboarding(userId: number, approvedBy: number, tier: "managed" | "premium") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(onboardingState).set({
    approvalStatus: "approved",
    approvedBy,
    approvedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(onboardingState.userId, userId));
  // Also update the brand tier
  const state = await getOnboardingStateByUserId(userId);
  if (state?.brandId) {
    await db.update(brands).set({ clientTier: tier, isActive: true }).where(eq(brands.id, state.brandId));
  }
}

export async function rejectOnboarding(userId: number, rejectedBy: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(onboardingState).set({
    approvalStatus: "rejected",
    approvedBy: rejectedBy,
    approvedAt: new Date(),
    rejectionReason: reason,
    updatedAt: new Date(),
  }).where(eq(onboardingState.userId, userId));
}

// ── Brand Invites ─────────────────────────────────────────────────────────

export async function createBrandInvite(invite: InsertBrandInvite): Promise<BrandInvite> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(brandInvites).values(invite);
  const created = await db.select().from(brandInvites).where(eq(brandInvites.id, result[0].insertId)).limit(1);
  return created[0];
}

export async function getBrandInviteByToken(token: string): Promise<BrandInvite | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(brandInvites).where(eq(brandInvites.token, token)).limit(1);
  return result[0];
}

export async function markInviteUsed(token: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(brandInvites).set({
    usedAt: new Date(),
    usedByUserId: userId,
  }).where(eq(brandInvites.token, token));
}

export async function getInvitesByCreator(createdBy: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brandInvites)
    .where(eq(brandInvites.createdBy, createdBy))
    .orderBy(desc(brandInvites.createdAt));
}

// ── Leads ─────────────────────────────────────────────────────────────────
export async function createLead(lead: InsertLead): Promise<Lead> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(leads).values(lead);
  const created = await db.select().from(leads).where(eq(leads.id, result[0].insertId)).limit(1);
  return created[0];
}

export async function getLeadsByBrand(brandId: number): Promise<Lead[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leads)
    .where(eq(leads.brandId, brandId))
    .orderBy(desc(leads.createdAt));
}

export async function getAllLeads(): Promise<Lead[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leads).orderBy(desc(leads.createdAt));
}

export async function updateLead(id: number, data: Partial<InsertLead>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(leads).set({ ...data, updatedAt: new Date() }).where(eq(leads.id, id));
}

export async function getLeadById(id: number): Promise<Lead | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0];
}

// ── DM Conversations ──────────────────────────────────────────────────────
export async function getConversation(brandId: number, senderId: string, platform: string): Promise<DmConversation | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dmConversations)
    .where(and(
      eq(dmConversations.brandId, brandId),
      eq(dmConversations.senderId, senderId),
      eq(dmConversations.platform, platform as "instagram" | "facebook")
    ))
    .limit(1);
  return result[0];
}

export async function upsertConversation(data: {
  brandId: number;
  senderId: string;
  platform: "instagram" | "facebook";
  state: string;
  collectedData?: Record<string, string>;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getConversation(data.brandId, data.senderId, data.platform);
  if (existing) {
    await db.update(dmConversations).set({
      state: data.state,
      collectedData: data.collectedData ?? existing.collectedData,
      lastMessageAt: new Date(),
    }).where(eq(dmConversations.id, existing.id));
  } else {
    await db.insert(dmConversations).values({
      brandId: data.brandId,
      senderId: data.senderId,
      platform: data.platform,
      state: data.state,
      collectedData: data.collectedData ?? {},
      lastMessageAt: new Date(),
    });
  }
}

// ── Chatbot Flows ─────────────────────────────────────────────────────────
const DEFAULT_FLOW = {
  greeting: "Hey! Thanks for reaching out. What service are you interested in?",
  askName: "Great! What's your name?",
  askContact: "What's the best way to reach you? (phone number or email)",
  askTime: "What time works best for a quick call or follow-up?",
  closingMessage: "Got it! Someone from the team will be in touch within 24 hours. We appreciate you reaching out!",
  isActive: true,
};

export async function getChatbotFlow(brandId: number): Promise<ChatbotFlow | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(chatbotFlows).where(eq(chatbotFlows.brandId, brandId)).limit(1);
  return result[0] ?? null;
}

export async function upsertChatbotFlow(brandId: number, data: Partial<InsertChatbotFlow>): Promise<ChatbotFlow> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getChatbotFlow(brandId);
  if (existing) {
    await db.update(chatbotFlows).set({ ...data, updatedAt: new Date() }).where(eq(chatbotFlows.brandId, brandId));
    const updated = await getChatbotFlow(brandId);
    return updated!;
  } else {
    const toInsert: InsertChatbotFlow = {
      brandId,
      greeting: data.greeting ?? DEFAULT_FLOW.greeting,
      askName: data.askName ?? DEFAULT_FLOW.askName,
      askContact: data.askContact ?? DEFAULT_FLOW.askContact,
      askTime: data.askTime ?? DEFAULT_FLOW.askTime,
      closingMessage: data.closingMessage ?? DEFAULT_FLOW.closingMessage,
      isActive: data.isActive ?? true,
    };
    const result = await db.insert(chatbotFlows).values(toInsert);
    const created = await db.select().from(chatbotFlows).where(eq(chatbotFlows.id, result[0].insertId)).limit(1);
    return created[0];
  }
}

export { DEFAULT_FLOW as DEFAULT_CHATBOT_FLOW };
