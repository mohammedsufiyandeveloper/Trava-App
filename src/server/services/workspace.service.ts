import "server-only";
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { recordActivity } from "@/lib/audit";

export class WorkspaceService {
    /**
     * Get workspace settings.
     */
    static async getSettings(workspaceId: string, userId: string) {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: {
                members: {
                    where: { userId },
                    select: { workspaceRole: true }
                }
            }
        });

        if (!workspace) throw AppError.NotFound("Workspace not found.");

        const member = workspace.members[0];
        if (!member) throw AppError.Forbidden("You are not a member of this workspace.");

        const isAdmin = member.workspaceRole === "ADMIN" || member.workspaceRole === "OWNER";

        return {
            id: workspace.id,
            name: workspace.name,
            lateThreshold: workspace.lateThreshold,
            overtimeThreshold: workspace.overtimeThreshold,
            halfDayThreshold: workspace.halfDayThreshold,
            shiftStartTime: workspace.shiftStartTime,
            shiftEndTime: workspace.shiftEndTime,
            sickLeaveLimit: workspace.sickLeaveLimit,
            casualLeaveAccrualDays: workspace.casualLeaveAccrualDays,
            isAdmin,
        };
    }

    /**
     * Update workspace settings.
     */
    static async updateSettings(workspaceId: string, userId: string, data: any) {
        // Check permissions
        const member = await prisma.workspaceMember.findFirst({
            where: { workspaceId, userId }
        });

        if (!member || (member.workspaceRole !== "ADMIN" && member.workspaceRole !== "OWNER")) {
            throw AppError.Forbidden("Only admins can update workspace settings.");
        }

        const allowedFields = [
            "name",
            "lateThreshold",
            "overtimeThreshold",
            "halfDayThreshold",
            "shiftStartTime",
            "shiftEndTime",
            "sickLeaveLimit",
            "casualLeaveAccrualDays"
        ];

        const updateData: any = {};
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        }

        const updatedWorkspace = await prisma.workspace.update({
            where: { id: workspaceId },
            data: updateData
        });

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, surname: true } });
        await recordActivity({
            userId,
            userName: user?.surname || user?.name || "Admin",
            workspaceId,
            action: "WORKSPACE_UPDATED",
            entityType: "WORKSPACE",
            entityId: workspaceId,
            newData: updateData,
            broadcastEvent: "team_update",
        });

        return updatedWorkspace;
    }
}
