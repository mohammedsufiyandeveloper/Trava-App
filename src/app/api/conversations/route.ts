import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/require-user";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations?workspaceId=...
 * Returns all conversations for the authenticated user in the workspace.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get("workspaceId");

        if (!workspaceId) {
            return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
        }

        const conversations = await prisma.conversation.findMany({
            where: {
                workspaceId,
                participants: {
                    some: { id: session.user.id }
                }
            },
            include: {
                participants: {
                    select: { id: true, name: true, surname: true, image: true }
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

        return NextResponse.json({ success: true, conversations });
    } catch (error: any) {
        console.error("API Error [Conversations GET]:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/conversations
 * Upsert a 1-to-1 conversation in a workspace.
 * Body: { workspaceId: string, otherUserId: string }
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { workspaceId, otherUserId } = await req.json();

        if (!workspaceId || !otherUserId) {
            return NextResponse.json({ error: "workspaceId and otherUserId are required" }, { status: 400 });
        }

        if (session.user.id === otherUserId) {
            return NextResponse.json({ error: "Cannot start a conversation with yourself" }, { status: 400 });
        }

        // Try to find an existing 1-to-1 conversation
        let conversation = await prisma.conversation.findFirst({
            where: {
                workspaceId,
                AND: [
                    { participants: { some: { id: session.user.id } } },
                    { participants: { some: { id: otherUserId } } }
                ]
            },
            include: {
                participants: {
                    select: { id: true, name: true, surname: true, image: true }
                }
            }
        });

        // If not found, create one
        if (!conversation) {
            conversation = await prisma.conversation.create({
                data: {
                    workspaceId,
                    participants: {
                        connect: [
                            { id: session.user.id },
                            { id: otherUserId }
                        ]
                    }
                },
                include: {
                    participants: {
                        select: { id: true, name: true, surname: true, image: true }
                    }
                }
            });
        }

        return NextResponse.json({ success: true, conversation });
    } catch (error: any) {
        console.error("API Error [Conversations POST]:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
