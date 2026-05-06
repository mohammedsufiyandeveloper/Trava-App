import { Hono } from "hono";
import { HonoVariables } from "../types";
import prisma from "@/lib/db";

const activities = new Hono<{ Variables: HonoVariables }>();

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
            } else if (!isAdmin) {
                // If no tasks in project and not admin, return empty
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
        const formatted = logs.map(log => {
            let message = log.action.replace(/_/g, " ").toLowerCase();
            const meta = log.metadata as any;
            
            if (log.action === "MEMBER_INVITED") message = "invited a new member";
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
            const actorName = isActor ? "You" : (log.user?.surname || log.user?.name || "Someone");

            return {
                id: log.id,
                text: `${actorName} ${message}`,
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId,
                createdAt: log.createdAt,
                user: log.user,
                isPersonal: isActor
            };
        });

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
