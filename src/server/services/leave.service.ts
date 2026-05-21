import prisma from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { recordActivity, AuditAction } from "@/lib/audit";
import { randomUUID } from "crypto";
import { LeaveStatus, LeaveType } from "@prisma/client";

export class LeaveService {
    /**
     * Check if a user is an admin or owner of the workspace.
     */
    private static async isAdmin(workspaceId: string, userId: string) {
        const member = await this.getWorkspaceMember(workspaceId, userId);
        return member.workspaceRole === "ADMIN" || member.workspaceRole === "OWNER";
    }

    /**
     * Get the WorkspaceMember ID for a specific user in a workspace.
     */
    private static async getWorkspaceMember(workspaceId: string, userId: string) {
        const member = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId,
                userId,
            },
        });

        if (!member) {
            throw AppError.Forbidden("You are not a member of this workspace.");
        }

        return member;
    }

    /**
     * Get leave balance for a specific user.
     */
    static async getLeaveBalance(workspaceId: string, userId: string) {
        const member = await prisma.workspaceMember.findFirst({
            where: { workspaceId, userId },
            include: { 
                workspace: { select: { casualLeaveAccrualDays: true } },
                WorkspaceMember: { 
                    include: { 
                        user: { select: { name: true, surname: true } } 
                    } 
                }
            }
        });

        if (!member) throw AppError.Forbidden("You are not a member of this workspace.");

        const manager = member.WorkspaceMember?.user;
        const reportingManagerName = manager ? (manager.surname || manager.name) : "Not Assigned";

        return {
            casualLeaveBalance: member.casualLeaveBalance,
            sickLeaveBalance: member.sickLeaveBalance,
            accruedDaysCount: member.accruedDaysCount,
            casualLeaveAccrualDays: member.workspace.casualLeaveAccrualDays,
            reportingManager: reportingManagerName,
        };
    }

    /**
     * Get all leave requests for a workspace or a specific user.
     */
    static async getLeaveRequests(workspaceId: string, requestingUserId: string, targetUserId?: string) {
        const isAdmin = await this.isAdmin(workspaceId, requestingUserId);

        const where: any = { workspaceId };
        if (targetUserId) {
            if (targetUserId !== requestingUserId && !isAdmin) {
                throw AppError.Forbidden("You can only view your own leave requests.");
            }
            const member = await this.getWorkspaceMember(workspaceId, targetUserId);
            where.workspaceMemberId = member.id;
        } else {
            if (!isAdmin) {
                throw AppError.Forbidden("Only admins can view team leave requests.");
            }
        }

        return await prisma.leave_request.findMany({
            where,
            include: {
                WorkspaceMember: {
                    select: {
                        id: true,
                        casualLeaveBalance: true,
                        sickLeaveBalance: true,
                        user: {
                            select: {
                                name: true,
                                surname: true,
                                email: true,
                                image: true,
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Submit a new leave request.
     */
    static async submitLeaveRequest({
        workspaceId,
        userId,
        startDate,
        endDate,
        reason,
        type
    }: {
        workspaceId: string;
        userId: string;
        startDate: Date;
        endDate: Date;
        reason: string;
        type: LeaveType;
    }) {
        const member = await this.getWorkspaceMember(workspaceId, userId);

        // Basic validation: end date should be after start date
        if (endDate < startDate) {
            throw AppError.BadRequest("End date cannot be before start date.");
        }

        const id = randomUUID();

        const leaveRequest = await prisma.leave_request.create({
            data: {
                id,
                workspaceId,
                workspaceMemberId: member.id,
                startDate,
                endDate,
                reason,
                type,
                status: LeaveStatus.PENDING,
                updatedAt: new Date(),
            }
        });

        // Record Audit Activity
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, surname: true } });
        await recordActivity({
            userId,
            userName: user?.name || user?.surname || "Someone",
            workspaceId,
            action: "LEAVE_REQUEST_SUBMITTED",
            entityType: "LEAVE_REQUEST",
            entityId: id,
            newData: { startDate, endDate, reason, type },
            broadcastEvent: "team_update",
        });

        return leaveRequest;
    }

    /**
     * Update leave request status (Approve/Reject).
     */
    static async updateLeaveStatus({
        workspaceId,
        leaveId,
        status,
        adminUserId
    }: {
        workspaceId: string;
        leaveId: string;
        status: LeaveStatus;
        adminUserId: string;
    }) {
        if (!(await this.isAdmin(workspaceId, adminUserId))) {
            throw AppError.Forbidden("Only admins can update leave status.");
        }

        const leaveRequest = await prisma.leave_request.findUnique({
            where: { id: leaveId },
            include: { WorkspaceMember: true }
        });

        if (!leaveRequest || leaveRequest.workspaceId !== workspaceId) {
            throw AppError.NotFound("Leave request not found.");
        }

        if (leaveRequest.status !== LeaveStatus.PENDING) {
            throw AppError.BadRequest("Only pending leave requests can be updated.");
        }

        const updated = await prisma.leave_request.update({
            where: { id: leaveId },
            data: {
                status,
                updatedAt: new Date(),
            }
        });

        // If approved, deduct from balance
        if (status === LeaveStatus.APPROVED) {
            const startDate = new Date(leaveRequest.startDate);
            const endDate = new Date(leaveRequest.endDate);
            const durationInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

            if (leaveRequest.type === LeaveType.CASUAL) {
                await prisma.workspaceMember.update({
                    where: { id: leaveRequest.workspaceMemberId },
                    data: { casualLeaveBalance: { decrement: durationInDays } }
                });
            } else if (leaveRequest.type === LeaveType.SICK) {
                await prisma.workspaceMember.update({
                    where: { id: leaveRequest.workspaceMemberId },
                    data: { sickLeaveBalance: { decrement: durationInDays } }
                });
            }
        }

        // Record Audit Activity
        const adminUser = await prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true, surname: true } });
        await recordActivity({
            userId: adminUserId,
            userName: adminUser?.name || adminUser?.surname || "Admin",
            workspaceId,
            action: `LEAVE_REQUEST_${status}` as AuditAction,
            entityType: "LEAVE_REQUEST",
            entityId: leaveId,
            newData: { status },
            broadcastEvent: "team_update",
        });

        return updated;
    }
}
