import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { pusherServer } from "@/lib/pusher";

export const dynamic = "force-dynamic";

/**
 * POST /api/conversations/[conversationId]/typing
 * Triggers a typing indicator event via Pusher.
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

        // Verify user is part of the conversation
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { UserConversations: { select: { A: true } } }
        });

        if (!conversation) {
            return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        const isParticipant = conversation.UserConversations.some(p => p.A === session.user.id);
        if (!isParticipant) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { isTyping } = await req.json();

        // Trigger typing event via Pusher
        if (pusherServer) {
            console.log(`[PUSHER] Triggering typing event on channel: ${conversationId} (isTyping: ${isTyping})`);
            await pusherServer.trigger(conversationId, 'typing', {
                userId: session.user.id,
                userName: session.user.name || "Someone",
                isTyping: !!isTyping
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("API Error [Typing POST]:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
