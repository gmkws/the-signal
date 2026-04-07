import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Register standalone auth routes (email/password) — replaces Manus OAuth.
 * Routes:
 *   POST /api/auth/login      — email + password → session cookie
 *   POST /api/auth/register   — email + password + name → session cookie
 *   POST /api/auth/logout     — clear session cookie
 *   POST /api/auth/reset-password-request — email → generates reset token
 *   POST /api/auth/reset-password         — token + newPassword → resets password
 */
export function registerOAuthRoutes(app: Express) {
  // ── Login ───────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await db.getUserByEmail(email.toLowerCase().trim());
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Create session
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Update last signed in
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      return res.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (error: any) {
      console.error("[Auth] Login failed:", error.message);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  // ── Register ────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body ?? {};
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await db.getUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Generate a unique openId for this standalone user
      const openId = `local_${crypto.randomUUID()}`;

      // Create user
      await db.upsertUser({
        openId,
        name: name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        loginMethod: "email",
        lastSignedIn: new Date(),
      });

      // Set password hash (separate update since upsertUser doesn't handle it)
      await db.setUserPasswordHash(openId, passwordHash);

      const user = await db.getUserByOpenId(openId);
      if (!user) {
        return res.status(500).json({ error: "Failed to create user" });
      }

      // Create session
      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return res.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    } catch (error: any) {
      console.error("[Auth] Register failed:", error.message);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  // ── Logout ──────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(_req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return res.json({ success: true });
  });

  // ── Password Reset Request ──────────────────────────────────────────────
  app.post("/api/auth/reset-password-request", async (req: Request, res: Response) => {
    try {
      const { email } = req.body ?? {};
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await db.getUserByEmail(email.toLowerCase().trim());
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ success: true, message: "If an account exists with that email, a reset link has been sent." });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.setPasswordResetToken(user.openId, resetToken, resetExpires);

      // In production, this would send an email. For now, log it.
      console.log(`[Auth] Password reset token for ${email}: ${resetToken}`);
      // TODO: Integrate email sending service (SendGrid, etc.)

      return res.json({ success: true, message: "If an account exists with that email, a reset link has been sent." });
    } catch (error: any) {
      console.error("[Auth] Password reset request failed:", error.message);
      return res.status(500).json({ error: "Password reset request failed" });
    }
  });

  // ── Password Reset (with token) ────────────────────────────────────────
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body ?? {};
      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const user = await db.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      // Check expiration
      if (user.passwordResetExpires && new Date(user.passwordResetExpires) < new Date()) {
        return res.status(400).json({ error: "Reset token has expired" });
      }

      // Hash new password and clear reset token
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await db.setUserPasswordHash(user.openId, passwordHash);
      await db.clearPasswordResetToken(user.openId);

      return res.json({ success: true, message: "Password has been reset. You can now log in." });
    } catch (error: any) {
      console.error("[Auth] Password reset failed:", error.message);
      return res.status(500).json({ error: "Password reset failed" });
    }
  });

  // ── Admin: Create user manually ────────────────────────────────────────
  app.post("/api/auth/admin/create-user", async (req: Request, res: Response) => {
    try {
      // Authenticate the admin
      let admin: import("../../drizzle/schema").User | null = null;
      try {
        admin = await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { email, password, name, role } = req.body ?? {};
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await db.getUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const openId = `local_${crypto.randomUUID()}`;

      await db.upsertUser({
        openId,
        name: name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        loginMethod: "email",
        role: role === "admin" ? "admin" : "user",
        lastSignedIn: new Date(),
      });

      await db.setUserPasswordHash(openId, passwordHash);
      const user = await db.getUserByOpenId(openId);

      return res.json({
        success: true,
        user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
      });
    } catch (error: any) {
      console.error("[Auth] Admin create user failed:", error.message);
      return res.status(500).json({ error: "Failed to create user" });
    }
  });
}
