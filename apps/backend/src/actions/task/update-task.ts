"use server";

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateTaskMutation } from "@/lib/cache/invalidation";
import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { TaskSchemaType, taskSchema } from "@/lib/zodSchemas";
import { TasksService } from "@/server/services/tasks.service";

/**
 * Server Action to edit a parent task.
 * Delegated to TasksService for core logic.
 */
export async function editTask(data: TaskSchemaType, taskId: string): Promise<ApiResponse> {
    try {
        const user = await requireUser();

        const validation = taskSchema.safeParse(data);
        if (!validation.success) {
            return {
                status: "error",
                message: "Invalid validation form data"
            };
        }

        const taskContext = await prisma.task.findUnique({
            where: { id: taskId },
            include: { project: { select: { id: true, workspaceId: true } } }
        });

        if (!taskContext) {
            return {
                status: "error",
                message: "Task not found",
            };
        }

        const permissions = await getUserPermissions(
            taskContext.project.workspaceId,
            taskContext.project.id
        );

        // Call service
        await TasksService.updateTask({
            taskId,
            workspaceId: taskContext.project.workspaceId,
            projectId: taskContext.project.id,
            userId: user.id,
            permissions,
            data: validation.data,
        });

        // Invalidate cache
        await invalidateTaskMutation({
            projectId: taskContext.project.id,
            workspaceId: taskContext.project.workspaceId,
            userId: user.id,
            taskId
        });

        return {
            status: "success",
            message: "Task updated successfully",
        };

    } catch (err: any) {
        console.error("[ACTION_EDIT_TASK_ERROR]", err);
        return {
            status: "error",
            message: err.message || "We couldn't update the task. Please try again.",
        };
    }
}