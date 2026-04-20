import { notFound } from "next/navigation";
import { ReportsTable } from "./_components/report-table";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { getWorkspaceMembers } from "@/data/workspace/get-workspace-members";
import prisma from "@/lib/db";

export default async function ReportsPage({
    params,
    searchParams
}: {
    params: Promise<{ workspaceId: string }>;
    searchParams: Promise<{ date?: string; userId?: string }>;
}) {
    const { workspaceId } = await params;
    const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(workspaceId);

    if (!workspaceMember) {
        return notFound();
    }

    const { workspaceMembers } = await getWorkspaceMembers(workspaceId);
    const search = await searchParams;
    // Check if user is an admin or manager to allow visibility of other reports
    const canManageReports = isWorkspaceAdmin;

    // Optional date filter - use UTC midnight to be timezone agnostic
    const dateQuery = search.date ? new Date(`${search.date}T00:00:00Z`) : undefined;

    // Handle filtering by specific user if permitted
    const effectiveUserId = canManageReports ? search.userId : workspaceMember.userId;

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
        take: 30
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
                date: report.date ? report.date.toISOString().split("T")[0] : null,
                entries: report.entries,
                task: report.entries[0]?.task,
                description: report.entries[0]?.description,
            });
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Daily Work Reports</h1>
                <p className="text-muted-foreground text-sm">
                    View work reports logs from your workspace assignees.
                </p>
            </div>

            <ReportsTable
                initialData={rows}
                workspaceId={workspaceId}
                members={workspaceMembers}
                initialDate={search.date}
                initialUserId={search.userId}
                isAdmin={canManageReports}
                currentUserId={workspaceMember.userId}
            />
        </div>
    );
}
