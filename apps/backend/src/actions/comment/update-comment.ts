"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { invalidateTaskComments } from "@/lib/cache/invalidation";

export interface UpdateCommentResult {
    success: boolean;
    error?: string;
    comment?: {
        id: string;
        content: string;
        isEdited: boolean;
        editedAt: Date | null;
        user: {
            id: string;
            // name: string | null;
            surname: string | null;
            // image: string | null;
            // email: string;
        };
    };
}

/**
 * Server action to update/edit a comment
 * 
 * @param commentId - ID of the comment to update
 * @param newContent - New comment content
 */
export async function updateCommentAction(
    commentId: string,
    newContent: string
): Promise<UpdateCommentResult> {
    try {
        // 1. Authenticate user
        const user = await requireUser();

        // 2. Validate input
        if (!newContent.trim()) {
            return {
                success: false,
                error: "Comment content is required",
            };
        }

        // 3. Verify comment exists and check ownership
        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            select: {
                id: true,
                userId: true,
                taskId: true,
                isDeleted: true,
            },
        });

        if (!comment) {
            return {
                success: false,
                error: "Comment not found",
            };
        }

        if (comment.isDeleted) {
            return {
                success: false,
                error: "Cannot edit deleted comment",
            };
        }

        if (comment.userId !== user.id) {
            return {
                success: false,
                error: "You can only edit your own comments",
            };
        }

        // 4. Update comment
        const updatedComment = await prisma.comment.update({
            where: { id: commentId },
            data: {
                content: newContent.trim(),
                isEdited: true,
                editedAt: new Date(),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        // name: true,
                        surname: true,
                        // image: true,
                        // email: true,
                    },
                },
            },
        });

        // 5. Invalidate comment cache using cache tags
        await invalidateTaskComments(comment.taskId);

        return {
            success: true,
            comment: updatedComment,
        };
    } catch (error) {
        console.error("Error updating comment:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update comment",
        };
    }
}
