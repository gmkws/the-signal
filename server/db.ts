import { eq, desc, and, gte, lte, sql, asc, or, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  brands, InsertBrand, Brand,
  posts, InsertPost, Post,
  socialAccounts, InsertSocialAccount,
  notifications, InsertNotification,
  analyticsSnapshots, InsertAnalyticsSnapshot,
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
