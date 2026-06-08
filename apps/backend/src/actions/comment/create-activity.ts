"use server";

import prisma from "@/lib/db";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import crypto from "crypto";
import { requireUser } from "@/lib/auth/require-user";
import { getTaskInvolvedUserIds } from "@/lib/involved-users";

export interface CreateActivityResult {
    success: boolean;
    error?: string;
    activityId?: string;
}

/**
 * Server action to create an activity for a subtask when moving to REVIEW status
 * 
 * @param subTaskId - ID of the subtask
 * @param text - Comment text
 * @param workspaceId - Workspace ID for permission check
 * @param projectId - Project ID for permission check
 * @param attachmentData - Optional attachment data (base64 encoded)
 */
export async function createActivityAction(
    subTaskId: string,
    text: string,
    workspaceId: string,
    projectId: string,
    attachmentData?: {
        fileName: string;
        fileType: string;
        fileSize: number;
        base64Data: string;
    },
    previousStatus?: string,
    targetStatus?: string
): Promise<CreateActivityResult> {
    try {
        // 1. Start parallel fetch
        const user = await requireUser();

        const [permissions, subTask] = await Promise.all([
            getUserPermissions(workspaceId, projectId, user.id),
            prisma.task.findUnique({
                where: { id: subTaskId },
                select: {
                    id: true,
                    projectId: true, // Direct project lookup to avoid nested parent lookup
                },
            })
        ]);

        if (!permissions.workspaceMemberId) {
            return {
                success: false,
                error: "You do not have access to this project",
            };
        }

        if (!subTask) {
            return {
                success: false,
                error: "Subtask not found",
            };
        }

        if (subTask.projectId !== projectId) {
            return {
                success: false,
                error: "Subtask does not belong to this project",
            };
        }

        // 4. Validate input
        if (!text.trim() && !attachmentData) {
            return {
                success: false,
                error: "Comment text or attachment is required",
            };
        }

        let attachmentJson: any = null;
        if (attachmentData || previousStatus || targetStatus) {
            attachmentJson = {
                ...(attachmentData ? {
                    fileName: attachmentData.fileName,
                    fileType: attachmentData.fileType,
                    fileSize: attachmentData.fileSize,
                    data: attachmentData.base64Data,
                    uploadedAt: new Date().toISOString(),
                } : {}),
                ...(previousStatus ? { previousStatus } : {}),
                ...(targetStatus ? { targetStatus } : {}),
            };
        }

        // 6. Create activity
        const activity = await prisma.activity.create({
            data: {
                id: crypto.randomUUID(),
                subTaskId: subTaskId,
                authorId: user.id,
                workspaceId: workspaceId,
                text: text.trim() || "(No comment - attachment only)",
                attachment: attachmentJson as any,
                updatedAt: new Date(),
            },
            select: {
                id: true,
            },
        });

        // 6.5 Record Activity (Targeted real-time notifications)
        const { recordActivity } = await import("@/lib/audit");
        const targetUserIds = await getTaskInvolvedUserIds(subTaskId);

        await recordActivity({
            userId: user.id,
            userName: (user as any).surname || user.name || "Someone",
            workspaceId: workspaceId,
            action: "COMMENT_CREATED",
            entityType: "SUBTASK",
            entityId: subTaskId,
            newData: {
                id: activity.id,
                text: text.trim(),
                createdAt: new Date().toISOString()
            },
            broadcastEvent: "team_update", // Triggers surgical client-side sync
            targetUserIds,
        });

        return {
            success: true,
            activityId: activity.id,
        };
    } catch (error) {
        console.error("Error creating activity:", error);
        return {
            success: false,
            error: "An unexpected error occurred while creating the activity",
        };
    }
}
