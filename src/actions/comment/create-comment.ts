"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateTaskComments } from "@/lib/cache/invalidation";
import { getTaskInvolvedUserIds } from "@/lib/involved-users";

export interface CreateCommentResult {
    success: boolean;
    error?: string;
    comment?: {
        id: string;
        content: string;
        createdAt: Date;
        user: {
            id: string;
            name: string | null;
            surname: string | null;
            email: string;
        };
    };
}

/**
 * Server action to create a new comment on a task
 * 
 * @param taskId - ID of the task to comment on
 * @param content - Comment content
 * @param workspaceId - Workspace ID for permission check
 * @param projectId - Project ID for permission check
 * @param parentCommentId - Optional parent comment ID for replies
 */
export async function createCommentAction(
    taskId: string,
    content: string,
    workspaceId: string,
    projectId: string,
    parentCommentId?: string
): Promise<CreateCommentResult> {
    try {
        // 1. Authenticate user
        const user = await requireUser();

        // 2. Get user permissions
        const permissions = await getUserPermissions(workspaceId, projectId);

        if (!permissions.workspaceMemberId) {
            return {
                success: false,
                error: "You do not have access to this project",
            };
        }

        // 3. Validate input
        if (!content.trim()) {
            return {
                success: false,
                error: "Comment content is required",
            };
        }

        // 4. Verify task exists and belongs to the project
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: {
                id: true,
                projectId: true,
            },
        });

        if (!task) {
            return {
                success: false,
                error: "Task not found",
            };
        }

        if (task.projectId !== projectId) {
            return {
                success: false,
                error: "Task does not belong to this project",
            };
        }

        // 5. If it's a reply, verify parent comment exists
        if (parentCommentId) {
            const parentComment = await prisma.comment.findUnique({
                where: { id: parentCommentId },
                select: {
                    id: true,
                    taskId: true,
                    isDeleted: true,
                },
            });

            if (!parentComment) {
                return {
                    success: false,
                    error: "Parent comment not found",
                };
            }

            if (parentComment.isDeleted) {
                return {
                    success: false,
                    error: "Cannot reply to a deleted comment",
                };
            }

            if (parentComment.taskId !== taskId) {
                return {
                    success: false,
                    error: "Parent comment does not belong to this task",
                };
            }

            // Check reply depth (max 5 levels)
            const depth = await getCommentDepth(parentCommentId);
            if (depth >= 5) {
                return {
                    success: false,
                    error: "Maximum reply depth reached (5 levels)",
                };
            }
        }

        // 6. Create comment
        const comment = await prisma.comment.create({
            data: {
                content: content.trim(),
                userId: user.id,
                taskId: taskId,
                parentCommentId: parentCommentId || null,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        email: true,
                    },
                },
            },
        });

        // 6.5 Record Activity (Targeted real-time notifications)
        const { recordActivity } = await import("@/lib/audit");
        const targetUserIds = await getTaskInvolvedUserIds(taskId);

        await recordActivity({
            userId: user.id,
            userName: (user as any).surname || user.name || "Someone",
            workspaceId: workspaceId,
            action: "COMMENT_CREATED",
            entityType: "TASK",
            entityId: taskId,
            newData: { text: content },
            targetUserIds, // Limit broadcast to involved people
        });

        // 7. Invalidate comment cache using cache tags
        await invalidateTaskComments(taskId);

        return {
            success: true,
            comment,
        };
    } catch (error) {
        console.error("Error creating comment:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to create comment",
        };
    }
}

/**
 * Helper function to get the depth of a comment in the reply thread
 * Used to limit nesting depth
 */
async function getCommentDepth(commentId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = commentId;

    while (currentId) {
        const comment: { parentCommentId: string | null } | null = await prisma.comment.findUnique({
            where: { id: currentId },
            select: { parentCommentId: true },
        });

        if (!comment?.parentCommentId) break;
        currentId = comment.parentCommentId;
        depth++;

        // Safety limit to prevent infinite loops
        if (depth > 100) break;
    }

    return depth;
}
