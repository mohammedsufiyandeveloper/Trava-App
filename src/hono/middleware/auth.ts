import { createMiddleware } from "hono/factory";
import { auth } from "@/lib/auth";
import { HonoVariables } from "../types";

/**
 * Hono Auth Middleware
 * 
 * Uses Better Auth to validate sessions from either:
 * 1. Cookies (Web client)
 * 2. Authorization Header (Mobile/API client)
 * 
 * Sets 'user' and 'session' variables on success.
 * Returns 401 Unauthorized on failure.
 */
export const authMiddleware = createMiddleware<{ Variables: HonoVariables }>(async (c, next) => {
    try {
        // Better Auth helper to get session from request headers/cookies
        const session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });

        if (!session || !session.user) {
            return c.json({
                success: false,
                error: "Unauthorized",
                message: "Valid session or bearer token required"
            }, 401);
        }

        // Stash user and session in context
        c.set("user", session.user as any);
        c.set("session", session.session as any);

        await next();
    } catch (error) {
        console.error("[AUTH_MIDDLEWARE_ERROR]", error);
        return c.json({
            success: false,
            error: "Authentication error",
        }, 500);
    }
});
