import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import cron from "./routes/cron";
import units from "./routes/units";
import tasks from "./routes/tasks";
import user from "./routes/user";
import { attendanceRouter } from "./routes/attendance";
import { aiRouter } from "./routes/ai";
import notifications from "./routes/notifications";
import activities from "./routes/activities";
import { leavesRouter } from "./routes/leaves";
import { workspaceRouter } from "./routes/workspace";
import { projectsRouter } from "./routes/projects";
import { tagsRouter } from "./routes/tags";
import { conversationsRouter } from "./routes/conversations";
import myspace from "./routes/myspace";
import { HonoVariables } from "./types";
import { authMiddleware } from "./middleware/auth";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";


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


// ─── Helper: inject surname into a user object ────────────────────────────────
async function injectSurname(userData: any): Promise<any> {
    if (!userData?.user?.id) return userData;
    try {
        const dbUser = await prisma.user.findUnique({
            where: { id: userData.user.id },
            select: { surname: true } as any,
        });
        const surname = (dbUser as any)?.surname;
        if (surname) {
            userData.user.surname = surname;
            userData.user.name = surname;
        }
    } catch (e) {
        console.error("[AUTH INTERCEPT] DB lookup for surname failed:", e);
    }
    return userData;
}

// Better Auth route handler (mounted as public route, handles /api/auth/*)
app.on(["POST", "GET"], "/auth/*", async (c) => {
    const res = await auth.handler(c.req.raw);

    const isGetSession = c.req.url.includes("/get-session");
    const isSignIn = c.req.url.includes("/sign-in");

    if ((isGetSession || isSignIn) && res.status === 200) {
        try {
            const data = await res.clone().json();
            if (data?.user) {
                await injectSurname(data);
                const headers: Record<string, string> = {};
                res.headers.forEach((value, key) => {
                    headers[key] = value;
                });
                return c.json(data, 200, headers);
            }
        } catch (e) {
            console.error("[AUTH INTERCEPT] Failed to intercept auth response:", e);
        }
    }
    return res;
});

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

// User API
app.route("/user", user);

// AI API
app.route("/ai", aiRouter);

// Notifications API
app.route("/notifications", notifications);

// Activities API
app.route("/activities", activities);

// Leaves API
app.route("/leaves", leavesRouter);

// Workspace API (Plural & Singular)
app.route("/workspace", workspaceRouter);
app.route("/workspaces", workspaceRouter);

// Projects API
app.route("/projects", projectsRouter);

// Tags API
app.route("/tags", tagsRouter);

// Conversations API
app.route("/conversations", conversationsRouter);

// MySpace API
app.route("/myspace", myspace);

export default app;
export type AppType = typeof app;
