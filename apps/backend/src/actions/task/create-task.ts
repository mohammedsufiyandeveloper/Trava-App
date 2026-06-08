"use server";

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateTaskMutation } from "@/lib/cache/invalidation";
import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { TaskSchemaType, taskSchema } from "@/lib/zodSchemas";
import { TasksService } from "@/server/services/tasks.service";

/**
 * Server Action to create a base task.
 * Delegated to TasksService for core logic.
 */
export async function createTask(values: TaskSchemaType): Promise<ApiResponse> {
    try {
        const validation = taskSchema.safeParse(values);
        if (!validation.success) {
            return {
                status: "error",
                message: "Invalid validation form data"
            };
        }

        const project = await prisma.project.findUnique({
            where: { id: values.projectId },
            select: { workspaceId: true }
        });

        if (!project) {
            return {
                status: "error",
                message: "Project not found",
            };
        }

        const permissions = await getUserPermissions(project.workspaceId, values.projectId);
        if (!permissions.WorkspaceMember) {
            return {
                status: "error",
                message: "You are not a member of this workspace",
            };
        }

        const newTask = await TasksService.createTask({
            name: validation.data.name,
            projectId: validation.data.projectId,
            workspaceId: project.workspaceId,
            userId: permissions.WorkspaceMember.userId,
            permissions
        });

        // Invalidate cache
        await invalidateTaskMutation({
            projectId: values.projectId,
            workspaceId: project.workspaceId,
            userId: permissions.WorkspaceMember.userId,
            taskId: newTask.id,
        });

        return {
            status: "success",
            message: "Task created successfully",
            data: newTask,
        };

    } catch (err: any) {
        console.error("[ACTION_CREATE_TASK_ERROR]", err);
        return {
            status: "error",
            message: err.message || "We couldn't create the task. Please try again.",
        };
    }
}
