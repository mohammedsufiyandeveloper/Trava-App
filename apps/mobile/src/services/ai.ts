import { apiFetch } from "./api";

// ---------------------------------------------------------------------------
// Travis contract (mirrors apps/backend/src/server/travis/contract.ts)
// ---------------------------------------------------------------------------

export interface TravisHistoryMessage {
    role: "user" | "assistant";
    content: string;
}

export interface EntityRef {
    type:
        | "task"
        | "subtask"
        | "project"
        | "member"
        | "leave"
        | "indent"
        | "daily_report"
        | "attendance";
    id: string;
    label: string;
    sublabel?: string;
    status?: string;
    route?: string;
}

export interface ConfirmationPreview {
    tool: string;
    title: string;
    summary: string;
    fields: { label: string; value: string }[];
    destructive: boolean;
    affectedEntity?: EntityRef;
    token: string;
    expiresAt: number;
}

export type TravisEvent =
    | { type: "text_delta"; text: string }
    | { type: "tool_started"; tool: string; label: string }
    | { type: "tool_completed"; tool: string; ok: boolean; summary?: string }
    | { type: "entity_card"; entity: EntityRef }
    | { type: "confirmation_required"; preview: ConfirmationPreview }
    | { type: "navigation"; route: string; entity?: EntityRef }
    | { type: "completed"; text: string; conversationId?: string }
    | {
          type: "error";
          code:
              | "unauthorized"
              | "forbidden"
              | "rate_limited"
              | "timeout"
              | "provider_unavailable"
              | "invalid_request"
              | "conflict"
              | "internal";
          message: string;
      };

export interface TravisChatResponse {
    success: boolean;
    conversationId?: string;
    events: TravisEvent[];
    message?: string;
}

export interface SendTravisInput {
    workspaceId: string;
    message: string;
    history?: TravisHistoryMessage[];
    conversationId?: string;
    currentScreen?: string;
    selectedProjectId?: string;
    selectedTaskId?: string;
    clientRequestId?: string;
}

const TIMEOUT_MS = 35_000;

function errorResponse(
    code: Extract<TravisEvent, { type: "error" }>["code"],
    message: string
): TravisChatResponse {
    return { success: false, events: [{ type: "error", code, message }], message };
}

async function callTravis(
    path: string,
    body: unknown,
    signal?: AbortSignal
): Promise<TravisChatResponse> {
    // Compose the caller's abort signal with our own timeout.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = () => controller.abort();
    if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", onAbort);
    }

    try {
        const res = await apiFetch(path, {
            method: "POST",
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (res.status === 429) {
            return errorResponse("rate_limited", "You're sending messages too fast. Please wait a moment.");
        }
        if (res.status === 504) {
            return errorResponse("timeout", "Travis is taking too long to respond. Please try again.");
        }
        if (res.status === 503) {
            return errorResponse("provider_unavailable", "Travis is temporarily unavailable. Please try again shortly.");
        }

        const data = (await res.json().catch(() => null)) as TravisChatResponse | null;
        if (!data || !Array.isArray(data.events)) {
            if (!res.ok) return errorResponse("internal", `Server error (${res.status}).`);
            return errorResponse("internal", "Unexpected response from Travis.");
        }
        return data;
    } catch (error: any) {
        if (error?.name === "AbortError") {
            if (signal?.aborted) return errorResponse("internal", "Cancelled.");
            return errorResponse("timeout", "Travis is taking too long to respond. Please try again.");
        }
        const msg = String(error?.message ?? "").toLowerCase();
        if (msg.includes("network") || msg.includes("fetch")) {
            return errorResponse("internal", "Unable to connect. Please check your internet connection.");
        }
        return errorResponse("internal", error?.message || "Failed to reach Travis.");
    } finally {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener("abort", onAbort);
    }
}

/** Send a message to Travis and receive the structured event stream. */
export function sendTravisMessage(
    input: SendTravisInput,
    signal?: AbortSignal
): Promise<TravisChatResponse> {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return callTravis(
        "/api/ai/chat",
        {
            workspaceId: input.workspaceId,
            message: input.message,
            history: input.history ?? [],
            conversationId: input.conversationId,
            currentScreen: input.currentScreen,
            selectedProjectId: input.selectedProjectId,
            selectedTaskId: input.selectedTaskId,
            clientRequestId: input.clientRequestId,
            timezone,
            locale: "en-US",
        },
        signal
    );
}

/** Confirm and execute a previously-previewed write operation. */
export function confirmTravisAction(
    confirmationToken: string,
    clientRequestId?: string,
    signal?: AbortSignal
): Promise<TravisChatResponse> {
    return callTravis("/api/ai/confirm", { confirmationToken, clientRequestId }, signal);
}

// Helpers for the screen ----------------------------------------------------

export function extractText(events: TravisEvent[]): string {
    const completed = events.find((e) => e.type === "completed") as
        | Extract<TravisEvent, { type: "completed" }>
        | undefined;
    if (completed) return completed.text;
    const err = events.find((e) => e.type === "error") as
        | Extract<TravisEvent, { type: "error" }>
        | undefined;
    if (err) return err.message;
    const deltas = events.filter((e) => e.type === "text_delta") as Extract<
        TravisEvent,
        { type: "text_delta" }
    >[];
    return deltas.map((d) => d.text).join("");
}

export function extractCards(events: TravisEvent[]): EntityRef[] {
    return events
        .filter((e) => e.type === "entity_card")
        .map((e) => (e as Extract<TravisEvent, { type: "entity_card" }>).entity);
}

export function extractConfirmation(events: TravisEvent[]): ConfirmationPreview | undefined {
    const e = events.find((e) => e.type === "confirmation_required") as
        | Extract<TravisEvent, { type: "confirmation_required" }>
        | undefined;
    return e?.preview;
}

export function extractNavigation(
    events: TravisEvent[]
): { route: string; entity?: EntityRef } | undefined {
    const e = events.find((e) => e.type === "navigation") as
        | Extract<TravisEvent, { type: "navigation" }>
        | undefined;
    return e ? { route: e.route, entity: e.entity } : undefined;
}
