import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, or } from "drizzle-orm";

/**
 * Seed the admin account on startup.
 *
 * Checks if the correct admin account exists. If not, creates one using:
 *   ADMIN_SEED_EMAIL    — email address (default: gerrit@gmkwebsolutions.com)
 *   ADMIN_SEED_PASSWORD — password (if not set, a secure random one is generated
 *                         and printed to the Railway deploy logs)
 *   ADMIN_SEED_NAME     — display name (default: Gerrit (GMK Web Solutions))
 *
 * Smart migration: If an admin account exists with the OLD email (garrett@gmkwebsolutions.com),
 * it will be updated to the new email and name. This handles the case where an earlier
 * deploy created the admin with the wrong email.
 *
 * This runs once at startup and is idempotent.
 */
export async function seedAdminAccount(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Seed] Skipping admin seed — database not available");
    return;
  }

  try {
    const correctEmail = (process.env.ADMIN_SEED_EMAIL ?? "gerrit@gmkwebsolutions.com").toLowerCase().trim();
    const correctName = process.env.ADMIN_SEED_NAME ?? "Gerrit (GMK Web Solutions)";
    const wrongEmail = "garrett@gmkwebsolutions.com"; // Previous incorrect email

    // Check if the correct admin account already exists
    const existingCorrectAdmin = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.email, correctEmail))
      .limit(1);

    if (existingCorrectAdmin.length > 0) {
      console.log(`[Seed] Admin account with correct email (${correctEmail}) already exists — skipping seed`);
      return;
    }

    // Check if there's an admin with the OLD email (migration case)
    const existingWrongAdmin = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.email, wrongEmail))
      .limit(1);

    if (existingWrongAdmin.length > 0) {
      // Migrate: update the wrong account to the correct email and name
      console.log(`[Seed] Found admin with old email (${wrongEmail}) — updating to ${correctEmail}`);
      await db
        .update(users)
        .set({
          email: correctEmail,
          name: correctName,
        })
        .where(eq(users.id, existingWrongAdmin[0].id));

      console.log(`[Seed] Admin account migrated successfully`);
      return;
    }

    // No admin found at all — create one with the correct email
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
      name: correctName,
      email: correctEmail,
      role: "admin",
      loginMethod: "email",
      passwordHash,
      lastSignedIn: new Date(),
    });

    // Always log the credentials — visible in Railway deploy logs
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║              ADMIN ACCOUNT CREATED ON STARTUP               ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║  Email:    ${correctEmail.padEnd(51)}║`);
    console.log(`║  Password: ${password.padEnd(51)}║`);
    console.log(`║  Name:     ${correctName.padEnd(51)}║`);
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
