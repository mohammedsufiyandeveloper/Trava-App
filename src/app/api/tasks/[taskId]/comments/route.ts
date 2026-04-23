import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { recordActivity } from "@/lib/audit";
import { getTaskInvolvedUserIds } from "@/lib/involved-users";

/**
 * GET /api/tasks/[taskId]/comments
 * Returns all non-deleted comments for a task, with user info.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        const { taskId } = await params;
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const comments = await prisma.comment.findMany({
            where: { taskId, isDeleted: false },
            include: {
                user: {
                    select: { id: true, name: true, surname: true, image: true }
                },
            },
            orderBy: { createdAt: "asc" },
        });

        // Normalize for mobile — map to { id, content, createdAt, userId, user }
        const mapped = comments.map(c => ({
            id: c.id,
            content: c.content,
            createdAt: c.createdAt,
            userId: c.userId,
            user: c.user
                ? {
                    id: c.user.id,
                    name: `${c.user.name || ""} ${c.user.surname || ""}`.trim(),
                    surname: c.user.surname,
                    image: (c.user as any).image ?? null,
                }
                : null,
        }));

        return NextResponse.json({ success: true, comments: mapped });
    } catch (error: any) {
        console.error("API Error [Comments GET]:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/tasks/[taskId]/comments
 * Creates a new comment on a task.
 * Body: { content: string }
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        const { taskId } = await params;
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const content = body?.content?.trim();
        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        // Verify task exists
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, workspaceId: true }
        });
        if (!task) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        const comment = await prisma.comment.create({
            data: {
                content,
                taskId,
                userId: session.user.id,
            },
            include: {
                user: {
                    select: { id: true, name: true, surname: true }
                }
            }
        });

        // ─── Record Activity & Trigger Notifications ───
        try {
            const targetUserIds = await getTaskInvolvedUserIds(taskId);
            await recordActivity({
                userId: session.user.id,
                userName: comment.user?.surname || comment.user?.name || "Someone",
                workspaceId: task.workspaceId,
                action: "COMMENT_CREATED",
                entityType: "TASK",
                entityId: taskId,
                newData: { content: comment.content },
                broadcastEvent: "team_update",
                targetUserIds,
            });
        } catch (e) {
            console.error("[AUDIT_ERROR] Comment activity failed:", e);
        }

        return NextResponse.json({
            success: true,
            comment: {
                id: comment.id,
                content: comment.content,
                createdAt: comment.createdAt,
                userId: comment.userId,
                user: comment.user
                    ? {
                        id: comment.user.id,
                        name: `${comment.user.name || ""} ${comment.user.surname || ""}`.trim(),
                        surname: comment.user.surname,
                    }
                    : null,
            }
        });
    } catch (error: any) {
        console.error("API Error [Comments POST]:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
