"use server";

import prisma from "@/lib/db";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { format } from "date-fns";

export async function loadMoreReportsAction({
    workspaceId,
    date,
    userId,
    skip = 0,
    take = 30
}: {
    workspaceId: string;
    date?: string;
    userId?: string;
    skip?: number;
    take?: number;
}) {
    const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(workspaceId);
    if (!workspaceMember) throw new Error("Unauthorized");

    // If not admin, only show own reports
    const effectiveUserId = isWorkspaceAdmin ? userId : workspaceMember.userId;

    const dateQuery = date ? new Date(date) : undefined;
    if (dateQuery) dateQuery.setHours(0, 0, 0, 0);

    const reports = await prisma.dailyReport.findMany({
        where: {
            workspaceId,
            ...(dateQuery ? { date: dateQuery } : {}),
            ...(effectiveUserId ? { userId: effectiveUserId } : {})
        },
        include: {
            user: {
                select: {
                    id: true,
                    surname: true,
                    email: true
                }
            },
            entries: {
                include: {
                    task: {
                        select: {
                            id: true,
                            name: true,
                            taskSlug: true,
                            project: {
                                select: {
                                    name: true,
                                    color: true
                                }
                            },
                            parentTask: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    createdAt: "asc"
                }
            }
        },
        orderBy: [
            { date: "desc" },
            { submittedAt: "desc" }
        ],
        skip,
        take
    });

    const rows: any[] = [];

    for (const report of reports) {
        if (report.status === "ABSENT" || report.status === "NOT_SUBMITTED") {
            rows.push({
                id: `${report.status.toLowerCase()}-${report.id}`,
                userId: report.userId,
                user: report.user,
                status: report.status,
                submittedAt: null,
                type: "NONE",
                task: null,
                description: report.status === "ABSENT" ? "No report submitted (Absent)." : "Not yet submitted.",
                date: report.date,
            });
        } else if (report.entries.length === 0) {
            rows.push({
                id: `empty-${report.id}`,
                userId: report.userId,
                user: report.user,
                status: report.status,
                submittedAt: report.submittedAt,
                type: "NONE",
                task: null,
                description: "Submitted an empty report.",
                date: report.date,
            });
        } else {
            rows.push({
                id: report.id,
                userId: report.userId,
                user: report.user,
                status: report.status,
                submittedAt: report.submittedAt,
                date: report.date,
                entries: report.entries,
                // Easy access for the first entry's data
                task: report.entries[0]?.task,
                description: report.entries[0]?.description,
            });
        }
    }

    return rows;
}
