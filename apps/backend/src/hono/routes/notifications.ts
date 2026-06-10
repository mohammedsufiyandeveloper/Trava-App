import { Hono } from "hono";
import prisma from "../../lib/db";
import { authMiddleware } from "../middleware/auth";

const app = new Hono();

// Helper to look up the metadata of the MEMBER_INVITED action for the same member
async function getInvitedMetadataForEntity(entityId: string, workspaceId: string) {
    if (!entityId) return null;

    // A. Check if the entityId itself is referenced in a MEMBER_REMOVED audit log or notification which contains the name in metadata
    const removedAudit = await prisma.audit_log.findFirst({
        where: {
            workspaceId,
            action: "MEMBER_REMOVED",
            entityId,
        },
        select: { metadata: true }
    });
    if (removedAudit?.metadata) {
        try {
            const meta = typeof removedAudit.metadata === "string" ? JSON.parse(removedAudit.metadata) : removedAudit.metadata;
            const payload = (meta as any)?.newData || (meta as any)?.oldData || (meta as any)?.payload;
            if (payload?.surname || payload?.name) {
                return {
                    name: payload.name || "User",
                    surname: payload.surname || payload.name || "User"
                };
            }
        } catch (_) {}
    }

    const removedNotif = await prisma.notification.findFirst({
        where: {
            workspaceId,
            type: "MEMBER_REMOVED",
            entityId,
        },
        select: { metadata: true }
    });
    if (removedNotif?.metadata) {
        try {
            const meta = typeof removedNotif.metadata === "string" ? JSON.parse(removedNotif.metadata) : removedNotif.metadata;
            const payload = (meta as any)?.newData || (meta as any)?.oldData || (meta as any)?.payload;
            if (payload?.surname || payload?.name) {
                return {
                    name: payload.name || "User",
                    surname: payload.surname || payload.name || "User"
                };
            }
        } catch (_) {}
    }

    // B. Try finding in MEMBER_INVITED notification/audit_log by direct entityId
    const inviteNotif = await prisma.notification.findFirst({
        where: {
            workspaceId,
            type: "MEMBER_INVITED",
            entityId,
        },
        select: { metadata: true }
    });
    if (inviteNotif?.metadata) {
        try {
            const meta = typeof inviteNotif.metadata === "string" ? JSON.parse(inviteNotif.metadata) : inviteNotif.metadata;
            const payload = (meta as any)?.payload || (meta as any)?.newData;
            if (payload?.surname || payload?.name) {
                return {
                    name: payload.name || "User",
                    surname: payload.surname || payload.name || "User"
                };
            }
        } catch (_) {}
    }

    const inviteAudit = await prisma.audit_log.findFirst({
        where: {
            workspaceId,
            action: "MEMBER_INVITED",
            entityId,
        },
        select: { metadata: true }
    });
    if (inviteAudit?.metadata) {
        try {
            const meta = typeof inviteAudit.metadata === "string" ? JSON.parse(inviteAudit.metadata) : inviteAudit.metadata;
            const payload = (meta as any)?.payload || (meta as any)?.newData;
            if (payload?.surname || payload?.name) {
                return {
                    name: payload.name || "User",
                    surname: payload.surname || payload.name || "User"
                };
            }
        } catch (_) {}
    }

    // C. Scan other audit logs in the workspace for any trace of this entityId
    // e.g. MEMBER_UPDATED or any action where entityId is part of metadata
    const anyAudit = await prisma.audit_log.findFirst({
        where: {
            workspaceId,
            entityId,
            action: { in: ["MEMBER_UPDATED", "MEMBER_REMOVED", "RESENT_INVITATION"] }
        },
        select: { metadata: true }
    });
    if (anyAudit?.metadata) {
        try {
            const meta = typeof anyAudit.metadata === "string" ? JSON.parse(anyAudit.metadata) : anyAudit.metadata;
            const payload = (meta as any)?.newData || (meta as any)?.oldData || (meta as any)?.payload;
            if (payload?.surname || payload?.name) {
                return {
                    name: payload.name || "User",
                    surname: payload.surname || payload.name || "User"
                };
            }
        } catch (_) {}
    }

    return null;
}

