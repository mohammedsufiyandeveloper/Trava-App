
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { recordActivity } from "@/lib/audit";
import { randomUUID } from "crypto";
import { AttendanceStatus, LeaveStatus } from"@prisma/client";

export class AttendanceService {
    /**
     * Determine attendance status based on check-in time and workspace thresholds.
     */
    private static getAttendanceStatus(checkInTime: Date, lateThresholdStr: string, halfDayThresholdStr: string): AttendanceStatus {
        // Convert checkInTime to Indian Standard Time (IST, UTC+5:30)
        const istTime = new Date(checkInTime.getTime() + (5.5 * 60 * 60 * 1000));
        const checkInHours = istTime.getUTCHours();
        const checkInMinutes = istTime.getUTCMinutes();

        // Check Half Day
        const [hdHoursStr, hdMinutesStr] = halfDayThresholdStr.split(":");
        const hdHours = parseInt(hdHoursStr, 10);
        const hdMinutes = parseInt(hdMinutesStr, 10);
        if (checkInHours > hdHours || (checkInHours === hdHours && checkInMinutes > hdMinutes)) {
            return AttendanceStatus.HALF_DAY;
        }

        // Check Late
        const [lateHoursStr, lateMinutesStr] = lateThresholdStr.split(":");
        const lateHours = parseInt(lateHoursStr, 10);
        const lateMinutes = parseInt(lateMinutesStr, 10);
        if (checkInHours > lateHours || (checkInHours === lateHours && checkInMinutes > lateMinutes)) {
            return AttendanceStatus.LATE;
        }

        return AttendanceStatus.PRESENT;
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

        if (existing && existing.checkIn) {
            throw AppError.Conflict("You have already checked in today.");
        }

        // Get workspace thresholds to calculate status
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { lateThreshold: true, halfDayThreshold: true }
        });
        const lateThresholdStr = workspace?.lateThreshold || "09:40";
        const halfDayThresholdStr = workspace?.halfDayThreshold || "11:00";
        const status = this.getAttendanceStatus(now, lateThresholdStr, halfDayThresholdStr);

        let attendance;
        let finalId;

        if (existing) {
            finalId = existing.id;
            attendance = await prisma.attendance.update({
                where: { id: existing.id },
                data: {
                    checkIn: now,
                    checkInLatitude: latitude,
                    checkInLongitude: longitude,
                    checkInAddress: address,
                    status,
                    updatedAt: now,
                }
            });
        } else {
            finalId = randomUUID();
            attendance = await prisma.attendance.create({
                data: {
                    id: finalId,
                    workspaceId,
                    workspaceMemberId: member.id,
                    date: dateOnly,
                    checkIn: now,
                    checkInLatitude: latitude,
                    checkInLongitude: longitude,
                    checkInAddress: address,
                    status,
                    updatedAt: now,
                }
            });
        }

        // Record Audit Activity
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, surname: true } });
        await recordActivity({
            userId,
            userName: (user as any)?.surname || user?.name || "Someone",
            workspaceId,
            action: "CHECKED_IN",
            entityType: "ATTENDANCE",
            entityId: finalId,
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
