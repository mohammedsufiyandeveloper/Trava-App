/**
 * Travis conversation persistence (Phase 7).
 *
 * Stores sanitized turns: the user message, the assistant reply, the tool used,
 * its outcome, entity references, confirmation state, and model/latency/error
 * metadata. It NEVER stores secrets, auth headers, raw SQL, or full tool
 * arguments containing free text beyond what the user already sent.
 *
 * All access is guarded: if the `travisConversation`/`travisMessage` tables are
 * not present yet (migration authored but not applied), every function degrades
 * to a no-op / empty result so the assistant keeps working with client-supplied
 * history.
 */
import prisma from "@/lib/db";

const db = prisma as any;

// Cached availability: once a query fails because the tables are not yet
// migrated, stop attempting (and hammering) them until the process restarts.
let available: boolean | null = null;

function hasModels(): boolean {
    if (available === false) return false;
    return !!db?.travisConversation?.create && !!db?.travisMessage?.createMany;
}

function isMissingTableError(error: any): boolean {
    return error?.code === "P2021" || error?.code === "P2022";
}

function handlePersistenceError(error: any) {
    if (isMissingTableError(error)) {
        available = false;
        return;
    }
    console.error("[Travis] conversation persistence failed:", error?.code || "unknown");
}

export interface PersistTurnInput {
    userId: string;
    workspaceId: string;
    conversationId?: string;
    userMessage: string;
    assistantMessage: string;
    toolName?: string;
    toolOutcome?: string;
    entityRefs?: unknown;
    confirmationState?: string;
    model?: string;
    latencyMs?: number;
    errorCategory?: string;
}

/** Persist one turn. Returns the conversation id (or undefined if disabled). */
export async function persistTurn(input: PersistTurnInput): Promise<string | undefined> {
    if (!hasModels()) return input.conversationId;
    try {
        let conversationId = input.conversationId;

        // Verify/own the conversation, or create a new one.
        if (conversationId) {
            const existing = await db.travisConversation.findUnique({
                where: { id: conversationId },
                select: { userId: true, workspaceId: true },
            });
            if (!existing || existing.userId !== input.userId || existing.workspaceId !== input.workspaceId) {
                conversationId = undefined; // not theirs — start a fresh thread
            }
        }
        if (!conversationId) {
            const created = await db.travisConversation.create({
                data: {
                    workspaceId: input.workspaceId,
                    userId: input.userId,
                    title: input.userMessage.slice(0, 80),
                },
                select: { id: true },
            });
            conversationId = created.id as string;
        } else {
            await db.travisConversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            });
        }

        await db.travisMessage.createMany({
            data: [
                { conversationId, role: "user", content: input.userMessage.slice(0, 8000) },
                {
                    conversationId,
                    role: "assistant",
                    content: input.assistantMessage.slice(0, 8000),
                    toolName: input.toolName ?? null,
                    toolOutcome: input.toolOutcome ?? null,
                    entityRefs: input.entityRefs ?? undefined,
                    confirmationState: input.confirmationState ?? null,
                    model: input.model ?? null,
                    latencyMs: input.latencyMs ?? null,
                    errorCategory: input.errorCategory ?? null,
                },
            ],
        });

        available = true;
        return conversationId;
    } catch (error: any) {
        handlePersistenceError(error);
        return input.conversationId; // never break a turn on a persistence failure
    }
}

/** List a user's conversations in a workspace (ownership-scoped, paginated). */
export async function listConversations(
    userId: string,
    workspaceId: string,
    limit = 20,
    cursor?: string
) {
    if (!hasModels()) return { conversations: [], hasMore: false, nextCursor: null };
    try {
        const rows = await db.travisConversation.findMany({
            where: { userId, workspaceId },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: Math.min(limit, 50) + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: { id: true, title: true, updatedAt: true },
        });
        const capped = Math.min(limit, 50);
        const hasMore = rows.length > capped;
        const page = rows.slice(0, capped);
        return {
            conversations: page,
            hasMore,
            nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
        };
    } catch (error: any) {
        handlePersistenceError(error);
        return { conversations: [], hasMore: false, nextCursor: null };
    }
}

/** List messages in a conversation the caller owns (ownership-checked). */
export async function listMessages(
    userId: string,
    workspaceId: string,
    conversationId: string,
    limit = 50
) {
    if (!hasModels()) return { messages: [], ok: true };
    try {
        const convo = await db.travisConversation.findUnique({
            where: { id: conversationId },
            select: { userId: true, workspaceId: true },
        });
        if (!convo) return { messages: [], ok: false, error: "Not found" };
        if (convo.userId !== userId || convo.workspaceId !== workspaceId) {
            return { messages: [], ok: false, error: "Forbidden" };
        }
        const messages = await db.travisMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
            take: Math.min(limit, 200),
            select: {
                id: true,
                role: true,
                content: true,
                entityRefs: true,
                confirmationState: true,
                createdAt: true,
            },
        });
        return { messages, ok: true };
    } catch (error: any) {
        handlePersistenceError(error);
        return { messages: [], ok: true };
    }
}

export async function loadConversationHistory(
    userId: string,
    workspaceId: string,
    conversationId: string,
    limit = 20
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    if (!hasModels()) return [];
    try {
        const conversation = await db.travisConversation.findFirst({
            where: { id: conversationId, userId, workspaceId },
            select: { id: true },
        });
        if (!conversation) return [];

        const rows = await db.travisMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "desc" },
            take: Math.min(limit, 40),
            select: { role: true, content: true },
        });
        return rows
            .reverse()
            .filter(
                (row: any) =>
                    (row.role === "user" || row.role === "assistant") &&
                    typeof row.content === "string"
            )
            .map((row: any) => ({ role: row.role, content: row.content.slice(0, 8000) }));
    } catch (error: any) {
        handlePersistenceError(error);
        return [];
    }
}
