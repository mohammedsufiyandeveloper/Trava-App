import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { sendPushNotification } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations/[conversationId]/messages
 * Returns message history for a conversation.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ conversationId: string }> }
) {
    try {
        const { conversationId } = await params;
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify user is part of the conversation
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { participants: { select: { id: true } } }
        });

        if (!conversation) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        const isParticipant = conversation.participants.some(p => p.id === session.user.id);
        if (!isParticipant) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

        // Normalize for mobile
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

        return NextResponse.json({ success: true, messages: mapped });
    } catch (error: any) {
        console.error("API Error [Messages GET]:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/conversations/[conversationId]/messages
 * Sends a message to a conversation.
 * Body: { content: string }
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ conversationId: string }> }
) {
    try {
        const { conversationId } = await params;
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const content = body?.content?.trim();

        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        // Verify user is part of the conversation
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { participants: { select: { id: true } } }
        });

        if (!conversation) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        const isParticipant = conversation.participants.some(p => p.id === session.user.id);
        if (!isParticipant) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const message = await prisma.directMessage.create({
            data: {
                content,
                conversationId,
                senderId: session.user.id
            },
            include: {
                sender: {
                    select: { id: true, name: true, surname: true, image: true }
                }
            }
        });

        // Update conversation's updatedAt to bubble it to top in list
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        });

        // ─── PUSH NOTIFICATIONS ──────────────────────────────────────────────
        // Send notification to other participants
        const recipients = conversation.participants
            .filter(p => p.id !== session.user.id)
            .map(p => p.id);

        if (recipients.length > 0) {
            const user = session.user as any;
            const senderName = `${user.name || ""} ${user.surname || ""}`.trim() || "Someone";
            
            // Fire and forget notification
            sendPushNotification(
                recipients,
                senderName,
                content,
                {
                    type: "direct_message",
                    conversationId,
                    senderId: session.user.id,
                    senderName
                }
            ).catch(err => console.error("[PUSH_MESSAGING_ERROR]", err));
        }

        return NextResponse.json({
            success: true,
            message: {
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
            }
        });
    } catch (error: any) {
        console.error("API Error [Messages POST]:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
