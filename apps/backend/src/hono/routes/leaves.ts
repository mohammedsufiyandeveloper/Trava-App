import { Hono } from "hono";
import { LeaveService } from "@/server/services/leave.service";
import { HonoVariables } from "../types";
import { LeaveType, LeaveStatus } from "@prisma/client";

export const leavesRouter = new Hono<{ Variables: HonoVariables }>()

.get("/", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId");

    if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

    const onlyMine = c.req.query("onlyMine") === "true";

    try {
        const records = await LeaveService.getLeaveRequests(workspaceId, user.id, onlyMine ? user.id : undefined);
        return c.json({ success: true, data: records });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 400);
    }
})

.get("/balance", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId");

    if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

    try {
        const balance = await LeaveService.getLeaveBalance(workspaceId, user.id);
        return c.json({ success: true, data: balance });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 400);
    }
})

.post("/", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId") || body.workspaceId;
    
    if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

    try {
        const { startDate, endDate, reason, type } = body;

        if (!startDate || !endDate || !reason || !type) {
            return c.json({ success: false, error: "Missing required fields" }, 400);
        }

        const result = await LeaveService.submitLeaveRequest({
            workspaceId,
            userId: user.id,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            type: type as LeaveType,
        });
        return c.json({ success: true, data: result });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 400);
    }
})

.patch("/:id", async (c) => {
    const user = c.get("user");
    const leaveId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId") || body.workspaceId;

    if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

    try {
        const { status } = body;

        if (!status || !Object.values(LeaveStatus).includes(status)) {
            return c.json({ success: false, error: "Invalid status" }, 400);
        }

        const result = await LeaveService.updateLeaveStatus({
            workspaceId,
            leaveId,
            status: status as LeaveStatus,
            adminUserId: user.id,
        });
        return c.json({ success: true, data: result });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 400);
    }
});
