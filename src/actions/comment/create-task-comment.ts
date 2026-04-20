"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { invalidateTaskComments } from "@/lib/cache/invalidation";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

export interface CreateTaskCommentResult {
    success: boolean;
    error?: string;
    comment?: {
        id: string;
        content: string;
        createdAt: Date;
        userId: string;
        taskId: string;
        user: {
            id: string;
            surname: string | null;
        };
        isEdited: boolean;
        editedAt: Date | null;
        isDeleted: boolean;
        deletedAt: Date | null;
        updatedAt: Date;
    };
}

/**
 * Simplified server action to create a comment on a task
 * This version doesn't require workspaceId/projectId parameters
 * Used by client components that only have taskId
 * 
 * @param taskId - ID of the task to comment on
 * @param content - Comment content
 * @param parentCommentId - Optional parent comment ID for replies
 */
export async function createTaskCommentAction(
    taskId: string,
    content: string,
    parentCommentId?: string
): Promise<CreateTaskCommentResult> {
    try {
        // 1. Authenticate user
        const user = await requireUser();

        // 2. Validate input
        if (!content.trim()) {
            return {
                success: false,
                error: "Comment content is required",
            };
        }

        // 3. Verify task exists and check permissions
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                project: {
                    select: {
                        workspaceId: true
                    }
                }
            }
        });

        if (!task) {
            return { success: false, error: "Task not found" };
        }

        const workspaceId = task.project.workspaceId;
        const perms = await getWorkspacePermissions(workspaceId);

        if (!perms.workspaceMemberId) {
            return { success: false, error: "Access denied" };
        }

        // Authorization check:
        // - Admin/Owner: Full access
        // - Project Lead/PM of this project: Can comment
        // - Task participants (Assignee, Creator, Reviewer): Can comment
        const isProjectAuthority = perms.isWorkspaceAdmin ||
            (perms.leadProjectIds || []).includes(task.projectId) ||
            (perms.managedProjectIds || []).includes(task.projectId);

        const isTaskParticipant = task.assigneeId === user.id ||
            task.createdById === user.id ||
            task.reviewerId === user.id;

        if (!isProjectAuthority && !isTaskParticipant) {
            return { success: false, error: "You don't have permission to message in this project" };
        }

        // 4. If it's a reply, verify parent comment exists
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

        // 5. Create comment
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
                        // name: true,
                        surname: true,
                        // email: true,
                    },
                },
            },
        });

        // 5.5 Record Activity (Broadcasts to header real-time)
        const { recordActivity } = await import("@/lib/audit");
        await recordActivity({
            userId: user.id,
            userName: (user as any).surname || user.name || "Someone",
            workspaceId: workspaceId,
            action: "COMMENT_CREATED",
            entityType: "TASK",
            entityId: taskId,
            newData: { text: content },
        });

        // 6. Invalidate comment cache using cache tags
        await invalidateTaskComments(taskId);

        return {
            success: true,
            comment: {
                ...comment,
                isEdited: false,
                editedAt: null,
                isDeleted: false,
                deletedAt: null,
            },
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
