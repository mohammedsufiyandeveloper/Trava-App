import { Hono } from "hono";
import { WorkspaceService } from "@/server/services/workspace.service";
import { getWorkspaces } from "@/data/workspace/get-workspaces";
import { getWorkspaceMembers } from "@/data/workspace/get-workspace-members";
import { HonoVariables } from "../types";
import { getUserProjects } from "@/data/project/get-projects";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import { AttendanceService } from "@/server/services/attendance.service";

export const workspaceRouter = new Hono<{ Variables: HonoVariables }>()

    .get("/", async (c) => {
        const user = c.get("user");
        try {
            const result = await getWorkspaces(user.id);
            return c.json({
                success: true,
                workspaces: result.workspaces,
                totalCount: result.totalCount
            });
        } catch (error: any) {
            console.error("Hono API Error [Workspaces]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    })

    .get("/bootstrap", async (c) => {
        const user = c.get("user");
        const preferredWorkspaceId = c.req.query("workspaceId") || undefined;
        const clientDateString = c.req.query("clientDateString");
        const requestedDate = clientDateString
            ? new Date(clientDateString)
            : new Date();
        const registerDate = Number.isNaN(requestedDate.getTime())
            ? new Date()
            : requestedDate;

        try {
            const workspaceResult = await getWorkspaces(user.id);
            const selectedWorkspace =
                workspaceResult.workspaces.find(
                    (workspace) => workspace.id === preferredWorkspaceId
                ) ??
                workspaceResult.workspaces[0] ??
                null;

            if (!selectedWorkspace) {
                return c.json({
                    success: true,
                    workspaces: workspaceResult.workspaces,
                    activeWorkspace: null,
                    projects: [],
                    tags: [],
                    todayAttendance: null,
                    teamAttendance: [],
                });
            }

            const isAdmin =
                selectedWorkspace.workspaceRole === "OWNER" ||
                selectedWorkspace.workspaceRole === "ADMIN";
            const [projects, tags, todayAttendance, teamAttendance] =
                await Promise.all([
                    getUserProjects(selectedWorkspace.id, true),
                    getWorkspaceTags(selectedWorkspace.id),
                    AttendanceService.getTodayAttendance(
                        selectedWorkspace.id,
                        user.id
                    ),
                    isAdmin
                        ? AttendanceService.getTeamRegister(
                            selectedWorkspace.id,
                            registerDate
                        )
                        : Promise.resolve([]),
                ]);

            return c.json({
                success: true,
                workspaces: workspaceResult.workspaces,
                activeWorkspace: selectedWorkspace,
                projects,
                tags,
                todayAttendance,
                teamAttendance,
            });
        } catch (error: any) {
            console.error("Hono API Error [Workspace bootstrap]:", error);
            return c.json(
                { success: false, error: error.message || "Internal Server Error" },
                500
            );
        }
    })

    .get("/settings", async (c) => {
        const user = c.get("user");
        const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId");

        if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
        if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

        try {
            const settings = await WorkspaceService.getSettings(workspaceId, user.id);
            return c.json({ success: true, data: settings });
        } catch (error: any) {
            return c.json({ success: false, error: error.message }, 400);
        }
    })

    .patch("/settings", async (c) => {
        const user = c.get("user");
        const body = await c.req.json().catch(() => ({}));
        const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId") || body.workspaceId;

        if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
        if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

        try {
            const result = await WorkspaceService.updateSettings(workspaceId, user.id, body);
            return c.json({ success: true, data: result });
        } catch (error: any) {
            return c.json({ success: false, error: error.message }, 400);
        }
    })

    .get("/:workspaceId/members", async (c) => {
        const workspaceId = c.req.param("workspaceId");
        const role = c.req.query("role") || undefined;

        try {
            const result = await getWorkspaceMembers(workspaceId, role);
            return c.json({
                success: true,
                members: result.workspaceMembers
            });
        } catch (error: any) {
            console.error(`Hono API Error [WorkspaceMembers]:`, error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    })

    .delete("/:workspaceId/members/:memberId", async (c) => {
        const user = c.get("user");
        const workspaceId = c.req.param("workspaceId");
        const memberId = c.req.param("memberId");

        if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);

        try {
            const { deleteMemberAction } = await import("@/actions/team/delete-member");
            const result = await deleteMemberAction(memberId, workspaceId, user.id);
            return result.status === "error"
                ? c.json({ success: false, error: result.message }, 400)
                : c.json({ success: true, message: result.message });
        } catch (error: any) {
            console.error("Hono API Error [WorkspaceMember DELETE]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    })

    .post("/:workspaceId/members/invite", async (c) => {
        const user = c.get("user");
        const workspaceId = c.req.param("workspaceId");
        const body = await c.req.json().catch(() => ({}));

        if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);

        try {
            const { inviteMemberAction } = await import("@/actions/team/invite-member");
            const result = await inviteMemberAction({ ...body, workspaceId });
            return result.status === "error"
                ? c.json({ success: false, error: result.message }, 400)
                : c.json({ success: true, message: result.message });
        } catch (error: any) {
            console.error("Hono API Error [WorkspaceMember INVITE]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    });
