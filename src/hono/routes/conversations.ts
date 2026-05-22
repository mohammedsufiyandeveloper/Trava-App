import { Hono } from "hono";
import { HonoVariables } from "../types";
import prisma from "@/lib/db";
import { sendNotificationToUsers } from "@/lib/notifications";
import { pusherServer } from "@/lib/pusher";

export const conversationsRouter = new Hono<{ Variables: HonoVariables }>()

    // GET /api/conversations
    .get("/", async (c) => {
        const user = c.get("user");
        const workspaceId = c.req.query("workspaceId");

        if (!workspaceId) {
            return c.json({ error: "workspaceId is required" }, 400);
        }

        try {
            const conversations = await prisma.conversation.findMany({
                where: {
                    workspaceId,
                    UserConversations: {
                        some: { A: user.id }
                    }
                },
                include: {
                    UserConversations: {
                        include: {
                            user: { select: { id: true, name: true, surname: true, image: true } }
                        }
                    },
                    messages: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        include: {
                            sender: { select: { name: true, surname: true } }
                        }
                    }
                },
                orderBy: { updatedAt: "desc" }
            });

            const mappedConversations = conversations.map(cv => ({
                ...cv,
                participants: cv.UserConversations.map(uc => uc.user),
                UserConversations: undefined
            }));

            return c.json({ success: true, conversations: mappedConversations });
        } catch (error: any) {
            console.error("Hono API Error [Conversations GET]:", error);
            return c.json({ success: false, error: error.message }, 500);
        }
    })

    // POST /api/conversations
    .post("/", async (c) => {
        const user = c.get("user");
        try {
            const { workspaceId, otherUserId } = await c.req.json();

            if (!workspaceId || !otherUserId) {
                return c.json({ error: "workspaceId and otherUserId are required" }, 400);
            }

            if (user.id === otherUserId) {
                return c.json({ error: "Cannot start a conversation with yourself" }, 400);
            }

            let conversation = await prisma.conversation.findFirst({
                where: {
                    workspaceId,
                    AND: [
                        { UserConversations: { some: { A: user.id } } },
                        { UserConversations: { some: { A: otherUserId } } }
                    ]
                },
                include: {
                    UserConversations: {
                        include: {
                            user: { select: { id: true, name: true, surname: true, image: true } }
                        }
                    }
                }
            });

            if (!conversation) {
                conversation = await prisma.conversation.create({
                    data: {
                        workspaceId,
                        UserConversations: {
                            create: [
                                { A: user.id },
                                { A: otherUserId }
                            ]
                        }
                    },
                    include: {
                        UserConversations: {
                            include: {
                                user: { select: { id: true, name: true, surname: true, image: true } }
                            }
                        }
                    }
                });
            }

            const mappedConversation = {
                ...conversation,
                participants: conversation.UserConversations.map(uc => uc.user),
                UserConversations: undefined
            };

            return c.json({ success: true, conversation: mappedConversation });
        } catch (error: any) {
            console.error("Hono API Error [Conversations POST]:", error);
            return c.json({ success: false, error: error.message }, 500);
        }
    })

    // GET /api/conversations/:conversationId/messages
    .get("/:conversationId/messages", async (c) => {
        const user = c.get("user");
        const conversationId = c.req.param("conversationId");

        try {
            const conversation = await prisma.conversation.findUnique({
                where: { id: conversationId },
                include: { UserConversations: { select: { A: true } } }
            });

            if (!conversation) {
                return c.json({ error: "Conversation not found" }, 404);
            }

            const isParticipant = conversation.UserConversations.some(p => p.A === user.id);
            if (!isParticipant) {
                return c.json({ error: "Forbidden" }, 403);
            }

            const messages = await prisma.directMessage.findMany({
                where: { conversationId },
                include: {
                    sender: {
                        select: { id: true, name: true, surname: true, image: true }
                    }
                },
                orderBy: { createdAt: "asc" }
            });

            const mapped = messages.map(m => ({
                id: m.id,
                content: m.content,
                createdAt: m.createdAt,
                userId: m.senderId,
                user: {
                    id: m.sender.id,
                    name: `${m.sender.name || ""} ${m.sender.surname || ""}`.trim(),
                    surname: m.sender.surname,
                    image: (m.sender as any).image ?? null,
                }
            }));

            return c.json({ success: true, messages: mapped });
        } catch (error: any) {
            console.error("Hono API Error [Messages GET]:", error);
            return c.json({ success: false, error: error.message }, 500);
        }
    })

    // POST /api/conversations/:conversationId/messages
    .post("/:conversationId/messages", async (c) => {
        const user = c.get("user");
        const conversationId = c.req.param("conversationId");

        try {
            const body = await c.req.json();
            const content = body?.content?.trim();

            if (!content) {
                return c.json({ error: "Content is required" }, 400);
            }

            const conversation = await prisma.conversation.findUnique({
                where: { id: conversationId },
                include: { UserConversations: { select: { A: true } } }
            });

            if (!conversation) {
                return c.json({ error: "Conversation not found" }, 404);
            }

            const isParticipant = conversation.UserConversations.some(p => p.A === user.id);
            if (!isParticipant) {
                return c.json({ error: "Forbidden" }, 403);
            }

            const message = await prisma.directMessage.create({
                data: {
                    content,
                    conversationId,
                    senderId: user.id
                },
                include: {
                    sender: {
                        select: { id: true, name: true, surname: true, image: true }
                    }
                }
            });

            await prisma.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() }
            });

            const recipients = conversation.UserConversations
                .filter(p => p.A !== user.id)
                .map(p => p.A);

            const mappedMessage = {
                id: message.id,
                content: message.content,
                createdAt: message.createdAt,
                userId: message.senderId,
                user: {
                    id: message.sender.id,
                    name: `${message.sender.name || ""} ${(message.sender as any).surname || ""}`.trim(),
                    surname: (message.sender as any).surname,
                    image: (message.sender as any).image ?? null,
                }
            };

            if (pusherServer) {
                console.log(`[PUSHER] Triggering new-message on channel: ${conversationId}`);
                pusherServer.trigger(conversationId, 'new-message', mappedMessage)
                    .catch(err => console.error("[PUSHER_ERROR]", err));
            }

            if (recipients.length > 0) {
                const senderName = `${user.name || ""} ${(user as any).surname || ""}`.trim() || "Someone";

                sendNotificationToUsers(
                    recipients,
                    {
                        workspaceId: (conversation as any).workspaceId || "",
                        title: senderName,
                        body: content,
                        type: "direct_message",
                        metadata: {
                            type: "direct_message",
                            conversationId,
                            senderId: user.id,
                            senderName
                        }
                    }
                ).catch(err => console.error("[NOTIF_SYNC_ERROR]", err));
            }

            return c.json({
                success: true,
                message: mappedMessage
            });
        } catch (error: any) {
            console.error("Hono API Error [Messages POST]:", error);
            return c.json({ success: false, error: error.message }, 500);
        }
    })

    // POST /api/conversations/:conversationId/typing
    .post("/:conversationId/typing", async (c) => {
        const user = c.get("user");
        const conversationId = c.req.param("conversationId");

        try {
            const conversation = await prisma.conversation.findUnique({
                where: { id: conversationId },
                include: { UserConversations: { select: { A: true } } }
            });

            if (!conversation) {
                return c.json({ error: "Conversation not found" }, 404);
            }

            const isParticipant = conversation.UserConversations.some(p => p.A === user.id);
            if (!isParticipant) {
                return c.json({ error: "Forbidden" }, 403);
            }

            const { isTyping } = await c.req.json();

            if (pusherServer) {
                console.log(`[PUSHER] Triggering typing event on channel: ${conversationId} (isTyping: ${isTyping})`);
                await pusherServer.trigger(conversationId, 'typing', {
                    userId: user.id,
                    userName: (user as any).surname || user.name || "Someone",
                    isTyping: !!isTyping
                });
            }

            return c.json({ success: true });
        } catch (error: any) {
            console.error("Hono API Error [Typing POST]:", error);
            return c.json({ success: false, error: error.message }, 500);
        }
    });
