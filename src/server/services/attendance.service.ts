
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { recordActivity } from "@/lib/audit";
import { randomUUID } from "crypto";
import { AttendanceStatus, LeaveStatus } from"@prisma/client";

export class AttendanceService {
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
     * Get attendance for today for a specific user.
     */
    static async getTodayAttendance(workspaceId: string, userId: string) {
        const member = await this.getWorkspaceMember(workspaceId, userId);
        
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        return await prisma.attendance.findUnique({
            where: {
                workspaceMemberId_date: {
                    workspaceMemberId: member.id,
                    date: today,
                }
            }
        });
    }

    /**
     * Check In for the day.
     */
    static async checkIn({
        workspaceId,
        userId,
        latitude,
        longitude,
        address
    }: {
        workspaceId: string;
        userId: string;
        latitude?: number;
        longitude?: number;
        address?: string;
    }) {
        const member = await this.getWorkspaceMember(workspaceId, userId);
        
        const now = new Date();
        const dateOnly = new Date(now);
        dateOnly.setUTCHours(0, 0, 0, 0);

        // Check if already checked in
        const existing = await prisma.attendance.findUnique({
            where: {
                workspaceMemberId_date: {
                    workspaceMemberId: member.id,
                    date: dateOnly,
                }
            }
        });

        if (existing) {
            throw AppError.Conflict("You have already checked in today.");
        }

        const id = randomUUID();

        const attendance = await prisma.attendance.create({
            data: {
                id,
                workspaceId,
                workspaceMemberId: member.id,
                date: dateOnly,
                checkIn: now,
                checkInLatitude: latitude,
                checkInLongitude: longitude,
                checkInAddress: address,
                status: AttendanceStatus.PRESENT,
                updatedAt: now,
            }
        });

        // Record Audit Activity
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, surname: true } });
        await recordActivity({
            userId,
            userName: (user as any)?.surname || user?.name || "Someone",
            workspaceId,
            action: "CHECKED_IN",
            entityType: "ATTENDANCE",
            entityId: id,
            newData: { checkIn: now.toISOString(), latitude, longitude, address },
            broadcastEvent: "team_update",
        });

        return attendance;
    }

    /**
     * Check Out for the day.
     */
    static async checkOut({
        workspaceId,
        userId,
        latitude,
        longitude,
        address
    }: {
        workspaceId: string;
        userId: string;
        latitude?: number;
        longitude?: number;
        address?: string;
    }) {
        const member = await this.getWorkspaceMember(workspaceId, userId);
        
        const now = new Date();
        const dateOnly = new Date(now);
        dateOnly.setUTCHours(0, 0, 0, 0);

        const existing = await prisma.attendance.findUnique({
            where: {
                workspaceMemberId_date: {
                    workspaceMemberId: member.id,
                    date: dateOnly,
                }
            }
        });

        if (!existing) {
            throw AppError.NotFound("You must check in before checking out.");
        }

        if (existing.checkOut) {
            throw AppError.Conflict("You have already checked out today.");
        }

        const updated = await prisma.attendance.update({
            where: { id: existing.id },
            data: {
                checkOut: now,
                checkOutLatitude: latitude,
                checkOutLongitude: longitude,
                checkOutAddress: address,
                updatedAt: now,
            }
        });

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, surname: true } });
        await recordActivity({
            userId,
            userName: (user as any)?.surname || user?.name || "Someone",
            workspaceId,
            action: "CHECKED_OUT",
            entityType: "ATTENDANCE",
            entityId: existing.id,
            newData: { checkOut: now.toISOString(), latitude, longitude, address },
            broadcastEvent: "team_update",
        });

        return updated;
    }

    /**
     * Get Workspace Attendance for a given date range
     */
    static async getWorkspaceAttendance(workspaceId: string, startDate: Date, endDate: Date) {
        // Find all records in the date range for the workspace
        return await prisma.attendance.findMany({
            where: {
                workspaceId,
                date: {
                    gte: startDate,
                    lte: endDate,
                }
            },
            include: {
                workspaceMember: {
                    include: {
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
                date: 'desc'
            }
        });
    }

    /**
     * Get Team Attendance Register for a specific date
     */
    static async getTeamRegister(workspaceId: string, date: Date) {
        const dateOnly = new Date(date);
        dateOnly.setUTCHours(0, 0, 0, 0);

        // 1. Get all members of the workspace
        const members = await prisma.workspaceMember.findMany({
            where: { workspaceId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        email: true,
                        image: true,
                    }
                }
            }
        });

        // 2. Get all attendance records for this workspace on this date
        const attendanceRecords = await prisma.attendance.findMany({
            where: {
                workspaceId,
                date: dateOnly,
            }
        });

        // 3. Get all approved leave requests for this date
        const leaveRequests = await prisma.leave_request.findMany({
            where: {
                workspaceId,
                status: LeaveStatus.APPROVED,
                startDate: { lte: dateOnly },
                endDate: { gte: dateOnly },
            }
        });

        // 4. Map them together
        return members.map(member => {
            const attendance = attendanceRecords.find(a => a.workspaceMemberId === member.id);
            const leave = leaveRequests.find(l => l.workspaceMemberId === member.id);
            
            return {
                member,
                attendance: attendance || (leave ? { status: AttendanceStatus.ON_LEAVE, date: dateOnly } : null),
            };
        });
    }
}
