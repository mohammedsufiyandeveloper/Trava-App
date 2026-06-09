import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/db";
import { resolveTaskPermissions } from "./get-tasks";
import { getKanbanBoard, KANBAN_STATUSES } from "./get-kanban";

vi.mock("./get-tasks", () => ({
    resolveTaskPermissions: vi.fn(),
}));

const task = (id: string, status: string, createdAt: string) => ({
    id,
    name: id,
    status,
    createdAt: new Date(createdAt),
    ProjectMember_Task_assigneeIdToProjectMember: null,
    Tag: [],
});

describe("getKanbanBoard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (resolveTaskPermissions as any).mockResolvedValue({
            permissions: { WorkspaceMemberId: "wm1" },
            isWorkspaceAdmin: true,
            fullAccessProjectIds: [],
            restrictedProjectIds: [],
        });
        (prisma.task.groupBy as any).mockResolvedValue([
            { status: "TO_DO", _count: { id: 11 } },
            { status: "IN_PROGRESS", _count: { id: 1 } },
        ]);
        (prisma.task.findMany as any).mockImplementation(({ where }: any) => {
            const status = where.status.in[0];
            if (status === "TO_DO") {
                return Array.from({ length: 11 }, (_, index) =>
                    task(`todo-${index}`, status, `2026-06-${String(20 - index).padStart(2, "0")}T00:00:00.000Z`)
                );
            }
            if (status === "IN_PROGRESS") {
                return [task("doing-1", status, "2026-06-09T00:00:00.000Z")];
            }
            return [];
        });
    });

    it("returns every status, grouped counts, bounded pages, and cursors", async () => {
        const result = await getKanbanBoard({
            workspaceId: "ws1",
            projectIds: ["p1", "p2"],
            pageSize: 10,
        }, "u1");

        expect(prisma.task.groupBy).toHaveBeenCalledTimes(1);
        expect(prisma.task.findMany).toHaveBeenCalledTimes(KANBAN_STATUSES.length);
        expect(Object.keys(result.columns)).toEqual([...KANBAN_STATUSES]);
        expect((result.columns as any).TO_DO.tasks).toHaveLength(10);
        expect((result.columns as any).TO_DO.totalCount).toBe(11);
        expect((result.columns as any).TO_DO.hasMore).toBe(true);
        expect((result.columns as any).TO_DO.nextCursor.id).toBe("todo-9");
        expect((result.columns as any).IN_PROGRESS.totalCount).toBe(1);

        const firstQuery = (prisma.task.findMany as any).mock.calls[0][0];
        expect(firstQuery.take).toBe(11);
        expect(firstQuery.where.projectId).toEqual({ in: ["p1", "p2"] });
        expect(firstQuery.where.parentTaskId).toEqual({ not: null });
    });

    it("returns empty columns without querying tasks for an unauthorized user", async () => {
        (resolveTaskPermissions as any).mockResolvedValue({
            permissions: { WorkspaceMemberId: null },
            isWorkspaceAdmin: false,
            fullAccessProjectIds: [],
            restrictedProjectIds: [],
        });

        const result = await getKanbanBoard({ workspaceId: "ws1" }, "u1");

        expect(prisma.task.groupBy).not.toHaveBeenCalled();
        expect(prisma.task.findMany).not.toHaveBeenCalled();
        expect((result.columns as any).TO_DO.tasks).toEqual([]);
    });
});
