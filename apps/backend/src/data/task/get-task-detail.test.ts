import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/db";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { getSubTasksByParentIds } from "./get-subtasks-batch";
import {
    getTaskCommentsPage,
    getTaskDetail,
    normalizeDetailPageSize,
} from "./get-task-detail";

vi.mock("./get-subtasks-batch", () => ({
    getSubTasksByParentIds: vi.fn(),
}));

const taskRecord = {
    id: "t1",
    projectId: "p1",
    workspaceId: "ws1",
    name: "Task",
    project: {
        id: "p1",
        name: "Project",
        workspaceId: "ws1",
        color: "#000000",
    },
    Tag: [],
    parentTask: null,
    _count: { subTasks: 2 },
    ProjectMember_Task_assigneeIdToProjectMember: null,
};

describe("task detail data", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.task.findUnique as any).mockResolvedValue(taskRecord);
        (getUserPermissions as any).mockResolvedValue({
            WorkspaceMemberId: "wm1",
        });
        (getSubTasksByParentIds as any).mockResolvedValue([
            {
                subTasks: [{ id: "st1" }],
                totalCount: 1,
                hasMore: false,
                nextCursor: null,
            },
        ]);
        (prisma.comment.findMany as any).mockResolvedValue([]);
        (prisma.activity.findMany as any).mockResolvedValue([]);
    });

    it("normalizes invalid and oversized page sizes", () => {
        expect(normalizeDetailPageSize(Number.NaN)).toBe(20);
        expect(normalizeDetailPageSize(0, 30)).toBe(30);
        expect(normalizeDetailPageSize(999)).toBe(50);
    });

    it("returns one bounded task-detail bootstrap after one access check", async () => {
        const result = await getTaskDetail("t1", "u1");

        expect(result.status).toBe("ok");
        expect(getUserPermissions).toHaveBeenCalledTimes(1);
        expect(getSubTasksByParentIds).toHaveBeenCalledWith(
            ["t1"],
            "ws1",
            "p1",
            {},
            30,
            "subtask",
            "u1",
            true
        );
        expect(prisma.comment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ take: 21 })
        );
        expect(prisma.activity.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ take: 21 })
        );
    });

    it("returns a cursor page in chronological display order", async () => {
        (prisma.comment.findMany as any).mockResolvedValue([
            { id: "c3", content: "3", createdAt: new Date(3), userId: "u1", user: null },
            { id: "c2", content: "2", createdAt: new Date(2), userId: "u1", user: null },
            { id: "c1", content: "1", createdAt: new Date(1), userId: "u1", user: null },
        ]);

        const result = await getTaskCommentsPage("t1", "u1", {
            limit: 2,
            cursor: "c4",
        });

        expect(result.status).toBe("ok");
        if (result.status !== "ok") throw new Error("Expected comment page");
        expect(result.comments.map((comment) => comment.id)).toEqual(["c2", "c3"]);
        expect(result.hasMore).toBe(true);
        expect(result.nextCursor).toBe("c2");
        expect(prisma.comment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                cursor: { id: "c4" },
                skip: 1,
                take: 3,
            })
        );
    });

    it("rejects users without workspace membership", async () => {
        (getUserPermissions as any).mockResolvedValue({
            WorkspaceMemberId: null,
        });

        const result = await getTaskDetail("t1", "outsider");
        expect(result.status).toBe("forbidden");
        expect(prisma.comment.findMany).not.toHaveBeenCalled();
    });
});
