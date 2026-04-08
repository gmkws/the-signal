import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Seed the admin account on startup.
 *
 * Checks if any admin user exists. If not, creates one using:
 *   ADMIN_SEED_EMAIL    — email address (default: garrett@gmkwebsolutions.com)
 *   ADMIN_SEED_PASSWORD — password (if not set, a secure random one is generated
 *                         and printed to the Railway deploy logs)
 *   ADMIN_SEED_NAME     — display name (default: Garrett (GMK Web Solutions))
 *
 * This runs once at startup and is idempotent — it will never overwrite an
 * existing admin account.
 */
export async function seedAdminAccount(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Seed] Skipping admin seed — database not available");
    return;
  }

  try {
    // Check if any admin account already exists
    const existingAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);

    if (existingAdmins.length > 0) {
      console.log("[Seed] Admin account already exists — skipping seed");
      return;
    }

    // No admin found — create one
    const email = process.env.ADMIN_SEED_EMAIL ?? "garrett@gmkwebsolutions.com";
    const name = process.env.ADMIN_SEED_NAME ?? "Garrett (GMK Web Solutions)";

    // Use provided password or generate a secure random one
    let password = process.env.ADMIN_SEED_PASSWORD;
    let passwordWasGenerated = false;
    if (!password) {
      // Generate a secure 16-character password: letters + digits + symbols
      password = crypto.randomBytes(12).toString("base64").replace(/[+/=]/g, "").slice(0, 16);
      // Ensure it has at least one digit and one uppercase
      password = password.charAt(0).toUpperCase() + password.slice(1) + "1!";
      passwordWasGenerated = true;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const openId = `local_${crypto.randomUUID()}`;

    await db.insert(users).values({
      openId,
      name,
      email: email.toLowerCase().trim(),
      role: "admin",
      loginMethod: "email",
      passwordHash,
      lastSignedIn: new Date(),
    });

    // Always log the credentials — visible in Railway deploy logs
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║              ADMIN ACCOUNT CREATED ON STARTUP               ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  Email:    ${email.padEnd(51)}║`);
    console.log(`║  Password: ${password.padEnd(51)}║`);
    console.log(`║  Name:     ${name.padEnd(51)}║`);
    if (passwordWasGenerated) {
      console.log("╠══════════════════════════════════════════════════════════════╣");
      console.log("║  ⚠  Password was auto-generated. Please change it after     ║");
      console.log("║     your first login via the admin panel.                   ║");
    }
    console.log("╚══════════════════════════════════════════════════════════════╝");
  } catch (error: any) {
    console.error("[Seed] Failed to seed admin account:", error.message || error);
  }
}
