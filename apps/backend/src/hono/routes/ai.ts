import { Hono } from "hono";
import { z } from "zod";
import { TravisService, TravisMessage } from "@/server/services/travis.service";
import { HonoVariables } from "../types";
import prisma from "@/lib/db";

// ---------------------------------------------------------------------------
// In-memory rate limiter: 20 req/min per userId
// ---------------------------------------------------------------------------
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = rateLimitStore.get(userId);

    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT) {
        return false;
    }

    entry.count++;
    return true;
}

// Periodically clean up expired entries to avoid memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitStore.entries()) {
        if (now > val.resetAt) rateLimitStore.delete(key);
    }
}, RATE_WINDOW_MS);

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------
const ChatRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    history: z
        .array(
            z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
            })
        )
        .max(20)
        .optional()
        .default([]),
    workspaceId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export const aiRouter = new Hono<{ Variables: HonoVariables }>().post(
    "/chat",
    async (c) => {
        const user = c.get("user");
        if (!user || !user.id) {
            return c.json({ success: false, error: "Unauthorized" }, 401);
        }

        // Rate limiting
        if (!checkRateLimit(user.id)) {
            return c.json(
                {
                    success: false,
                    error: "Too many requests. Please wait a moment before trying again.",
                },
                429
            );
        }

        // Parse and validate body
        let body: unknown;
        try {
            body = await c.req.json();
        } catch {
            return c.json({ success: false, error: "Invalid JSON body" }, 400);
        }

        const parsed = ChatRequestSchema.safeParse(body);
        if (!parsed.success) {
            return c.json(
                { success: false, error: parsed.error.message ?? "Invalid request" },
                400
            );
        }

        const { message, history, workspaceId } = parsed.data;

        // Verify user belongs to the requested workspace
        const membership = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId } },
            select: { id: true },
        });

        if (!membership) {
            return c.json(
                { success: false, error: "Access denied: not a member of this workspace." },
                403
            );
        }

        // Sanitize history: drop any system-role messages, keep only user/assistant
        const safeHistory: TravisMessage[] = history
            .filter((h) => h.role === "user" || h.role === "assistant")
            .map((h) => ({ role: h.role, content: h.content }));

        try {
            const reply = await TravisService.chat(
                workspaceId,
                user.id,
                message,
                safeHistory
            );

            return c.json({ success: true, data: { message: reply } });
        } catch (err: any) {
            if (err?.message === "TIMEOUT") {
                return c.json(
                    {
                        success: false,
                        error: "Travis is taking too long to respond. Please try again.",
                    },
                    504
                );
            }
            console.error("[Travis Route] Error:", err?.message);
            return c.json(
                { success: false, error: "Internal server error" },
                500
            );
        }
    }
);
