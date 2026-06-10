import { describe, it, expect, vi, beforeEach } from "vitest";
import { TravisService } from "@/server/services/travis.service";
import { TasksService } from "@/server/services/tasks.service";
import prisma from "@/lib/db";
import { resetTravisIdempotencyForTests } from "./idempotency";

const { mockSendMessage } = vi.hoisted(() => ({ mockSendMessage: vi.fn() }));

vi.mock("@google/generative-ai", async (importActual) => {
    const actual = await importActual<typeof import("@google/generative-ai")>();
    class MockGoogleGenerativeAI {
        constructor(_k?: string) {}
        getGenerativeModel() {
            return { startChat: () => ({ sendMessage: mockSendMessage }) };
        }
    }
    return { ...actual, GoogleGenerativeAI: MockGoogleGenerativeAI };
});

vi.mock("@/lib/db", () => ({
    default: {
        workspaceMember: { findUnique: vi.fn(), findFirst: vi.fn() },
        project: { findMany: vi.fn(), findFirst: vi.fn() },
        projectMember: { findMany: vi.fn() },
        task: { findFirst: vi.fn() },
        // travisIdempotency intentionally absent → in-memory fallback path.
    },
}));

vi.mock("@/lib/audit", () => ({ recordActivity: vi.fn() }));
vi.mock("@/data/user/get-user-permissions", () => ({
    getUserPermissions: vi.fn().mockResolvedValue({ isWorkspaceAdmin: true }),
}));
vi.mock("@/server/services/tasks.service", () => ({
    TasksService: { createTask: vi.fn() },
}));

function geminiResult(opts: { functionCalls?: { name: string; args: any }[]; text?: string }) {
    const calls = opts.functionCalls ?? [];
    return {
        response: {
            functionCalls: () => (calls.length > 0 ? calls : undefined),
            text: () => opts.text ?? "",
        },
    };
}

function asAdmin() {
    (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "ADMIN" });
    (prisma.project.findMany as any).mockResolvedValue([{ id: "p1" }]);
}

describe("Travis write confirmation flow", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetTravisIdempotencyForTests();
        process.env.BETTER_AUTH_SECRET = "test-secret-key-for-hmac";
    });

    it("does NOT execute a write from the model response; returns a confirmation instead", async () => {
        asAdmin();
        (prisma.project.findFirst as any).mockResolvedValue({ name: "Apollo" });
        mockSendMessage.mockResolvedValueOnce(
            geminiResult({ functionCalls: [{ name: "create_task", args: { projectId: "p1", name: "Ship it" } }] })
        );

        const res = await TravisService.runTurn("u1", {
            workspaceId: "ws1",
            message: "create a task to ship it in p1",
            clientRequestId: "req-123",
        });

        const confirm = res.events.find((e) => e.type === "confirmation_required");
        expect(confirm).toBeDefined();
        // Nothing was created.
        expect(TasksService.createTask).not.toHaveBeenCalled();
        // The model was only asked once (no tool-result round-trip for writes).
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it("executes a confirmed write exactly once and is idempotent on retry", async () => {
        asAdmin();
        (prisma.project.findFirst as any).mockResolvedValue({ name: "Apollo" });
        (TasksService.createTask as any).mockResolvedValue({ id: "task-1", name: "Ship it" });
        mockSendMessage.mockResolvedValueOnce(
            geminiResult({ functionCalls: [{ name: "create_task", args: { projectId: "p1", name: "Ship it" } }] })
        );

        const turn = await TravisService.runTurn("u1", {
            workspaceId: "ws1",
            message: "create a task",
            clientRequestId: "req-xyz",
        });
        const confirm = turn.events.find((e) => e.type === "confirmation_required") as any;
        const token = confirm.preview.token;

        const first = await TravisService.executeConfirmed("u1", token);
        expect(first.success).toBe(true);
        expect(TasksService.createTask).toHaveBeenCalledTimes(1);
        expect(first.events.some((e) => e.type === "entity_card")).toBe(true);

        // Replaying the same token must not create a second task.
        const second = await TravisService.executeConfirmed("u1", token);
        expect(second.success).toBe(true);
        expect(TasksService.createTask).toHaveBeenCalledTimes(1);
        expect(second.message).toMatch(/already completed/i);
    });

    it("allows only one concurrent confirmation to execute", async () => {
        asAdmin();
        (prisma.project.findFirst as any).mockResolvedValue({ name: "Apollo" });
        let release: (() => void) | undefined;
        (TasksService.createTask as any).mockImplementation(
            () =>
                new Promise((resolve) => {
                    release = () => resolve({ id: "task-1", name: "Ship it" });
                })
        );
        mockSendMessage.mockResolvedValueOnce(
            geminiResult({
                functionCalls: [
                    { name: "create_task", args: { projectId: "p1", name: "Ship it" } },
                ],
            })
        );
        const turn = await TravisService.runTurn("u1", {
            workspaceId: "ws1",
            message: "create a task",
            clientRequestId: "concurrent-request",
        });
        const token = (
            turn.events.find((e) => e.type === "confirmation_required") as any
        ).preview.token;

        const first = TravisService.executeConfirmed("u1", token);
        const second = await TravisService.executeConfirmed("u1", token);
        expect(second.success).toBe(false);
        expect(second.message).toMatch(/already being processed/i);

        release?.();
        await expect(first).resolves.toMatchObject({ success: true });
        expect(TasksService.createTask).toHaveBeenCalledTimes(1);
    });

    it("rejects a confirmation token belonging to another user", async () => {
        asAdmin();
        (prisma.project.findFirst as any).mockResolvedValue({ name: "Apollo" });
        mockSendMessage.mockResolvedValueOnce(
            geminiResult({ functionCalls: [{ name: "create_task", args: { projectId: "p1", name: "X" } }] })
        );
        const turn = await TravisService.runTurn("u1", {
            workspaceId: "ws1",
            message: "create",
            clientRequestId: "r1",
        });
        const token = (turn.events.find((e) => e.type === "confirmation_required") as any).preview.token;

        const res = await TravisService.executeConfirmed("attacker", token);
        expect(res.success).toBe(false);
        expect(res.events.some((e) => e.type === "error")).toBe(true);
        expect(TasksService.createTask).not.toHaveBeenCalled();
    });

    it("rejects a write proposed against an out-of-scope project", async () => {
        // Non-admin who only has access to p1; model proposes create_task in p2.
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "MANAGER" });
        (prisma.projectMember.findMany as any).mockResolvedValue([{ projectId: "p1" }]);
        mockSendMessage.mockResolvedValueOnce(
            geminiResult({ functionCalls: [{ name: "create_task", args: { projectId: "p2", name: "X" } }] })
        );
        const res = await TravisService.runTurn("u1", {
            workspaceId: "ws1",
            message: "create in p2",
            clientRequestId: "r2",
        });
        // No confirmation issued; a denial message is returned instead.
        expect(res.events.some((e) => e.type === "confirmation_required")).toBe(false);
        expect(res.message).toMatch(/access/i);
        expect(TasksService.createTask).not.toHaveBeenCalled();
    });
});
