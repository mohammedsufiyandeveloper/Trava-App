import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import tasks from "./tasks";
import { getTasks } from "@/data/task/get-tasks";
import { getKanbanBoard } from "@/data/task/get-kanban";
import {
    getTaskCommentsPage,
    getTaskDetail,
} from "@/data/task/get-task-detail";
import { HonoVariables } from "../types";

vi.mock("@/data/task/get-tasks", () => ({
    getTasks: vi.fn(),
    resolveTaskPermissions: vi.fn(),
}));

vi.mock("@/data/task/get-kanban", () => ({
    getKanbanBoard: vi.fn(),
}));

vi.mock("@/data/task/get-task-detail", () => ({
    getTaskDetail: vi.fn(),
    getTaskCommentsPage: vi.fn(),
    getTaskActivitiesPage: vi.fn(),
    normalizeDetailPageSize: (value: number | undefined, fallback = 20) => {
        if (!Number.isFinite(value) || !value || value < 1) return fallback;
        return Math.min(Math.trunc(value), 50);
    },
}));

const app = new Hono<{ Variables: HonoVariables }>();
app.use("*", async (c, next) => {
    c.set("user", { id: "u1" } as any);
    await next();
});
app.route("/tasks", tasks);

describe("GET /tasks parsing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getTasks as any).mockResolvedValue({
            tasks: [],
            totalCount: 0,
            hasMore: false,
            nextCursor: null,
        });
        (getKanbanBoard as any).mockResolvedValue({ columns: {} });
        (getTaskDetail as any).mockResolvedValue({
            status: "ok",
            task: { id: "t1" },
            subTasks: [],
            subTasksPage: { totalCount: 0, hasMore: false, nextCursor: null },
            comments: [],
            commentsPage: { hasMore: false, nextCursor: null },
            activities: [],
            activitiesPage: { hasMore: false, nextCursor: null },
        });
        (getTaskCommentsPage as any).mockResolvedValue({
            status: "ok",
            comments: [],
            hasMore: false,
            nextCursor: null,
        });
    });

    it("propagates view_mode and uses its default limit", async () => {
        const response = await app.request("/tasks?workspaceId=ws1&view_mode=gantt");

        expect(response.status).toBe(200);
        expect(getTasks).toHaveBeenCalledWith(
            expect.objectContaining({ view_mode: "gantt", limit: 150 }),
            "u1"
        );
    });

    it("normalizes invalid view modes and limit boundaries", async () => {
        await app.request("/tasks?workspaceId=ws1&view_mode=unknown&limit=0");
        expect(getTasks).toHaveBeenLastCalledWith(
            expect.objectContaining({ view_mode: "list", limit: 25 }),
            "u1"
        );

        await app.request("/tasks?workspaceId=ws1&limit=9999");
        expect(getTasks).toHaveBeenLastCalledWith(
            expect.objectContaining({ limit: 200 }),
            "u1"
        );

        await app.request("/tasks?workspaceId=ws1&limit=not-a-number");
        expect(getTasks).toHaveBeenLastCalledWith(
            expect.objectContaining({ limit: 25 }),
            "u1"
        );
    });

    it("preserves repeated project filters", async () => {
        await app.request("/tasks?workspaceId=ws1&projectId=p1&projectId=p2&parentId=parent-1");

        expect(getTasks).toHaveBeenCalledWith(
            expect.objectContaining({
                projectId: undefined,
                projectIds: ["p1", "p2"],
                filterParentTaskId: "parent-1",
            }),
            "u1"
        );
    });

    it("passes Kanban filters through the consolidated endpoint", async () => {
        const response = await app.request(
            "/tasks/kanban?workspaceId=ws1&projectId=p1&projectId=p2&assigneeId=u2&pageSize=99"
        );

        expect(response.status).toBe(200);
        expect(getKanbanBoard).toHaveBeenCalledWith({
            workspaceId: "ws1",
            projectIds: ["p1", "p2"],
            assigneeIds: ["u2"],
            tagIds: undefined,
            search: undefined,
            dueAfter: undefined,
            dueBefore: undefined,
            pageSize: 25,
        }, "u1");
    });

    it("consolidates task detail and clamps collection page sizes", async () => {
        const response = await app.request(
            "/tasks/t1/detail?subtaskLimit=999&commentLimit=0&activityLimit=not-a-number"
        );

        expect(response.status).toBe(200);
        expect(getTaskDetail).toHaveBeenCalledWith("t1", "u1", {
            subtaskLimit: 50,
            commentLimit: 20,
            activityLimit: 20,
        });
        expect(await response.json()).toEqual(
            expect.objectContaining({ success: true, task: { id: "t1" } })
        );
    });

    it("forwards comment cursors and returns forbidden access results", async () => {
        await app.request("/tasks/t1/comments?limit=999&cursor=c20");
        expect(getTaskCommentsPage).toHaveBeenCalledWith("t1", "u1", {
            limit: 50,
            cursor: "c20",
        });

        (getTaskCommentsPage as any).mockResolvedValueOnce({
            status: "forbidden",
            task: null,
        });
        const forbidden = await app.request("/tasks/t1/comments");
        expect(forbidden.status).toBe(403);
    });
});
