import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "../db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run Drizzle migrations at server startup.
 * Uses the drizzle-orm/mysql2 migrate() function with the migrations
 * folder from the project root. This runs at runtime when DATABASE_URL
 * is available (unlike build-time pnpm db:push which fails on Railway).
 */
export async function runMigrationsOnStartup(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Migration] Skipping migrations — database not available");
    return;
  }

  try {
    // The migrations folder is at the project root (process.cwd()/drizzle)
    // Railway runs node dist/index.js from the project root, so this resolves correctly.
    // Fallback: also try relative to __dirname (dist/drizzle) if copied there.
    const migrationsFolder = path.resolve(process.cwd(), "drizzle");

    console.log(`[Migration] Running migrations from: ${migrationsFolder}`);

    const { migrate } = await import("drizzle-orm/mysql2/migrator");
    await migrate(db, { migrationsFolder });

    console.log("[Migration] All migrations applied successfully");
  } catch (error: any) {
    // Log but don't crash — the app may still work if tables already exist
    console.error("[Migration] Migration failed:", error.message || error);
    console.error("[Migration] The app will continue, but some features may not work correctly.");
  }
}
