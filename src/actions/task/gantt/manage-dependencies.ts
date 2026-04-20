"use server";

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateProjectTasks, invalidateProjectSubTasks } from "@/lib/cache/invalidation";
import { requireUser } from "@/lib/auth/require-user";
import { ApiResponse } from "@/lib/types";
import { TasksService } from "@/server/services/tasks.service";

/**
 * Server Action to add a dependency between subtasks.
 */
export async function addSubtaskDependency(
    subtaskId: string,
    dependsOnId: string,
    projectId: string,
    workspaceId: string
): Promise<ApiResponse> {
    try {
        const permissions = await getUserPermissions(workspaceId, projectId);

        const user = await requireUser();

        await TasksService.addDependency({
            subtaskId,
            dependsOnId,
            projectId,
            workspaceId,
            permissions
        });

        // Invalidate cache for Gantt view
        await invalidateProjectTasks(projectId, user.id);
        await invalidateProjectSubTasks(projectId);

        return {
            status: "success",
            message: "Dependency added successfully",
        };
    } catch (err: any) {
        console.error("[ACTION_ADD_DEPENDENCY_ERROR]", err);
        return {
            status: "error",
            message: err.message || "Failed to add dependency",
        };
    }
}

/**
 * Server Action to remove a dependency between subtasks.
 */
export async function removeSubtaskDependency(
    subtaskId: string,
    dependsOnId: string,
    projectId: string,
    workspaceId: string
): Promise<ApiResponse> {
    try {
        const permissions = await getUserPermissions(workspaceId, projectId);

        const user = await requireUser();

        await TasksService.removeDependency({
            subtaskId,
            dependsOnId,
            permissions
        });

        await invalidateProjectTasks(projectId, user.id);
        await invalidateProjectSubTasks(projectId);

        return {
            status: "success",
            message: "Dependency removed successfully",
        };
    } catch (err: any) {
        console.error("[ACTION_REMOVE_DEPENDENCY_ERROR]", err);
        return {
            status: "error",
            message: err.message || "Failed to remove dependency",
        };
    }
}
