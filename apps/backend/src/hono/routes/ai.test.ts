import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { aiRouter } from "./ai";
import { TravisService } from "@/server/services/travis.service";
import prisma from "@/lib/db";
import type { HonoVariables } from "../types";

vi.mock("@/server/services/travis.service", () => ({
    TravisService: { runTurn: vi.fn(), executeConfirmed: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
    default: { workspaceMember: { findUnique: vi.fn() } },
}));

function buildApp(user?: { id: string; email: string }) {
    const app = new Hono<{ Variables: HonoVariables }>();
    app.use("*", async (c, next) => {
        if (user) c.set("user", user as any);
        await next();
    });
    app.route("/ai", aiRouter);
    return app;
}

const post = (app: ReturnType<typeof buildApp>, path: string, body: unknown) =>
    app.request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

describe("POST /ai/chat", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        const res = await post(buildApp(), "/ai/chat", { message: "hi", workspaceId: "ws1" });
        expect(res.status).toBe(401);
    });

    it("returns 400 when message is missing", async () => {
        const res = await post(buildApp({ id: "u1", email: "u@t.com" }), "/ai/chat", {
            workspaceId: "ws1",
        });
        expect(res.status).toBe(400);
    });

    it("returns 400 when message exceeds 2000 chars", async () => {
        const res = await post(buildApp({ id: "u1", email: "u@t.com" }), "/ai/chat", {
            message: "x".repeat(2001),
            workspaceId: "ws1",
        });
        expect(res.status).toBe(400);
    });

    it("returns 403 when the user is not a workspace member", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue(null);
        const res = await post(buildApp({ id: "u1", email: "u@t.com" }), "/ai/chat", {
            message: "hi",
            workspaceId: "other",
        });
        expect(res.status).toBe(403);
        expect((await res.json()).error).toMatch(/not a member/i);
    });

    it("returns the structured event response on success", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1" });
        (TravisService.runTurn as any).mockResolvedValue({
            success: true,
            events: [{ type: "completed", text: "Here are your tasks." }],
            message: "Here are your tasks.",
        });
        const res = await post(buildApp({ id: "u1", email: "u@t.com" }), "/ai/chat", {
            message: "tasks?",
            workspaceId: "ws1",
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toBe("Here are your tasks.");
        expect(body.events[0].type).toBe("completed");
    });

    it("maps a timeout error event to HTTP 504", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1" });
        (TravisService.runTurn as any).mockResolvedValue({
            success: false,
            events: [{ type: "error", code: "timeout", message: "too slow" }],
            message: "too slow",
        });
        const res = await post(buildApp({ id: "u1", email: "u@t.com" }), "/ai/chat", {
            message: "hi",
            workspaceId: "ws1",
        });
        expect(res.status).toBe(504);
    });
});

describe("POST /ai/confirm", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        const res = await post(buildApp(), "/ai/confirm", { confirmationToken: "t" });
        expect(res.status).toBe(401);
    });

    it("returns 400 with no token", async () => {
        const res = await post(buildApp({ id: "u1", email: "u@t.com" }), "/ai/confirm", {});
        expect(res.status).toBe(400);
    });

    it("executes the confirmed write and returns events", async () => {
        (TravisService.executeConfirmed as any).mockResolvedValue({
            success: true,
            events: [
                { type: "entity_card", entity: { type: "task", id: "t1", label: "New task" } },
                { type: "completed", text: "Created" },
            ],
            message: "Created",
        });
        const res = await post(buildApp({ id: "u1", email: "u@t.com" }), "/ai/confirm", {
            confirmationToken: "signed.token",
        });
        expect(res.status).toBe(200);
        expect((await res.json()).message).toBe("Created");
    });

    it("maps an invalid/expired token to HTTP 400", async () => {
        (TravisService.executeConfirmed as any).mockResolvedValue({
            success: false,
            events: [{ type: "error", code: "invalid_request", message: "expired" }],
            message: "expired",
        });
        const res = await post(buildApp({ id: "u1", email: "u@t.com" }), "/ai/confirm", {
            confirmationToken: "bad",
        });
        expect(res.status).toBe(400);
    });
});

describe("Travis conversation routes", () => {
    beforeEach(() => vi.clearAllMocks());

    it("rejects conversation listing after workspace access is revoked", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue(null);

        const res = await buildApp({ id: "u1", email: "u@t.com" }).request(
            "/ai/conversations?workspaceId=ws1"
        );

        expect(res.status).toBe(403);
    });

    it("rejects message history after workspace access is revoked", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue(null);

        const res = await buildApp({ id: "u1", email: "u@t.com" }).request(
            "/ai/conversations/c1/messages?workspaceId=ws1"
        );

        expect(res.status).toBe(403);
    });
});
