import { createMiddleware } from "hono/factory";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
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
        let session = await auth.api.getSession({
            headers: c.req.raw.headers,
        });

        console.log("[DEBUG] Auth Middleware Session:", JSON.stringify(session));

        // Fallback: Manually validate Bearer token in the database if getSession failed
        if (!session || !session.user) {
            const authHeader = c.req.header("Authorization");
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.substring(7).trim();
                console.log("[DEBUG] Auth Middleware Fallback: Lookup token", token);
                const dbSession = await prisma.session.findFirst({
                    where: { token },
                    include: { user: true }
                });

                if (dbSession && dbSession.user && new Date(dbSession.expiresAt) > new Date()) {
                    console.log("[DEBUG] Auth Middleware Fallback: Success for user", dbSession.user.email);
                    session = {
                        session: dbSession as any,
                        user: dbSession.user as any
                    };
                }
            }
        }

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
