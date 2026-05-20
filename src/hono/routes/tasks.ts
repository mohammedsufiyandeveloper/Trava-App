import { Hono } from "hono";
import { HonoVariables } from "../types";
import { AppError } from "@/lib/errors/app-error";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { TasksService } from "@/server/services/tasks.service";
import prisma from "@/lib/db";
import { recordActivity } from "@/lib/audit";
import { getTaskInvolvedUserIds } from "@/lib/involved-users";
import crypto from "crypto";

const tasks = new Hono<{ Variables: HonoVariables }>();

/**
 * PATCH /api/v1/tasks/:taskId/assignee
 * 
 * Surgically updates ONLY the assignee of a subtask.
 * Using a REST API route instead of a Server Action prevents Next.js
 * from triggering an RSC re-render, keeping the response payload tiny.
 * 
 * Body: { assigneeUserId: string | null }
 * Returns: { success: true } (~50 bytes)
 */
tasks.patch("/:taskId/assignee", async (c) => {
    const user = c.get("user");
    const taskId = c.req.param("taskId");

    const body = await c.req.json();
    const { assigneeUserId, explanation } = body as { assigneeUserId: string | null; explanation?: string };

    // 1. Fetch context + permissions in parallel
    const [subTaskContext, _] = await Promise.all([
        prisma.task.findUnique({
            where: { id: taskId },
            select: {
                id: true,
                parentTaskId: true,
                project: { select: { id: true, workspaceId: true } },
            }
        }),
        Promise.resolve() // placeholder for future parallel work
    ]);

    if (!subTaskContext) {
        throw AppError.NotFound("Subtask not found");
    }

    const permissions = await getUserPermissions(
        subTaskContext.project.workspaceId,
        subTaskContext.project.id,
        user.id
    );

    // 2. Update only the assigneeId via the service (handles permission checks)
    await TasksService.updateTask({
        taskId,
        workspaceId: subTaskContext.project.workspaceId,
        projectId: subTaskContext.project.id,
        userId: user.id,
        permissions,
        data: {
            assigneeUserId: assigneeUserId,
        }
    });

    if (explanation && explanation.trim()) {
        const activity = await prisma.activity.create({
            data: {
                id: crypto.randomUUID(),
                subTaskId: taskId,
                authorId: user.id,
                workspaceId: subTaskContext.project.workspaceId,
                text: explanation.trim(),
                updatedAt: new Date(),
            },
            select: { id: true, createdAt: true },
        });

        const targetUserIds = await getTaskInvolvedUserIds(taskId);
        await recordActivity({
            userId: user.id,
            userName: permissions.workspaceMember?.user?.name || permissions.workspaceMember?.user?.surname || (user as any).name || (user as any).surname || "Someone",
            workspaceId: subTaskContext.project.workspaceId,
            action: "COMMENT_CREATED",
            entityType: "SUBTASK",
            entityId: taskId,
            newData: {
                id: activity.id,
                text: explanation.trim(),
                createdAt: activity.createdAt.toISOString()
            },
            broadcastEvent: "team_update",
            targetUserIds,
        });
    }

    return c.json({ success: true });
});

/**
 * GET /api/tasks/:taskId/activities
 * Fetches all activity logs for a specific task or subtask.
 */
tasks.get("/:taskId/activities", async (c) => {
    const taskId = c.req.param("taskId");

    try {
        const activities = await prisma.activity.findMany({
            where: {
                subTaskId: taskId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        image: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // Normalize author fields for client/UI compatibility
        const mapped = activities.map(act => ({
            id: act.id,
            text: act.text,
            attachment: act.attachment,
            createdAt: act.createdAt,
            author: act.user,
        }));

        return c.json({
            success: true,
            activities: mapped,
        });
    } catch (error: any) {
        console.error(`[GET Task Activities Error]:`, error);
        return c.json({ success: false, error: "Failed to fetch activities" }, 500);
    }
});

export default tasks;
