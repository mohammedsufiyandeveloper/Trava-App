import { PrismaClient } from"@prisma/client";

/**
 * Prisma Singleton for Next.js
 *
 * WHY THIS PATTERN EXISTS:
 * ─────────────────────────
 * Next.js in development mode clears the Node.js module cache on every file
 * change (via HMR / Fast Refresh). If you do `const prisma = new PrismaClient()`
 * at the module level, every hot reload creates a NEW PrismaClient instance —
 * each one opening its own connection pool (default: 5 connections per instance
 * on PostgreSQL). After a few edits you'll hit:
 *
 *   "Too many connections" / "sorry, too many clients already"
 *
 * The fix is to stash the single instance on `globalThis`, which survives
 * module cache clears. In production there's no HMR, so the guard is a no-op.
 *
 * LOGGING STRATEGY:
 * ─────────────────
 * - Development: warnings + errors to stdout for visibility.
 *   Query-level logging is OFF by default to keep the console clean.
 *   Uncomment the "query" line below when debugging slow queries.
 * - Production: errors only.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? [
            // Uncomment the line below to log every SQL query during development:
            // { level: "query", emit: "stdout" },
            { level: "error", emit: "stdout" },
            { level: "warn", emit: "stdout" },
          ]
        : [{ level: "error", emit: "stdout" }],
  });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
