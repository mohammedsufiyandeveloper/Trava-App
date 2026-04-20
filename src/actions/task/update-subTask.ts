"use server";

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateTaskMutation } from "@/lib/cache/invalidation";
import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { SubTaskSchemaType, subTaskSchema } from "@/lib/zodSchemas";
import { TasksService } from "@/server/services/tasks.service";

/**
 * Server Action to edit a subtask.
 * Delegated to TasksService for core logic.
 */
export async function editSubTask(data: SubTaskSchemaType, subTaskId: string): Promise<ApiResponse> {
    try {
        const user = await requireUser();

        const validation = subTaskSchema.safeParse(data);
        if (!validation.success) {
            return {
                status: "error",
                message: "Invalid validation form data"
            };
        }

        const subTaskContext = await prisma.task.findUnique({
            where: { id: subTaskId },
            include: { 
                project: { select: { id: true, workspaceId: true } },
                ProjectMember_Task_assigneeIdToProjectMember: { select: { WorkspaceMember: { select: { userId: true } } } },
                reviewer: { select: { WorkspaceMember: { select: { userId: true } } } }
            }
        });

        if (!subTaskContext) {
            return {
                status: "error",
                message: "Subtask not found",
            };
        }

        const permissions = await getUserPermissions(
            subTaskContext.project.workspaceId,
            subTaskContext.project.id
        );

        // Call service
        await TasksService.updateTask({
            taskId: subTaskId,
            workspaceId: subTaskContext.project.workspaceId,
            projectId: subTaskContext.project.id,
            userId: user.id,
            permissions,
            data: {
                name: validation.data.name,
                description: validation.data.description,
                status: validation.data.status as any,
                assigneeUserId: validation.data.assignee,
                reviewerId: validation.data.reviewerId,
                tagId: validation.data.tag || undefined,
                startDate: validation.data.startDate,
                dueDate: validation.data.dueDate,
                days: validation.data.days,
            }
        });

        // Collect all involved users for cache invalidation
        const involvedUserIds = Array.from(new Set([
            (subTaskContext as any).ProjectMember_Task_assigneeIdToProjectMember?.WorkspaceMember?.userId,
            (subTaskContext as any).reviewer?.WorkspaceMember?.userId,
            validation.data.assignee,
            validation.data.reviewerId,
            user.id
        ])).filter(Boolean) as string[];
        
        // Invalidate cache
        await invalidateTaskMutation({
            projectId: subTaskContext.project.id,
            workspaceId: subTaskContext.project.workspaceId,
            userId: user.id,
            taskId: subTaskId,
            parentTaskId: subTaskContext.parentTaskId || undefined,
            involvedUserIds
        });

        console.log(`✅ [editSubTask] Subtask ${subTaskId} updated. Invalidated caches for involved users:`, involvedUserIds);

        return {
            status: "success",
            message: "Subtask updated successfully",
        };

    } catch (err: any) {
        console.error("[ACTION_EDIT_SUBTASK_ERROR]", err);
        return {
            status: "error",
            message: err.message || "We couldn't update the subtask. Please try again.",
        };
    }
}
