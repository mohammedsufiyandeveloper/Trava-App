"use server";

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateTaskMutation } from "@/lib/cache/invalidation";
import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { SubTaskSchemaType, subTaskSchema } from "@/lib/zodSchemas";
import { TasksService } from "@/server/services/tasks.service";

/**
 * Server Action to create a subtask.
 * Delegated to TasksService for core logic.
 */
export async function createSubTask(values: SubTaskSchemaType): Promise<ApiResponse> {
    const user = await requireUser();

    try {
        const validation = subTaskSchema.safeParse(values);
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

        const newSubTask = await TasksService.createSubTask({
            name: validation.data.name,
            description: validation.data.description,
            projectId: validation.data.projectId,
            workspaceId: project.workspaceId,
            parentTaskId: validation.data.parentTaskId,
            userId: user.id,
            permissions,
            assigneeUserId: validation.data.assignee,
            reviewerId: validation.data.reviewerId,
            tagId: validation.data.tag || undefined,
            startDate: validation.data.startDate,
            dueDate: validation.data.dueDate,
            days: validation.data.days,
            status: validation.data.status as any,
        });

        // Invalidate cache
        await invalidateTaskMutation({
            projectId: values.projectId,
            workspaceId: project.workspaceId,
            userId: user.id,
            taskId: newSubTask.id,
            parentTaskId: validation.data.parentTaskId,
        });

        return {
            status: "success",
            message: "Subtask created successfully",
            data: newSubTask,
        };

    } catch (err: any) {
        console.error("[ACTION_CREATE_SUBTASK_ERROR]", err);
        return {
            status: "error",
            message: err.message || "We couldn't create the subtask. Please try again.",
        };
    }
}