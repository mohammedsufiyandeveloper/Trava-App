import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { authMiddleware } from "./auth";
import { HonoVariables } from "../types";

const app = new Hono<{ Variables: HonoVariables }>();
app.use("*", authMiddleware);
app.get("/", (c) => c.json({ userId: c.get("user").id }));

describe("auth middleware", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("resolves bearer sessions with one unique-token lookup", async () => {
        (prisma.session.findUnique as any).mockResolvedValue({
            id: "s1",
            token: "token-1",
            expiresAt: new Date(Date.now() + 60_000),
            user: { id: "u1" },
        });

        const response = await app.request("/", {
            headers: { Authorization: "Bearer token-1" },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ userId: "u1" });
        expect(prisma.session.findUnique).toHaveBeenCalledWith({
            where: { token: "token-1" },
            include: { user: true },
        });
        expect(auth.api.getSession).not.toHaveBeenCalled();
    });

    it("rejects expired bearer sessions without a cookie lookup", async () => {
        (prisma.session.findUnique as any).mockResolvedValue({
            id: "s1",
            token: "expired",
            expiresAt: new Date(Date.now() - 60_000),
            user: { id: "u1" },
        });

        const response = await app.request("/", {
            headers: { Authorization: "Bearer expired" },
        });

        expect(response.status).toBe(401);
        expect(auth.api.getSession).not.toHaveBeenCalled();
    });

    it("keeps Better Auth cookie validation for browser requests", async () => {
        (auth.api.getSession as any).mockResolvedValue({
            session: { id: "s2" },
            user: { id: "u2" },
        });

        const response = await app.request("/");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ userId: "u2" });
        expect(prisma.session.findUnique).not.toHaveBeenCalled();
    });
});
