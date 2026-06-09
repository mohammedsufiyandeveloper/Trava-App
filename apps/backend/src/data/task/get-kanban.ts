import { TaskStatus } from "@prisma/client";
import prisma from "@/lib/db";
import { resolveTaskPermissions } from "./get-tasks";
import { buildWorkspaceFilterWhere, getTaskSelect } from "@/lib/tasks/query-builder";
import { mapTaskAssignee } from "@/lib/tasks/mapper";

export const KANBAN_STATUSES = [
    TaskStatus.TO_DO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.REVIEW,
    TaskStatus.COMPLETED,
    TaskStatus.HOLD,
    TaskStatus.CANCELLED,
] as const;

export type GetKanbanOptions = {
    workspaceId: string;
    projectIds?: string[];
    assigneeIds?: string[];
    tagIds?: string[];
    search?: string;
    dueAfter?: Date;
    dueBefore?: Date;
    pageSize?: number;
};

const emptyColumns = () =>
    Object.fromEntries(
        KANBAN_STATUSES.map((status) => [
            status,
            { tasks: [], totalCount: 0, hasMore: false, nextCursor: null },
        ])
    );

export async function getKanbanBoard(options: GetKanbanOptions, userId: string) {
    const {
        permissions,
        isWorkspaceAdmin,
        fullAccessProjectIds,
        restrictedProjectIds,
    } = await resolveTaskPermissions(options.workspaceId, undefined, userId);

    if (!permissions.WorkspaceMemberId && !isWorkspaceAdmin) {
        return { columns: emptyColumns() };
    }

    const pageSize = Math.min(Math.max(options.pageSize ?? 10, 1), 25);
    const baseFilter = {
        workspaceId: options.workspaceId,
        projectIds: options.projectIds,
        assigneeId: options.assigneeIds,
        tagId: options.tagIds,
        search: options.search,
        dueAfter: options.dueAfter,
        dueBefore: options.dueBefore,
        isAdmin: isWorkspaceAdmin,
        fullAccessProjectIds,
        restrictedProjectIds,
        onlySubtasks: true,
        view_mode: "kanban",
    };

    const countWhere = buildWorkspaceFilterWhere(baseFilter, userId);
    const [counts, ...statusRows] = await Promise.all([
        prisma.task.groupBy({
            by: ["status"],
            where: countWhere,
            _count: { id: true },
        }),
        ...KANBAN_STATUSES.map((status) =>
            prisma.task.findMany({
                where: buildWorkspaceFilterWhere(
                    { ...baseFilter, status: [status] },
                    userId
                ),
                select: getTaskSelect("kanban"),
                orderBy: [
                    { createdAt: "desc" },
                    { id: "desc" },
                ],
                take: pageSize + 1,
            })
        ),
    ]);

    const countByStatus = new Map(
        counts.map((row) => [row.status, row._count.id])
    );

    const columns = Object.fromEntries(
        KANBAN_STATUSES.map((status, index) => {
            const rows = statusRows[index] as any[];
            const hasMore = rows.length > pageSize;
            const page = hasMore ? rows.slice(0, pageSize) : rows;
            const last = page[page.length - 1];

            return [
                status,
                {
                    tasks: page.map(mapTaskAssignee),
                    totalCount: countByStatus.get(status) ?? 0,
                    hasMore,
                    nextCursor: hasMore && last
                        ? { id: last.id, createdAt: last.createdAt }
                        : null,
                },
            ];
        })
    );

    return { columns };
}
