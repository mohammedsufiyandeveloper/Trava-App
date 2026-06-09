import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import tasks from "./tasks";
import { getTasks } from "@/data/task/get-tasks";
import { getKanbanBoard } from "@/data/task/get-kanban";
import { HonoVariables } from "../types";

vi.mock("@/data/task/get-tasks", () => ({
    getTasks: vi.fn(),
    resolveTaskPermissions: vi.fn(),
}));

vi.mock("@/data/task/get-kanban", () => ({
    getKanbanBoard: vi.fn(),
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
});
