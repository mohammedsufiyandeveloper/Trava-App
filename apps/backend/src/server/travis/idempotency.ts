/**
 * Travis idempotency store.
 *
 * Guarantees a confirmed write runs at most once per idempotency key, even if
 * the client retries the confirm request. Prefers the persistent
 * `travisIdempotency` table; if that table is not present yet (the migration
 * is authored but not applied), it transparently falls back to a bounded
 * in-process map so the feature still works in the current deployment.
 */
import prisma from "@/lib/db";

export interface StoredOutcome {
    ok: boolean;
    /** Minimal JSON describing the result (entity id/label), never secrets. */
    result?: unknown;
}

type MemoryEntry =
    | { state: "PENDING" }
    | { state: "COMPLETED"; outcome: StoredOutcome };

export type ClaimResult =
    | { status: "acquired" }
    | { status: "pending" }
    | { status: "completed"; outcome: StoredOutcome }
    | { status: "unavailable" };

// Development/test fallback. Production writes require the persistent table.
const MEM = new Map<string, MemoryEntry>();
const MEM_MAX = 2000;

let persistentAvailable: boolean | null = null;

function memSet(key: string, entry: MemoryEntry) {
    if (MEM.size >= MEM_MAX) {
        const first = MEM.keys().next().value;
        if (first) MEM.delete(first);
    }
    MEM.set(key, entry);
}

function isMissingTableError(error: any): boolean {
    return error?.code === "P2021" || error?.code === "P2022";
}

export async function claimIdempotencyKey(
    key: string,
    userId: string,
    workspaceId: string,
    tool: string
): Promise<ClaimResult> {
    try {
        const model = (prisma as any).travisIdempotency;
        if (!model?.create) {
            persistentAvailable = false;
            if (process.env.NODE_ENV === "production") return { status: "unavailable" };
        } else {
            await model.create({
                data: { key, userId, workspaceId, tool, state: "PENDING" },
            });
            persistentAvailable = true;
            return { status: "acquired" };
        }
    } catch (err: any) {
        if (err?.code === "P2002") {
            const row = await (prisma as any).travisIdempotency.findUnique({
                where: { key },
            });
            if (row?.state === "COMPLETED" && typeof row.ok === "boolean") {
                return {
                    status: "completed",
                    outcome: { ok: row.ok, result: row.result ?? undefined },
                };
            }
            return { status: "pending" };
        }
        if (isMissingTableError(err)) {
            persistentAvailable = false;
            if (process.env.NODE_ENV === "production") return { status: "unavailable" };
        } else {
            console.error("[Travis] idempotency claim failed:", err?.code || "unknown");
            return { status: "unavailable" };
        }
    }

    const existing = MEM.get(key);
    if (existing?.state === "PENDING") return { status: "pending" };
    if (existing?.state === "COMPLETED") {
        return { status: "completed", outcome: existing.outcome };
    }
    memSet(key, { state: "PENDING" });
    return { status: "acquired" };
}

export async function completeIdempotencyKey(
    key: string,
    userId: string,
    workspaceId: string,
    tool: string,
    outcome: StoredOutcome
): Promise<void> {
    if (persistentAvailable !== false) {
        try {
            const model = (prisma as any).travisIdempotency;
            if (model?.updateMany) {
                await model.updateMany({
                    where: { key, userId, workspaceId, tool, state: "PENDING" },
                    data: {
                        state: "COMPLETED",
                        ok: outcome.ok,
                        result: outcome.result ?? undefined,
                    },
                });
                persistentAvailable = true;
                return;
            }
            persistentAvailable = false;
        } catch (err: any) {
            if (isMissingTableError(err)) persistentAvailable = false;
            else console.error("[Travis] idempotency completion failed:", err?.code || "unknown");
        }
    }
    memSet(key, { state: "COMPLETED", outcome });
}

export function resetTravisIdempotencyForTests() {
    MEM.clear();
    persistentAvailable = null;
}
