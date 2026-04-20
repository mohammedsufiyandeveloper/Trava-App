"use server";

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateTaskMutation, invalidateProjectSubTasks } from "@/lib/cache/invalidation";
import { requireUser } from "@/lib/auth/require-user";
import { ApiResponse } from "@/lib/types";
import { TasksService } from "@/server/services/tasks.service";

/**
 * Server Action to update subtask dates from Gantt chart.
 * Delegated to TasksService for core logic, permissions, and hierarchy rules.
 */
export async function updateSubtaskDates(
    subtaskId: string,
    startDate: string,
    endDate: string,
    projectId: string,
    workspaceId: string
): Promise<ApiResponse> {
    try {
        const user = await requireUser();
        const permissions = await getUserPermissions(workspaceId, projectId);

        // 1. Call service
        const updated = await TasksService.updateTaskDates({
            taskId: subtaskId,
            startDate,
            dueDate: endDate,
            workspaceId,
            projectId,
            userId: user.id,
            permissions
        });

        // 2. Invalidate cache
        await invalidateTaskMutation({
            taskId: subtaskId,
            projectId,
            workspaceId,
            userId: user.id,
            parentTaskId: (updated as any).parentTaskId || undefined
        });

        // Special invalidation for Gantt view
        await invalidateProjectSubTasks(projectId);

        return {
            status: "success",
            message: "Dates updated successfully",
        };

    } catch (err: any) {
        console.error("[ACTION_UPDATE_GANTT_DATES_ERROR]", err);
        return {
            status: "error",
            message: err.message || "Failed to update dates",
        };
    }
}
