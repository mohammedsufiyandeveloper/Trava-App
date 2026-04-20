"use server";

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateTaskMutation } from "@/lib/cache/invalidation";
import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { TasksService } from "@/server/services/tasks.service";

/**
 * Server Action to delete a subtask.
 * Delegated to TasksService for core logic.
 */
export async function deleteSubTask(subTaskId: string): Promise<ApiResponse> {
    try {
        const user = await requireUser();

        // 1. Get subtask context
        const subTask = await prisma.task.findUnique({
            where: { id: subTaskId },
            include: { project: { select: { id: true, workspaceId: true } } }
        });

        if (!subTask) {
            return {
                status: "error",
                message: "Subtask not found",
            };
        }

        const permissions = await getUserPermissions(
            subTask.project.workspaceId,
            subTask.project.id
        );

        // 2. Call service (it handles parent counter decrement automatically)
        await TasksService.deleteTask({
            taskId: subTaskId,
            workspaceId: subTask.project.workspaceId,
            projectId: subTask.project.id,
            userId: user.id,
            permissions
        });

        // 3. Invalidate cache
        await invalidateTaskMutation({
            projectId: subTask.project.id,
            workspaceId: subTask.project.workspaceId,
            userId: user.id,
            taskId: subTaskId,
            parentTaskId: subTask.parentTaskId || undefined
        });

        return {
            status: "success",
            message: "Subtask deleted successfully",
        };

    } catch (err: any) {
        console.error("[ACTION_DELETE_SUBTASK_ERROR]", err);
        return {
            status: "error",
            message: err.message || "We couldn't delete the subtask. Please try again.",
        };
    }
}