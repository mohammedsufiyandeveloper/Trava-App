import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/db";
import { conversationsRouter } from "./conversations";
import { HonoVariables } from "../types";

const app = new Hono<{ Variables: HonoVariables }>();
app.use("*", async (c, next) => {
    c.set("user", { id: "u1" } as any);
    await next();
});
app.route("/conversations", conversationsRouter);

describe("conversation message pagination", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.conversation.findUnique as any).mockResolvedValue({
            id: "cv1",
            UserConversations: [{ A: "u1" }, { A: "u2" }],
        });
    });

    it("clamps the page size and returns an older-message cursor", async () => {
        (prisma.directMessage.findMany as any).mockResolvedValue([
            {
                id: "m3",
                content: "new",
                createdAt: new Date(3),
                senderId: "u1",
                sender: { id: "u1", name: "One", surname: null, image: null },
            },
            {
                id: "m2",
                content: "old",
                createdAt: new Date(2),
                senderId: "u2",
                sender: { id: "u2", name: "Two", surname: null, image: null },
            },
        ]);

        const response = await app.request(
            "/conversations/cv1/messages?limit=1&cursor=m4"
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.directMessage.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 2,
                cursor: { id: "m4" },
                skip: 1,
            })
        );
        expect(body.messages.map((message: any) => message.id)).toEqual(["m3"]);
        expect(body.hasMore).toBe(true);
        expect(body.nextCursor).toBe("m3");
    });

    it("rejects users outside the conversation", async () => {
        (prisma.conversation.findUnique as any).mockResolvedValue({
            id: "cv1",
            UserConversations: [{ A: "u2" }],
        });

        const response = await app.request("/conversations/cv1/messages");
        expect(response.status).toBe(403);
        expect(prisma.directMessage.findMany).not.toHaveBeenCalled();
    });
});
