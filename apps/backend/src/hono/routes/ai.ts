import { Hono } from "hono";
import { z } from "zod";
import { TravisService } from "@/server/services/travis.service";
import { TravisChatRequestSchema, type TravisEvent } from "@/server/travis/contract";
import { listConversations, listMessages, persistTurn } from "@/server/travis/persistence";
import { HonoVariables } from "../types";
import prisma from "@/lib/db";

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

/** Derive sanitized persistence metadata from the event stream. */
function summarizeEvents(events: TravisEvent[]) {
    const toolName = events.find(
        (e) => e.type === "tool_started" || e.type === "tool_completed"
    ) as { tool?: string } | undefined;
    const entityRefs = events
        .filter((e) => e.type === "entity_card")
        .map((e) => (e as any).entity);
    const errorEvent = events.find((e) => e.type === "error") as { code?: string } | undefined;
    const confirmationState = events.some((e) => e.type === "confirmation_required")
        ? "pending"
        : undefined;
    return {
        toolName: toolName?.tool,
        entityRefs: entityRefs.length ? entityRefs : undefined,
        errorCategory: errorEvent?.code,
        confirmationState,
    };
}

// ---------------------------------------------------------------------------
// In-memory rate limiter: 20 req/min per userId (per instance).
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
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
    return true;
}

setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitStore.entries()) {
        if (now > val.resetAt) rateLimitStore.delete(key);
    }
}, RATE_WINDOW_MS).unref?.();

const ConfirmRequestSchema = z.object({
    confirmationToken: z.string().min(1).max(128_000),
    clientRequestId: z.string().max(100).optional(),
});

// Map a structured error code to an appropriate HTTP status.
function statusForResponse(events: { type: string; code?: string }[]): number {
    const err = events.find((e) => e.type === "error") as { code?: string } | undefined;
    if (!err) return 200;
    switch (err.code) {
        case "unauthorized":
            return 401;
        case "forbidden":
            return 403;
        case "rate_limited":
            return 429;
        case "timeout":
            return 504;
        case "provider_unavailable":
            return 503;
        case "invalid_request":
            return 400;
        case "conflict":
            return 409;
        default:
            return 500;
    }
}

export const aiRouter = new Hono<{ Variables: HonoVariables }>()
    // POST /api/ai/chat — run one Travis turn (reads auto; writes return a preview).
    .post("/chat", async (c) => {
        const user = c.get("user");
        if (!user || !user.id) {
            return c.json({ success: false, error: "Unauthorized" }, 401);
        }
        if (!checkRateLimit(user.id)) {
            return c.json(
                { success: false, error: "Too many requests. Please wait a moment." },
                429
            );
        }

        let body: unknown;
        try {
            body = await c.req.json();
        } catch {
            return c.json({ success: false, error: "Invalid JSON body" }, 400);
        }

        const parsed = TravisChatRequestSchema.safeParse(body);
        if (!parsed.success) {
            return c.json(
                { success: false, error: parsed.error.issues[0]?.message ?? "Invalid request" },
                400
            );
        }
        const req = parsed.data;

        // Pre-check membership for a clean 403 (runTurn re-checks defensively).
        const membership = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId: req.workspaceId } },
            select: { id: true },
        });
        if (!membership) {
            return c.json(
                { success: false, error: "Access denied: not a member of this workspace." },
                403
            );
        }

        const startedAt = performance.now();
        const response = await TravisService.runTurn(user.id, {
            workspaceId: req.workspaceId,
            message: req.message,
            history: req.history,
            conversationId: req.conversationId,
            clientRequestId: req.clientRequestId,
            timezone: req.timezone,
            locale: req.locale,
            selectedProjectId: req.selectedProjectId,
            selectedTaskId: req.selectedTaskId,
        });
        const latencyMs = Math.round(performance.now() - startedAt);

        // Best-effort persistence (no-op until the migration is applied).
        const meta = summarizeEvents(response.events);
        const conversationId = await persistTurn({
            userId: user.id,
            workspaceId: req.workspaceId,
            conversationId: req.conversationId,
            userMessage: req.message,
            assistantMessage: response.message ?? "",
            toolName: meta.toolName,
            toolOutcome: response.success ? "ok" : "error",
            entityRefs: meta.entityRefs,
            confirmationState: meta.confirmationState,
            model: GEMINI_MODEL,
            latencyMs,
            errorCategory: meta.errorCategory,
        });
        if (conversationId) response.conversationId = conversationId;

        c.header("Server-Timing", `travis;dur=${latencyMs}`);
        return c.json(response, statusForResponse(response.events) as any);
    })

    // GET /api/ai/conversations?workspaceId=&cursor= — list the caller's threads.
    .get("/conversations", async (c) => {
        const user = c.get("user");
        if (!user?.id) return c.json({ success: false, error: "Unauthorized" }, 401);
        const workspaceId = c.req.query("workspaceId");
        if (!workspaceId) return c.json({ success: false, error: "workspaceId is required" }, 400);
        const membership = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId } },
            select: { id: true },
        });
        if (!membership) return c.json({ success: false, error: "Forbidden" }, 403);
        const cursor = c.req.query("cursor") || undefined;
        const data = await listConversations(user.id, workspaceId, 20, cursor);
        return c.json({ success: true, ...data });
    })

    // GET /api/ai/conversations/:id/messages — messages in an owned thread.
    .get("/conversations/:id/messages", async (c) => {
        const user = c.get("user");
        if (!user?.id) return c.json({ success: false, error: "Unauthorized" }, 401);
        const id = c.req.param("id");
        const workspaceId = c.req.query("workspaceId");
        if (!workspaceId) {
            return c.json({ success: false, error: "workspaceId is required" }, 400);
        }
        const membership = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: user.id, workspaceId } },
            select: { id: true },
        });
        if (!membership) return c.json({ success: false, error: "Forbidden" }, 403);
        const result = await listMessages(user.id, workspaceId, id);
        if (!result.ok && (result as any).error === "Forbidden") {
            return c.json({ success: false, error: "Forbidden" }, 403);
        }
        return c.json({ success: true, messages: result.messages });
    })

    // POST /api/ai/confirm — execute a previously-previewed write after the user confirms.
    .post("/confirm", async (c) => {
        const user = c.get("user");
        if (!user || !user.id) {
            return c.json({ success: false, error: "Unauthorized" }, 401);
        }
        if (!checkRateLimit(user.id)) {
            return c.json(
                { success: false, error: "Too many requests. Please wait a moment." },
                429
            );
        }

        let body: unknown;
        try {
            body = await c.req.json();
        } catch {
            return c.json({ success: false, error: "Invalid JSON body" }, 400);
        }

        const parsed = ConfirmRequestSchema.safeParse(body);
        if (!parsed.success) {
            return c.json({ success: false, error: "Invalid confirmation request" }, 400);
        }

        const response = await TravisService.executeConfirmed(
            user.id,
            parsed.data.confirmationToken
        );
        return c.json(response, statusForResponse(response.events) as any);
    });
