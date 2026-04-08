import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { runCronPublisher, startInProcessScheduler } from "../services/cronEngine";
import { processDmMessage, parseInstagramWebhook, parseFacebookWebhook } from "../services/chatbot";
import { storagePut } from "../storage";
import { sdk } from "./sdk";
import * as db from "../db";
import { handleStripeWebhook, createCheckoutSession, createCustomerPortalSession, isStripeConfigured } from "../services/stripe";
import { runMigrationsOnStartup } from "../services/migrate";
import { seedAdminAccount } from "../services/seed";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Startup diagnostics ─────────────────────────────────────────────────
  console.log(`[Startup] NODE_ENV=${process.env.NODE_ENV}`);
  console.log(`[Startup] DATABASE_URL=${process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.replace(/:([^@]+)@/, ':****@') + ')' : 'NOT SET'}`);
  console.log(`[Startup] JWT_SECRET=${process.env.JWT_SECRET ? 'SET' : 'NOT SET'}`);
  console.log(`[Startup] STRIPE_SECRET_KEY=${process.env.STRIPE_SECRET_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`[Startup] SMTP_HOST=${process.env.SMTP_HOST ? 'SET (' + process.env.SMTP_HOST + ')' : 'NOT SET — email notifications disabled'}`);
  console.log(`[Startup] ADMIN_EMAIL=${process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'NOT SET'}`);

  // Run migrations, seed admin, then verify connection (non-blocking — server starts regardless)
  runMigrationsOnStartup()
    .then(() => seedAdminAccount())
    .then(() => db.getDb())
    .then(dbInstance => {
      if (dbInstance) {
        console.log('[Startup] Database connection verified');
      } else {
        console.warn('[Startup] Database connection failed — some features will be unavailable');
      }
    })
    .catch(err => {
      console.error('[Startup] Database startup error:', err.message);
    });

  // ── Health Check (must be first, before any body parsers) ────────────────
  app.get("/api/health", (_req: express.Request, res: express.Response) => {
    return res.status(200).json({ status: "ok", timestamp: Date.now() });
  });

  // ── Stripe Webhook (raw body required — MUST be before global JSON parser) ──
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req: express.Request, res: express.Response) => {
    const sig = req.headers["stripe-signature"] as string;
    if (!sig) return res.status(400).json({ error: "Missing stripe-signature header" });
    try {
      const result = await handleStripeWebhook(req.body, sig);
      if (result.received) {
        return res.json({ received: true });
      }
      return res.status(400).json({ error: result.error });
    } catch (err: any) {
      console.error("[Stripe] Webhook error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Global body parsers (after Stripe webhook to avoid consuming raw body) ──
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Standalone auth routes (login, register, password reset)
  registerOAuthRoutes(app);

  // ── Stripe Checkout Session ──────────────────────────────────────────────
  app.post("/api/stripe/create-checkout-session", async (req: express.Request, res: express.Response) => {
    try {
      let user: import("../../drizzle/schema").User | null = null;
      try { user = await sdk.authenticateRequest(req as any); } catch { /* unauthenticated */ }
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const { tier } = req.body ?? {};
      if (!tier || !['managed', 'premium'].includes(tier)) {
        return res.status(400).json({ error: "Invalid tier. Must be 'managed' or 'premium'." });
      }

      const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
      const result = await createCheckoutSession({
        userOpenId: user.openId,
        userEmail: user.email || '',
        tier,
        successUrl: `${origin}/client?checkout=success`,
        cancelUrl: `${origin}/signup?checkout=canceled`,
      });

      if ('error' in result) return res.status(400).json({ error: result.error });
      return res.json({ url: result.url });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Stripe Customer Portal ──────────────────────────────────────────────
  app.post("/api/stripe/customer-portal", async (req: express.Request, res: express.Response) => {
    try {
      let user: import("../../drizzle/schema").User | null = null;
      try { user = await sdk.authenticateRequest(req as any); } catch { /* unauthenticated */ }
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      if (!user.stripeCustomerId) return res.status(400).json({ error: "No Stripe subscription found" });

      const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
      const result = await createCustomerPortalSession({
        stripeCustomerId: user.stripeCustomerId,
        returnUrl: `${origin}/client`,
      });

      if ('error' in result) return res.status(400).json({ error: result.error });
      return res.json({ url: result.url });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ── Stripe Status (public check) ────────────────────────────────────────
  app.get("/api/stripe/status", (_req: express.Request, res: express.Response) => {
    return res.json({ configured: isStripeConfigured() });
  });

  // ── Cron endpoint (Railway-compatible HTTP trigger) ──────────────────────
  const cronHandler = async (req: express.Request, res: express.Response) => {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = (req.headers["authorization"] as string) || (req.query["secret"] as string) || (req.body?.secret as string);
      if (authHeader !== `Bearer ${cronSecret}` && authHeader !== cronSecret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    try {
      const result = await runCronPublisher();
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };
  app.get("/api/cron/publish", cronHandler);
  app.post("/api/cron/publish", cronHandler);

  // ── Meta Webhook (Instagram DMs + Facebook Messenger) ────────────────────
  app.get("/api/webhooks/meta", (req: express.Request, res: express.Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "the_signal_webhook";
    if (mode === "subscribe" && token === verifyToken) {
      console.log("[Webhook] Meta webhook verified successfully");
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "Verification failed" });
  });

  app.post("/api/webhooks/meta", async (req: express.Request, res: express.Response) => {
    res.status(200).send("EVENT_RECEIVED");
    const body = req.body;
    const object = body?.object;
    try {
      let events: ReturnType<typeof parseInstagramWebhook> = [];
      if (object === "instagram") {
        events = parseInstagramWebhook(body);
      } else if (object === "page") {
        events = parseFacebookWebhook(body);
      }
      for (const event of events) {
        await processDmMessage(
          event.platform,
          event.recipientId,
          event.senderId,
          event.messageText
        ).catch((err: Error) => {
          console.error(`[Chatbot] Error processing DM from ${event.senderId}:`, err.message);
        });
      }
    } catch (err: any) {
      console.error("[Webhook] Error processing Meta webhook:", err.message);
    }
  });

  // ── Media Upload Endpoint ────────────────────────────────────────────────
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WebP, MP4.`));
      }
    },
  });

  app.post("/api/upload/media", upload.single("file"), async (req: express.Request, res: express.Response) => {
    try {
      let user: import("../../drizzle/schema").User | null = null;
      try {
        user = await sdk.authenticateRequest(req as any);
      } catch {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      if (user.role !== "admin") {
        const postId = req.body?.postId ? Number(req.body.postId) : null;
        if (postId) {
          const post = await db.getPostById(postId);
          if (post) {
            const brand = await db.getBrandById(post.brandId);
            if (brand && brand.clientTier !== "premium") {
              return res.status(403).json({ error: "Media upload requires a Premium tier subscription. Please contact your account manager to upgrade." });
            }
          }
        }
      }

      if (!req.file) return res.status(400).json({ error: "No file provided" });

      const file = req.file;
      const isVideo = file.mimetype.startsWith("video/");
      const ext = file.originalname.split(".").pop()?.toLowerCase() ?? (isVideo ? "mp4" : "jpg");
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const fileKey = `uploads/media/${user.id}-${Date.now()}-${randomSuffix}.${ext}`;

      const { url } = await storagePut(fileKey, file.buffer, file.mimetype);

      const postId = req.body?.postId ? Number(req.body.postId) : null;
      const slideIndex = req.body?.slideIndex !== undefined && req.body.slideIndex !== "" ? Number(req.body.slideIndex) : null;

      if (postId && slideIndex === null) {
        await db.updatePost(postId, {
          uploadedMediaUrl: url,
          uploadedMediaType: isVideo ? "video" : "image",
        });
      } else if (postId && slideIndex !== null) {
        const post = await db.getPostById(postId);
        if (post?.carouselSlides) {
          const slides = [...(post.carouselSlides as any[])];
          if (slides[slideIndex]) {
            slides[slideIndex] = { ...slides[slideIndex], uploadedImageUrl: url };
            await db.updatePost(postId, { carouselSlides: slides as any });
          }
        }
      }

      return res.json({ url, fileKey, mediaType: isVideo ? "video" : "image" });
    } catch (err: any) {
      console.error("[Upload] Error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ── Port binding ─────────────────────────────────────────────────────────
  // In production (Railway), always use the exact PORT env var.
  // In development, fall back to port scanning if the preferred port is busy.
  const preferredPort = parseInt(process.env.PORT || "3000");
  let port: number;

  if (process.env.NODE_ENV === "production") {
    port = preferredPort;
  } else {
    port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) {
      console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
    }
  }

  // Bind to 0.0.0.0 so Railway's load balancer can reach the server
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);

    // Start in-process scheduler unless Railway cron is configured externally.
    if (process.env.DISABLE_IN_PROCESS_CRON !== "true") {
      startInProcessScheduler();
    } else {
      console.log("[CronEngine] In-process scheduler disabled (using external cron)");
    }
  });
}

startServer().catch((err) => {
  console.error("[Fatal] Server failed to start:", err);
  process.exit(1);
});