// Get notification history
app.get("/", authMiddleware, async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");
    const parsedLimit = Number.parseInt(c.req.query("limit") || "20", 10);
    const parsedOffset = Number.parseInt(c.req.query("offset") || "0", 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 50)
        : 20;
    const offset = Number.isFinite(parsedOffset) && parsedOffset > 0
        ? Math.min(parsedOffset, 10_000)
        : 0;

    if (!workspaceId) {
        return c.json({ success: false, error: "Workspace ID is required" }, 400);
    }

    try {
        const notificationWhere = {
            userId: user.id,
            workspaceId,
        };
        const [notificationRows, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where: notificationWhere,
                orderBy: {
                    createdAt: "desc",
                },
                take: limit + 1,
                skip: offset,
            }),
            prisma.notification.count({
                where: {
                    ...notificationWhere,
                    isRead: false,
                },
            }),
        ]);
        const hasMore = notificationRows.length > limit;
        const notifications = notificationRows.slice(0, limit);

        // Map notifications to fix body actor and enrich metadata on-the-fly
        const mappedNotifications = await Promise.all(notifications.map(async (n) => {
            let body = n.body;
            let metadata = n.metadata;

            if (n.type === "MEMBER_INVITED") {
                body = "System invited a new member";
                let metaObj: any = {};
                if (metadata) {
                    try {
                        metaObj = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
                    } catch (e) {
                        console.error("[GET_NOTIFICATIONS] Error parsing metadata:", e);
                    }
                }

                let targetName = 
                    metaObj?.newData?.surname || 
                    metaObj?.payload?.surname || 
                    metaObj?.newData?.name || 
                    metaObj?.payload?.name;

                if (!targetName && n.entityId) {
                    const enriched = await getInvitedMetadataForEntity(n.entityId, workspaceId);
                    if (enriched) {
                        metaObj = {
                            ...metaObj,
                            newData: {
                                name: enriched.name,
                                surname: enriched.surname,
                            },
                            payload: {
                                name: enriched.name,
                                surname: enriched.surname,
                            }
                        };
                        metadata = metaObj;
                        targetName = enriched.surname || enriched.name;
                    }
                }

                if (targetName) {
                    body = `${targetName} was invited to the workspace`;
                }
            } else if (n.type === "MEMBER_REMOVED") {
                body = "System removed a member";
                
                // Inspect metadata for removed member details
                let metaObj: any = {};
                if (metadata) {
                    try {
                        metaObj = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
                    } catch (e) {
                        console.error("[GET_NOTIFICATIONS] Error parsing metadata:", e);
                    }
                }

                let targetName = 
                    metaObj?.newData?.surname || 
                    metaObj?.payload?.surname || 
                    metaObj?.newData?.name || 
                    metaObj?.payload?.name ||
                    metaObj?.oldData?.surname ||
                    metaObj?.oldData?.name;

                if (!targetName && n.entityId) {
                    const enriched = await getInvitedMetadataForEntity(n.entityId, workspaceId);
                    if (enriched) {
                        metaObj = {
                            ...metaObj,
                            newData: {
                                name: enriched.name,
                                surname: enriched.surname,
                            },
                            payload: {
                                name: enriched.name,
                                surname: enriched.surname,
                            }
                        };
                        metadata = metaObj;
                        targetName = enriched.surname || enriched.name;
                    }
                }

                if (targetName) {
                    body = `${targetName} was removed from the workspace`;
                }
            }

            return {
                ...n,
                body,
                metadata,
            };
        }));

        return c.json({
            success: true,
            notifications: mappedNotifications,
            unreadCount,
            hasMore,
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
