import { Hono } from "hono";
import { AttendanceService } from "@/server/services/attendance.service";
import { attendanceApiKeyMiddleware } from "../middleware/attendance-api-key";

/**
 * Attendance integration API (machine-to-machine).
 *
 * Mounted OUTSIDE the session auth middleware and guarded by
 * TRAVA_ATTENDANCE_API_KEY instead — external callers have no session token.
 *
 * GET /api/integrations/attendance/summary
 *       ?workspaceId=<id>            (required)
 *       &date=YYYY-MM-DD             (optional, defaults to today)
 *       &include=people              (optional, adds the per-member breakdown)
 */
export const attendanceIntegrationRouter = new Hono()
    .use("*", attendanceApiKeyMiddleware)

    .get("/summary", async (c) => {
        const workspaceId = c.req.query("workspaceId") || c.req.header("x-workspace-id");
        if (!workspaceId) {
            return c.json({ success: false, error: "workspaceId is required" }, 400);
        }

        const dateStr = c.req.query("date");
        let date: Date;
        if (dateStr) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return c.json({ success: false, error: "date must be YYYY-MM-DD" }, 400);
            }
            date = new Date(`${dateStr}T00:00:00.000Z`);
            if (isNaN(date.getTime())) {
                return c.json({ success: false, error: "date is not a valid calendar date" }, 400);
            }
        } else {
            date = new Date();
        }

        const includePeople = c.req.query("include")?.split(",").includes("people") ?? false;

        try {
            const summary = await AttendanceService.getAttendanceSummary(workspaceId, date, {
                includePeople,
            });
            c.header("Cache-Control", "private, no-store");
            return c.json({ success: true, data: summary });
        } catch (error: any) {
            // This endpoint faces external systems: log the detail, return a
            // generic message so DB/stack internals never leave the server.
            console.error("[ATTENDANCE_INTEGRATION_ERROR]", error);
            return c.json({ success: false, error: "Failed to build attendance summary" }, 500);
        }
    });

export default attendanceIntegrationRouter;
