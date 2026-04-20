"use server";

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { TasksService } from "@/server/services/tasks.service";

/**
 * Surgical Server Action to update ONLY the assignee of a subtask.
 * Reduces payload size and ensures cleaner audit logs.
 */
export async function patchSubTaskAssignee(
    subTaskId: string, 
    assigneeUserId: string | null
): Promise<ApiResponse> {
    try {
        const user = await requireUser();

        // 1. Fetch minimal context for permissions
        const subTaskContext = await prisma.task.findUnique({
            where: { id: subTaskId },
            select: { 
                id: true,
                parentTaskId: true,
                project: { select: { id: true, workspaceId: true } },
                ProjectMember_Task_assigneeIdToProjectMember: { select: { WorkspaceMember: { select: { userId: true } } } },
                reviewer: { select: { WorkspaceMember: { select: { userId: true } } } }
            }
        });

        if (!subTaskContext) {
            return { status: "error", message: "Subtask not found" };
        }

        const permissions = await getUserPermissions(
            subTaskContext.project.workspaceId,
            subTaskContext.project.id,
            user.id
        );

        // 2. Call service with ONLY the assignee change
        await TasksService.updateTask({
            taskId: subTaskId,
            workspaceId: subTaskContext.project.workspaceId,
            projectId: subTaskContext.project.id,
            userId: user.id,
            permissions,
            data: {
                assigneeUserId: assigneeUserId,
            }
        });

        return {
            status: "success",
            message: "Assignee updated successfully",
            data: { id: subTaskId }
        };

    } catch (err: any) {
        console.error("[ACTION_PATCH_ASSIGNEE_ERROR]", err);
        return {
            status: "error",
            message: err.message || "Failed to update assignee.",
        };
    }
}
