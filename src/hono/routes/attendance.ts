import { Hono } from "hono";
import { AttendanceService } from "@/server/services/attendance.service";
import { HonoVariables } from "../types";

export const attendanceRouter = new Hono<{ Variables: HonoVariables }>()

.get("/", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId");

    if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startDateStr = c.req.query("startDate");
    const endDateStr = c.req.query("endDate");

    const startDate = startDateStr ? new Date(startDateStr) : defaultStart;
    const endDate = endDateStr ? new Date(endDateStr) : defaultEnd;

    try {
        const records = await AttendanceService.getWorkspaceAttendance(workspaceId, startDate, endDate);
        return c.json({ success: true, data: records });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 400);
    }
})

.get("/today", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId");

    if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

    try {
        const record = await AttendanceService.getTodayAttendance(workspaceId, user.id);
        return c.json({ success: true, data: record });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 400);
    }
})

.get("/register", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId");
    const dateStr = c.req.query("clientDateString");
    const date = dateStr ? new Date(dateStr) : new Date();

    if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

    try {
        const register = await AttendanceService.getTeamRegister(workspaceId, date);
        return c.json({ success: true, register });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 400);
    }
})

.post("/check-in", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId") || body.workspaceId;
    
    if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

    try {
        const { latitude, longitude, address } = body;

        // Geolocation restriction based on user requirement
        if (!latitude || !longitude) {
            return c.json({ success: false, error: "Location is required to check in." }, 400);
        }

        const result = await AttendanceService.checkIn({
            workspaceId,
            userId: user.id,
            latitude,
            longitude,
            address,
        });
        return c.json({ success: true, data: result });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, (parseInt(error.statusCode) || 400) as any);
    }
})

.post("/check-out", async (c) => {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const workspaceId = c.req.header("x-workspace-id") || c.req.query("workspaceId") || body.workspaceId;
    
    if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

    try {
        const { latitude, longitude, address } = body;

        // Geolocation restriction based on user requirement
        if (!latitude || !longitude) {
            return c.json({ success: false, error: "Location is required to check out." }, 400);
        }

        const result = await AttendanceService.checkOut({
            workspaceId,
            userId: user.id,
            latitude,
            longitude,
            address,
        });
        return c.json({ success: true, data: result });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, (parseInt(error.statusCode) || 400) as any);
    }
});
