import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/db";
import {
    claimIdempotencyKey,
    completeIdempotencyKey,
    resetTravisIdempotencyForTests,
} from "./idempotency";

describe("Travis persistent idempotency", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetTravisIdempotencyForTests();
    });

    afterEach(() => {
        delete (prisma as any).travisIdempotency;
        resetTravisIdempotencyForTests();
    });

    it("treats a unique-key collision as an in-progress confirmation", async () => {
        const model = {
            create: vi
                .fn()
                .mockResolvedValueOnce({ key: "k1" })
                .mockRejectedValueOnce({ code: "P2002" }),
            findUnique: vi.fn().mockResolvedValue({
                key: "k1",
                state: "PENDING",
                ok: null,
            }),
            updateMany: vi.fn(),
        };
        (prisma as any).travisIdempotency = model;

        await expect(
            claimIdempotencyKey("k1", "u1", "ws1", "create_task")
        ).resolves.toEqual({ status: "acquired" });
        await expect(
            claimIdempotencyKey("k1", "u1", "ws1", "create_task")
        ).resolves.toEqual({ status: "pending" });
    });

    it("replays a completed persistent outcome", async () => {
        const outcome = { ok: true, result: { summary: "Created" } };
        const model = {
            create: vi.fn().mockRejectedValue({ code: "P2002" }),
            findUnique: vi.fn().mockResolvedValue({
                key: "k1",
                state: "COMPLETED",
                ...outcome,
            }),
            updateMany: vi.fn(),
        };
        (prisma as any).travisIdempotency = model;

        await expect(
            claimIdempotencyKey("k1", "u1", "ws1", "create_task")
        ).resolves.toEqual({ status: "completed", outcome });
    });

    it("marks only the owned pending claim as completed", async () => {
        const model = {
            create: vi.fn(),
            findUnique: vi.fn(),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        };
        (prisma as any).travisIdempotency = model;

        await completeIdempotencyKey("k1", "u1", "ws1", "create_task", {
            ok: true,
            result: { id: "t1" },
        });

        expect(model.updateMany).toHaveBeenCalledWith({
            where: {
                key: "k1",
                userId: "u1",
                workspaceId: "ws1",
                tool: "create_task",
                state: "PENDING",
            },
            data: {
                state: "COMPLETED",
                ok: true,
                result: { id: "t1" },
            },
        });
    });
});
