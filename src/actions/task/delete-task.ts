"use server";

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateTaskMutation } from "@/lib/cache/invalidation";
import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { TasksService } from "@/server/services/tasks.service";

/**
 * Server Action to delete a parent task.
 * Delegated to TasksService for core logic.
 */
export async function deleteTask(taskId: string): Promise<ApiResponse> {
    try {
        const user = await requireUser();

        // 1. Get task context for permission checking
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { project: { select: { id: true, workspaceId: true } } }
        });

        if (!task) {
            return {
                status: "error",
                message: "Task not found",
            };
        }

        const permissions = await getUserPermissions(
            task.project.workspaceId,
            task.project.id
        );

        // 2. Call service
        await TasksService.deleteTask({
            taskId,
            workspaceId: task.project.workspaceId,
            projectId: task.project.id,
            userId: user.id,
            permissions
        });

        // 3. Invalidate cache
        await invalidateTaskMutation({
            projectId: task.project.id,
            workspaceId: task.project.workspaceId,
            userId: user.id,
            taskId
        });

        return {
            status: "success",
            message: "Task deleted successfully",
        };

    } catch (err: any) {
        console.error("[ACTION_DELETE_TASK_ERROR]", err);
        return {
            status: "error",
            message: err.message || "We couldn't delete the task. Please try again.",
        };
    }
}