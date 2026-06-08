"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { invalidateTaskComments } from "@/lib/cache/invalidation";

export interface DeleteCommentResult {
    success: boolean;
    error?: string;
}

/**
 * Server action to soft delete a comment
 * 
 * @param commentId - ID of the comment to delete
 */
export async function deleteCommentAction(
    commentId: string
): Promise<DeleteCommentResult> {
    try {
        // 1. Authenticate user
        const user = await requireUser();

        // 2. Verify comment exists and check ownership
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
                error: "Comment already deleted",
            };
        }

        if (comment.userId !== user.id) {
            return {
                success: false,
                error: "You can only delete your own comments",
            };
        }

        // 3. Soft delete comment
        await prisma.comment.update({
            where: { id: commentId },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
            },
        });

        // 4. Invalidate comment cache using cache tags
        await invalidateTaskComments(comment.taskId);

        return {
            success: true,
        };
    } catch (error) {
        console.error("Error deleting comment:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete comment",
        };
    }
}
