import { createMiddleware } from "hono/factory";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { HonoVariables } from "../types";
import { honoUserStorage } from "@/lib/auth/require-user";
import { recordAuthDuration } from "@/lib/observability/request-metrics";

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
    const authStartedAt = performance.now();
    try {
        const authHeader = c.req.header("Authorization");
        const bearerToken = authHeader?.startsWith("Bearer ")
            ? authHeader.substring(7).trim()
            : null;

        // Mobile/API requests already send the unique database session token.
        // Resolve it directly instead of first running Better Auth's
        // cookie-oriented session lookup and then falling back to Prisma.
        let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
        if (bearerToken) {
            const dbSession = await prisma.session.findUnique({
                where: { token: bearerToken },
                include: { user: true },
            });

            if (
                dbSession?.user &&
                new Date(dbSession.expiresAt).getTime() > Date.now()
            ) {
                session = {
                    session: dbSession as any,
                    user: dbSession.user as any,
                } as Awaited<ReturnType<typeof auth.api.getSession>>;
            }
        } else {
            // Browser clients continue to use Better Auth cookie validation.
            session = await auth.api.getSession({
                headers: c.req.raw.headers,
            });
        }

        if (!session || !session.user) {
            recordAuthDuration(performance.now() - authStartedAt);
            return c.json({
                success: false,
                error: "Unauthorized",
                message: "Valid session or bearer token required"
            }, 401);
        }

        // Stash user and session in context
        c.set("user", session.user as any);
        c.set("session", session.session as any);
        recordAuthDuration(performance.now() - authStartedAt);

        return await honoUserStorage.run(
            { user: session.user, session: session.session },
            async () => {
                await next();
            }
        );
    } catch (error) {
        recordAuthDuration(performance.now() - authStartedAt);
        console.error("[AUTH_MIDDLEWARE_ERROR]", error);
        return c.json({
            success: false,
            error: "Authentication error",
        }, 500);
    }
});
