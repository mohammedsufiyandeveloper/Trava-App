import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { aiRouter } from "./ai";
import { TravisService } from "@/server/services/travis.service";
import prisma from "@/lib/db";
import type { HonoVariables } from "../types";

// Mock TravisService
vi.mock("@/server/services/travis.service", () => ({
    TravisService: {
        chat: vi.fn(),
    },
}));

// Mock prisma
vi.mock("@/lib/db", () => ({
    default: {
        workspaceMember: {
            findUnique: vi.fn(),
        },
    },
}));

// Build a test app that injects a user into context
function buildApp(user?: { id: string; email: string }) {
    const app = new Hono<{ Variables: HonoVariables }>();
    app.use("*", async (c, next) => {
        if (user) c.set("user", user as any);
        await next();
    });
    app.route("/ai", aiRouter);
    return app;
}

describe("POST /ai/chat", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        const app = buildApp(); // no user
        const res = await app.request("/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "hello", workspaceId: "ws1" }),
        });
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.success).toBe(false);
    });

    it("returns 400 when message is missing", async () => {
        const app = buildApp({ id: "user1", email: "u@test.com" });
        const res = await app.request("/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspaceId: "ws1" }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
    });

    it("returns 400 when message exceeds 2000 chars", async () => {
        const app = buildApp({ id: "user1", email: "u@test.com" });
        const res = await app.request("/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "x".repeat(2001), workspaceId: "ws1" }),
        });
        expect(res.status).toBe(400);
    });

    it("returns 403 when user is not a workspace member", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue(null);
        const app = buildApp({ id: "user1", email: "u@test.com" });
        const res = await app.request("/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "hello", workspaceId: "other-workspace" }),
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toMatch(/not a member/i);
    });

    it("succeeds with a valid request", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1" });
        (TravisService.chat as any).mockResolvedValue("Here are your tasks.");

        const app = buildApp({ id: "user1", email: "u@test.com" });
        const res = await app.request("/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "What are my tasks?", workspaceId: "ws1" }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.message).toBe("Here are your tasks.");
    });

    it("strips system-role messages from history", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1" });
        (TravisService.chat as any).mockResolvedValue("OK");

        const app = buildApp({ id: "user1", email: "u@test.com" });
        await app.request("/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "hello",
                workspaceId: "ws1",
                history: [
                    { role: "user", content: "hi" },
                    { role: "assistant", content: "hello" },
                ],
            }),
        });

        // Verify that TravisService.chat was called with only user/assistant messages
        expect(TravisService.chat).toHaveBeenCalledWith(
            "ws1",
            "user1",
            "hello",
            [
                { role: "user", content: "hi" },
                { role: "assistant", content: "hello" },
            ]
        );
    });

    it("handles timeout from TravisService", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1" });
        (TravisService.chat as any).mockRejectedValue(new Error("TIMEOUT"));

        const app = buildApp({ id: "user1", email: "u@test.com" });
        const res = await app.request("/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "hello", workspaceId: "ws1" }),
        });

        expect(res.status).toBe(504);
        const body = await res.json();
        expect(body.error).toMatch(/taking too long/i);
    });
});
