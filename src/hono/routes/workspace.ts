import { Hono } from "hono";
import { WorkspaceService } from "@/server/services/workspace.service";
import { HonoVariables } from "../types";

export const workspaceRouter = new Hono<{ Variables: HonoVariables }>()

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
});
