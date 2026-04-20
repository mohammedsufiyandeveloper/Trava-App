"use server";

import { requireUser } from "@/lib/auth/require-user";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { TasksService, TaskStatus } from "@/server/services/tasks.service";

interface UpdateSubTaskStatusResult {
    success: boolean;
    error?: string;
    subTask?: {
        id: string;
        status: TaskStatus;
        updatedAt: Date;
    };
}

/**
 * Server Action wrapper around TasksService.updateSubTaskStatus
 */
export async function updateSubTaskStatus(
    subTaskId: string,
    newStatus: TaskStatus,
    workspaceId: string,
    projectId: string,
    activityId?: string, // Legacy param for compatibility
    comment?: string,
    attachmentData?: any
): Promise<UpdateSubTaskStatusResult> {
    try {
        const user = await requireUser();
        const permissions = await getUserPermissions(workspaceId, projectId, user.id);

        if (!permissions.workspaceMemberId) {
            return {
                success: false,
                error: "You do not have access to this project",
            };
        }

        const updated = await TasksService.updateSubTaskStatus({
            subTaskId,
            newStatus,
            workspaceId,
            projectId,
            userId: user.id,
            permissions,
            comment,
            attachmentData
        });

        return {
            success: true,
            subTask: {
                id: updated.id,
                status: updated.status as TaskStatus,
                updatedAt: updated.updatedAt,
            }
        };
    } catch (error) {
        console.error("Error updating subtask status:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "An unexpected error occurred",
        };
    }
}
