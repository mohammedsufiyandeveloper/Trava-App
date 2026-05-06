import { Hono } from "hono";
import prisma from "../../lib/db";
import { authMiddleware } from "../middleware/auth";

const app = new Hono();

// Get notification history
app.get("/", authMiddleware, async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");
    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");

    if (!workspaceId) {
        return c.json({ success: false, error: "Workspace ID is required" }, 400);
    }

    try {
        const notifications = await prisma.notification.findMany({
            where: {
                userId: user.id,
                workspaceId,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: limit,
            skip: offset,
        });

        const unreadCount = await prisma.notification.count({
            where: {
                userId: user.id,
                workspaceId,
                isRead: false,
            },
        });

        return c.json({
            success: true,
            notifications,
            unreadCount,
            hasMore: notifications.length === limit,
        });
    } catch (error) {
        console.error("[GET_NOTIFICATIONS_ERROR]", error);
        return c.json({ success: false, error: "Failed to fetch notifications" }, 500);
    }
});

// Mark single notification as read
app.patch("/:id/read", authMiddleware, async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");

    try {
        await prisma.notification.update({
            where: {
                id,
                userId: user.id,
            },
            data: { isRead: true },
        });

        return c.json({ success: true });
    } catch (error) {
        console.error("[MARK_READ_ERROR]", error);
        return c.json({ success: false, error: "Failed to mark as read" }, 500);
    }
});

// Mark all as read
app.post("/mark-all-read", authMiddleware, async (c) => {
    const user = c.get("user");
    const body = await c.req.json();
    const { workspaceId } = body;

    if (!workspaceId) {
        return c.json({ success: false, error: "Workspace ID is required" }, 400);
    }

    try {
        await prisma.notification.updateMany({
            where: {
                userId: user.id,
                workspaceId,
                isRead: false,
            },
            data: { isRead: true },
        });

        return c.json({ success: true });
    } catch (error) {
        console.error("[MARK_ALL_READ_ERROR]", error);
        return c.json({ success: false, error: "Failed to mark all as read" }, 500);
    }
});

export default app;
