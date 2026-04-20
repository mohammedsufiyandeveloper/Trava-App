import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import cron from "./routes/cron";
import units from "./routes/units";
import tasks from "./routes/tasks";
import { attendanceRouter } from "./routes/attendance";
import { getProjectReviewers } from "@/actions/project/get-project-reviewers";
import { HonoVariables } from "./types";
import { authMiddleware } from "./middleware/auth";

/**
 * Main Hono Application
 * basePath: /api/v1
 */
const app = new Hono<{ Variables: HonoVariables }>().basePath("/api");

// Global Middleware
app.use("*", logger());

// CORS Configuration
app.use(
    "*",
    cors({
        origin: (origin) => {
            if (process.env.NODE_ENV === "development") return origin;
            const allowed = [process.env.NEXT_PUBLIC_APP_URL].filter(Boolean);
            return allowed.includes(origin) ? origin : allowed[0];
        },
        credentials: true,
    })
);

/**
 * Global Error Handling
 */
app.onError((err, c) => {
    console.error(`[HONO_ERROR] ${err.message}`, err);
    return c.json(
        {
            success: false,
            error: err.message || "Internal Server Error",
        },
        500
    );
});

/**
 * Public Routes (No Auth Required)
 */

// Health Check
app.get("/health", (c) => {
    return c.json({
        success: true,
        status: "ok",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
    });
});

// Cron Job Routes (Secret-based Auth)
app.route("/cron", cron);

/**
 * Protected Routes (Auth Middleware Applied)
 */
app.use("*", authMiddleware);

// Units API
app.route("/units", units);

// Attendance API
app.route("/attendance", attendanceRouter);

// Tasks API
app.route("/tasks", tasks);

// Project Reviewers (Legacy / Temporary - will be moved to service later)
app.get("/projects/:projectId/reviewers", async (c) => {
    const projectId = c.req.param("projectId");
    if (!projectId) return c.json({ error: "Project ID is required" }, 400);

    try {
        const reviewers = await getProjectReviewers(projectId);
        return c.json({ success: true, data: reviewers });
    } catch (error) {
        return c.json({ success: false, error: "Failed to fetch project reviewers" }, 500);
    }
});

export default app;
export type AppType = typeof app;
