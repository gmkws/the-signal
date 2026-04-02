import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { runCronPublisher, startInProcessScheduler } from "../services/cronEngine";

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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ── Cron endpoint (Railway-compatible HTTP trigger) ──────────────────────
  // GET  /api/cron/publish  — triggered by Railway cron or external scheduler
  // POST /api/cron/publish  — alternative method
  // Optionally protected by CRON_SECRET env var:
  //   Authorization: Bearer <CRON_SECRET>  or  ?secret=<CRON_SECRET>
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start in-process scheduler unless Railway cron is configured externally.
    // Set DISABLE_IN_PROCESS_CRON=true when using external cron jobs to avoid
    // double-publishing.
    if (process.env.DISABLE_IN_PROCESS_CRON !== "true") {
      startInProcessScheduler();
    } else {
      console.log("[CronEngine] In-process scheduler disabled (using external cron)");
    }
  });
}

startServer().catch(console.error);
