"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getUserPermissions } from "@/data/user/get-user-permissions";

interface PinSubTaskResult {
    success: boolean;
    error?: string;
    message?: string;
}

/**
 * Pin or unpin a subtask in the Kanban board.
 * NOTE: The isPinned/pinnedAt fields have been removed from the Task model.
 * This action is currently a no-op stub that returns success to avoid UI breakage.
 * Re-implement when the pinning feature is re-added to the schema.
 */
export async function pinSubTask(
    subTaskId: string,
    isPinned: boolean,
    operationId: string,
    workspaceId: string,
    projectId: string
): Promise<PinSubTaskResult> {
    try {
        await requireUser();
        const permissions = await getUserPermissions(workspaceId, projectId);

        if (!permissions.workspaceMemberId) {
            return { success: false, error: "You do not have access to this project" };
        }

        const isAdminOrLead = permissions.isWorkspaceAdmin || permissions.isProjectLead;
        if (!isAdminOrLead) {
            return {
                success: false,
                error: "You are not authorized to pin/unpin cards. Only project admins and leads can pin cards.",
            };
        }

        // Verify the task exists and belongs to this project
        const task = await prisma.task.findUnique({
            where: { id: subTaskId },
            select: { id: true, projectId: true },
        });

        if (!task) {
            return { success: false, error: "Subtask not found" };
        }

        if (task.projectId !== projectId) {
            return { success: false, error: "Subtask does not belong to this project" };
        }

        // Pinning is not currently supported in the schema.
        // Return success so the UI doesn't break.
        return {
            success: true,
            message: "Pinning is not currently available. Feature coming soon.",
        };
    } catch (error) {
        console.error("Error pinning/unpinning subtask:", error);
        return {
            success: false,
            error: "An unexpected error occurred while pinning/unpinning the subtask. Please try again.",
        };
    }
}
