import { Hono } from "hono";
import { WorkspaceService } from "@/server/services/workspace.service";
import { getWorkspaces } from "@/data/workspace/get-workspaces";
import { getWorkspaceMembers } from "@/data/workspace/get-workspace-members";
import { HonoVariables } from "../types";

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
