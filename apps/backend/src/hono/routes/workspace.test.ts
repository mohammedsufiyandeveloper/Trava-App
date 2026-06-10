import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspaces } from "@/data/workspace/get-workspaces";
import { getUserProjects } from "@/data/project/get-projects";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import { AttendanceService } from "@/server/services/attendance.service";
import { workspaceRouter } from "./workspace";
import { HonoVariables } from "../types";

vi.mock("@/data/workspace/get-workspaces", () => ({
    getWorkspaces: vi.fn(),
    invalidateWorkspacesCache: vi.fn(),
}));
vi.mock("@/data/project/get-projects", () => ({
    getUserProjects: vi.fn(),
}));
vi.mock("@/data/tag/get-tags", () => ({
    getWorkspaceTags: vi.fn(),
}));
vi.mock("@/server/services/attendance.service", () => ({
    AttendanceService: {
        getTodayAttendance: vi.fn(),
        getTeamRegister: vi.fn(),
    },
}));

const app = new Hono<{ Variables: HonoVariables }>();
app.use("*", async (c, next) => {
    c.set("user", { id: "u1" } as any);
    await next();
});
app.route("/workspaces", workspaceRouter);

describe("workspace bootstrap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getWorkspaces as any).mockResolvedValue({
            workspaces: [
                { id: "ws1", workspaceRole: "VIEWER" },
                { id: "ws2", workspaceRole: "ADMIN" },
            ],
            totalCount: 2,
        });
        (getUserProjects as any).mockResolvedValue([{ id: "p1" }]);
        (getWorkspaceTags as any).mockResolvedValue([{ id: "tag1" }]);
        (AttendanceService.getTodayAttendance as any).mockResolvedValue({
            id: "a1",
        });
        (AttendanceService.getTeamRegister as any).mockResolvedValue([
            { id: "team-a1" },
        ]);
    });

    it("loads the preferred admin workspace shell in one response", async () => {
        const response = await app.request(
            "/workspaces/bootstrap?workspaceId=ws2&clientDateString=2026-06-09"
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual(
            expect.objectContaining({
                success: true,
                activeWorkspace: { id: "ws2", workspaceRole: "ADMIN" },
                projects: [{ id: "p1" }],
                tags: [{ id: "tag1" }],
                todayAttendance: { id: "a1" },
                teamAttendance: [{ id: "team-a1" }],
            })
        );
        expect(getUserProjects).toHaveBeenCalledWith("ws2", true);
        expect(AttendanceService.getTeamRegister).toHaveBeenCalledTimes(1);
    });

    it("does not fetch team attendance for non-admin workspaces", async () => {
        const response = await app.request(
            "/workspaces/bootstrap?workspaceId=ws1"
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.teamAttendance).toEqual([]);
        expect(AttendanceService.getTeamRegister).not.toHaveBeenCalled();
    });

    it("returns an empty shell when the user has no workspaces", async () => {
        (getWorkspaces as any).mockResolvedValue({
            workspaces: [],
            totalCount: 0,
        });

        const response = await app.request("/workspaces/bootstrap");
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.activeWorkspace).toBeNull();
        expect(getUserProjects).not.toHaveBeenCalled();
    });
});
