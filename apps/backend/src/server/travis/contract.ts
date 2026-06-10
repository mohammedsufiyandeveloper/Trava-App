/**
 * Travis API Contract
 * --------------------
 * The single source of truth for the request shape and the structured event
 * stream exchanged between the mobile client and the Travis backend.
 *
 * The transport is streaming-ready: events are a discriminated union that can
 * be delivered either as a single JSON envelope (current Gemini runtime) or as
 * a sequence of SSE/NDJSON frames without changing the contract.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/** A single prior turn supplied by the client. Only user/assistant roles are
 * accepted; system messages are never trusted from the client. */
export const TravisHistoryMessageSchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(8000),
});
export type TravisHistoryMessage = z.infer<typeof TravisHistoryMessageSchema>;

export const TravisChatRequestSchema = z.object({
    /** Stable id for the conversation thread (client-generated until persisted). */
    conversationId: z.string().min(1).max(100).optional(),
    /** The user's new message. */
    message: z.string().min(1).max(2000),
    /** Active workspace the request is scoped to. */
    workspaceId: z.string().min(1),
    /** Where the user is in the app, used only for suggestion/intent hints. */
    currentScreen: z.string().max(60).optional(),
    /** Optional selected entities — always re-verified server-side, never trusted. */
    selectedProjectId: z.string().max(100).optional(),
    selectedTaskId: z.string().max(100).optional(),
    /** IANA timezone, e.g. "Asia/Kolkata". Falls back to UTC if invalid. */
    timezone: z.string().max(64).optional(),
    /** BCP-47 locale, e.g. "en-IN". */
    locale: z.string().max(20).optional(),
    /** Client-generated idempotency key for the *turn* (dedupes double submits). */
    clientRequestId: z.string().min(1).max(100).optional(),
    /** Prior turns. Capped; sanitized server-side. */
    history: z.array(TravisHistoryMessageSchema).max(20).optional().default([]),
    /** Confirmation token returned by a prior `confirmation_required` event. */
    confirmationToken: z.string().max(128_000).optional(),
});
export type TravisChatRequest = z.infer<typeof TravisChatRequestSchema>;

// ---------------------------------------------------------------------------
// Structured entity cards
// ---------------------------------------------------------------------------

/** A renderable reference to a real entity. `id` is always a verified DB id. */
export const EntityRefSchema = z.object({
    type: z.enum([
        "task",
        "subtask",
        "project",
        "member",
        "leave",
        "indent",
        "daily_report",
        "attendance",
    ]),
    id: z.string(),
    label: z.string(),
    sublabel: z.string().optional(),
    status: z.string().optional(),
    /** Deep-link route the mobile app can navigate to. */
    route: z.string().optional(),
});
export type EntityRef = z.infer<typeof EntityRefSchema>;

// ---------------------------------------------------------------------------
// Confirmation preview (write/destructive operations)
// ---------------------------------------------------------------------------

export const ConfirmationFieldSchema = z.object({
    label: z.string(),
    value: z.string(),
});

export const ConfirmationPreviewSchema = z.object({
    /** The write tool that will run on confirm. */
    tool: z.string(),
    /** Human title, e.g. "Create task". */
    title: z.string(),
    /** Plain-language summary of what will happen. */
    summary: z.string(),
    /** Field-by-field preview of the proposed change. */
    fields: z.array(ConfirmationFieldSchema),
    /** True for delete/cancel-type operations — render a stronger warning. */
    destructive: z.boolean().default(false),
    /** Entity affected by a destructive op, if any. */
    affectedEntity: EntityRefSchema.optional(),
    /** Signed, short-lived token the client echoes back to execute. */
    token: z.string(),
    /** Unix ms expiry, surfaced so the client can show/grey-out the action. */
    expiresAt: z.number(),
});
export type ConfirmationPreview = z.infer<typeof ConfirmationPreviewSchema>;

// ---------------------------------------------------------------------------
// Structured event stream (discriminated union on `type`)
// ---------------------------------------------------------------------------

export const TravisEventSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("text_delta"), text: z.string() }),
    z.object({
        type: z.literal("tool_started"),
        tool: z.string(),
        label: z.string(),
    }),
    z.object({
        type: z.literal("tool_completed"),
        tool: z.string(),
        ok: z.boolean(),
        /** Optional one-line outcome for progress UI. */
        summary: z.string().optional(),
    }),
    z.object({ type: z.literal("entity_card"), entity: EntityRefSchema }),
    z.object({
        type: z.literal("confirmation_required"),
        preview: ConfirmationPreviewSchema,
    }),
    z.object({
        type: z.literal("navigation"),
        route: z.string(),
        entity: EntityRefSchema.optional(),
    }),
    z.object({
        type: z.literal("completed"),
        /** Final assembled assistant text (also streamed via text_delta). */
        text: z.string(),
        conversationId: z.string().optional(),
    }),
    z.object({
        type: z.literal("error"),
        /** Stable machine code for client handling. */
        code: z.enum([
            "unauthorized",
            "forbidden",
            "rate_limited",
            "timeout",
            "provider_unavailable",
            "invalid_request",
            "conflict",
            "internal",
        ]),
        message: z.string(),
    }),
]);
export type TravisEvent = z.infer<typeof TravisEventSchema>;

/** Non-streaming envelope: the ordered list of events for one turn. */
export const TravisChatResponseSchema = z.object({
    success: z.boolean(),
    conversationId: z.string().optional(),
    events: z.array(TravisEventSchema),
    /** Convenience mirror of the final `completed`/`error` text for simple clients. */
    message: z.string().optional(),
});
export type TravisChatResponse = z.infer<typeof TravisChatResponseSchema>;

// ---------------------------------------------------------------------------
// Event builder helpers (keep producers consistent and typed)
// ---------------------------------------------------------------------------

export const TravisEvents = {
    textDelta: (text: string): TravisEvent => ({ type: "text_delta", text }),
    toolStarted: (tool: string, label: string): TravisEvent => ({
        type: "tool_started",
        tool,
        label,
    }),
    toolCompleted: (tool: string, ok: boolean, summary?: string): TravisEvent => ({
        type: "tool_completed",
        tool,
        ok,
        summary,
    }),
    entityCard: (entity: EntityRef): TravisEvent => ({ type: "entity_card", entity }),
    confirmationRequired: (preview: ConfirmationPreview): TravisEvent => ({
        type: "confirmation_required",
        preview,
    }),
    navigation: (route: string, entity?: EntityRef): TravisEvent => ({
        type: "navigation",
        route,
        entity,
    }),
    completed: (text: string, conversationId?: string): TravisEvent => ({
        type: "completed",
        text,
        conversationId,
    }),
    error: (
        code: Extract<TravisEvent, { type: "error" }>["code"],
        message: string
    ): TravisEvent => ({ type: "error", code, message }),
} as const;
