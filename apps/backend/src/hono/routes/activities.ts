import { Hono } from "hono";
import { HonoVariables } from "../types";
import prisma from "@/lib/db";

const activities = new Hono<{ Variables: HonoVariables }>();

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


/**
 * GET /api/activities
 * 
 * Fetches recent activity logs using the audit_log model.
 * Admins/Owners see everything. Members see only what's related to them.
 */
activities.get("/", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");
    const projectId = c.req.query("projectId");

    if (!workspaceId) {
        return c.json({ error: "Missing workspaceId" }, 400);
    }

    try {
        // 1. Determine user's role in the workspace
        const member = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: user.id,
                    workspaceId
                }
            },
            select: { workspaceRole: true }
        });

        const isAdmin = member?.workspaceRole === "ADMIN" || member?.workspaceRole === "OWNER";

        // 2. Build Query
        const where: any = { workspaceId };

        if (!isAdmin) {
            // Members see only their actions OR where they are target recipients
            where.OR = [
                { userId: user.id },
                {
                    metadata: {
                        path: ["targetUserIds"],
                        array_contains: [user.id]
                    }
                }
            ];
        }

        // 3. Project Filter
        if (projectId) {
            const tasks = await prisma.task.findMany({
                where: { projectId },
                select: { id: true }
            });
            const projectTaskIds = tasks.map(t => t.id);

            if (projectTaskIds.length > 0) {
                where.entityId = { in: projectTaskIds };
            } else {
                // If no tasks in project, return empty
                return c.json({ success: true, activities: [] });
            }
        }

        const logs = await prisma.audit_log.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        surname: true,
                        image: true,
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            },
            take: 50 // Admins might want to see more
        });

        // 4. Map to friendly format
        const formatted = await Promise.all(logs.map(async (log) => {
            let message = log.action.replace(/_/g, " ").toLowerCase();
            let meta = log.metadata as any;

            if (log.action === "MEMBER_INVITED") message = "invited a new member";
            if (log.action === "MEMBER_REMOVED") message = "removed a member";
            if (log.action === "TASK_CREATED") message = "created a new task";
            if (log.action === "TASK_UPDATED") message = "updated a task";
            if (log.action === "SUBTASK_CREATED") message = "created a subtask";
            if (log.action === "SUBTASK_UPDATED") {
                if (meta?.payload?.status) {
                    message = `updated status to ${meta.payload.status.replace(/_/g, " ").toLowerCase()}`;
                } else if (meta?.status?.to) {
                    message = `updated status to ${meta.status.to.replace(/_/g, " ").toLowerCase()}`;
                } else {
                    message = "updated a subtask";
                }
            }
            if (log.action === "COMMENT_CREATED") message = "added a comment";
            if (log.action === "CHECKED_IN") message = "checked in for work";
            if (log.action === "CHECKED_OUT") message = "checked out for the day";

            const isActor = log.userId === user.id;
            let actorName = isActor ? "You" : (log.user?.surname || log.user?.name || "Someone");

            if (log.action === "MEMBER_INVITED" || log.action === "MEMBER_REMOVED") {
                actorName = "";
            }

            if (log.action === "MEMBER_INVITED" && log.entityId) {
                let targetName = 
                    meta?.newData?.surname || 
                    meta?.payload?.surname || 
                    meta?.newData?.name || 
                    meta?.payload?.name;

                if (!targetName) {
                    const enriched = await getInvitedMetadataForEntity(log.entityId, workspaceId);
                    if (enriched) {
                        meta = {
                            ...(meta || {}),
                            newData: {
                                name: enriched.name,
                                surname: enriched.surname,
                            },
                            payload: {
                                name: enriched.name,
                                surname: enriched.surname,
                            }
                        };
                        targetName = enriched.surname || enriched.name;
                    }
                }

                if (targetName) {
                    message = `${targetName} was invited to the workspace`;
                } else {
                    message = "System invited a new member";
                }
            }

            if (log.action === "MEMBER_REMOVED" && log.entityId) {
                let targetName = 
                    meta?.newData?.surname || 
                    meta?.payload?.surname || 
                    meta?.newData?.name || 
                    meta?.payload?.name ||
                    meta?.oldData?.surname ||
                    meta?.oldData?.name;

                if (!targetName) {
                    const enriched = await getInvitedMetadataForEntity(log.entityId, workspaceId);
                    if (enriched) {
                        meta = {
                            ...(meta || {}),
                            newData: {
                                name: enriched.name,
                                surname: enriched.surname,
                            },
                            payload: {
                                name: enriched.name,
                                surname: enriched.surname,
                            }
                        };
                        targetName = enriched.surname || enriched.name;
                    }
                }

                if (targetName) {
                    message = `${targetName} was removed from the workspace`;
                } else {
                    message = "System removed a member";
                }
            }

            return {
                id: log.id,
                text: actorName ? `${actorName} ${message}` : message,
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                metadata: meta,
                createdAt: log.createdAt,
                user: log.user,
                isPersonal: isActor
            };
        }));

        return c.json({
            success: true,
            activities: formatted,
            role: member?.workspaceRole
        });
    } catch (error: any) {
        console.error("[Activities API Error]:", error);
        return c.json({ success: false, error: "Failed to fetch activities" }, 500);
    }
});

export default activities;
