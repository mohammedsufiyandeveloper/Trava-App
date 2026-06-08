"use server";

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateProjectSubTasks } from "@/lib/cache/invalidation";
import { ApiResponse } from "@/lib/types";
import { TasksService } from "@/server/services/tasks.service";

/**
 * Server Action to reorder subtasks.
 */
export async function reorderSubtasks(
    subtaskIds: string[],
    projectId: string,
    workspaceId: string
): Promise<ApiResponse> {
    try {
        const permissions = await getUserPermissions(workspaceId, projectId);
        
        // Authorization check - only admins, managers or leads can reorder
        if (!permissions.isWorkspaceAdmin && !permissions.isProjectManager && !permissions.isProjectLead) {
            throw new Error("You don't have permission to reorder tasks.");
        }

        await TasksService.updateSubtasksOrder(subtaskIds);

        // Invalidate cache
        await invalidateProjectSubTasks(projectId);

        return {
            status: "success",
            message: "Tasks reordered successfully",
        };
    } catch (err: any) {
        console.error("[ACTION_REORDER_SUBTASKS_ERROR]", err);
        return {
            status: "error",
            message: err.message || "Failed to reorder tasks",
        };
    }
}
