import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

// Compute __dirname equivalent for ESM (works on Node 18+)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Development-only: sets up Vite dev server with HMR.
 * All vite-related imports are fully dynamic to prevent esbuild from
 * bundling devDependencies (vite, @vitejs/plugin-react, etc.) into
 * the production dist/index.js.
 */
export async function setupVite(app: Express, server: Server) {
  // Use string concatenation to prevent esbuild from statically resolving
  // these dynamic imports and bundling the devDependencies.
  const vitePkg = "vi" + "te";
  const configPath = path.resolve(__dirname, "../..", "vite.config.ts");

  const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
  const viteConfigModule = await import(/* @vite-ignore */ configPath);
  const viteConfig = viteConfigModule.default;

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    // Never catch API routes — they must be handled by the registered route handlers above.
    if (req.originalUrl.startsWith("/api/")) return next();

    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(__dirname, "../..", "dist", "public")
      : path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Serve static assets only for non-API paths so express.static never
  // swallows an unmatched /api/* request before it reaches Express's 404 handler.
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return express.static(distPath)(req, res, next);
  });

  // SPA catch-all — only for non-API paths.
  // Unmatched /api/* requests fall through and get Express's default 404,
  // which is far easier to diagnose than silently receiving index.html.
  app.use("*", (_req, res) => {
    if (_req.originalUrl.startsWith("/api/")) {
      return res.status(404).json({ error: "API route not found" });
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
