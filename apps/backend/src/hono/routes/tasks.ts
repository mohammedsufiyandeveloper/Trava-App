import { Hono } from "hono";
import { HonoVariables } from "../types";
import { AppError } from "@/lib/errors/app-error";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { TasksService } from "@/server/services/tasks.service";
import prisma from "@/lib/db";
import { recordActivity } from "@/lib/audit";
import { getTaskInvolvedUserIds } from "@/lib/involved-users";
import crypto from "crypto";
import { getTasks, GetTasksOptions, resolveTaskPermissions } from "@/data/task/get-tasks";
import { editTask } from "@/actions/task/update-task";
import { getSubTasksByParentIds } from "@/data/task/get-subtasks-batch";
import { invalidateTaskMutation } from "@/lib/cache/invalidation";
import { buildWorkspaceFilterWhere } from "@/lib/tasks/query-builder";

const tasks = new Hono<{ Variables: HonoVariables }>();

// GET /api/tasks
tasks.get("/", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) {
        return c.json({ error: "Missing workspaceId" }, 400);
    }

    const projectId = c.req.query("projectId") || undefined;
    const status = c.req.queries("status") || [];
    const assigneeId = c.req.queries("assigneeId") || [];
    const tagId = c.req.queries("tagId") || [];
    const search = c.req.query("search") || undefined;
    const dueAfter = c.req.query("dueAfter") || undefined;
    const dueBefore = c.req.query("dueBefore") || undefined;
    const sortsParam = c.req.queries("sorts") || [];

    const hierarchyMode = (c.req.query("hierarchyMode") as "parents" | "children" | "all") || "parents";
    const excludeParents = c.req.query("excludeParents") === "true";
    const onlySubtasks = c.req.query("onlySubtasks") === "true";
    const includeSubTasksParam = c.req.query("includeSubTasks") === "true";
    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : 500;

    const cursorId = c.req.query("cursorId") || undefined;
    const cursorCreatedAt = c.req.query("cursorCreatedAt") || undefined;

    const cursor = cursorId ? {
        id: cursorId,
        createdAt: cursorCreatedAt ? new Date(cursorCreatedAt) : new Date()
    } : undefined;

    const sorts = sortsParam.map(s => {
        const [field, direction] = s.split(":");
        return { field, direction: (direction || "desc") as "asc" | "desc" };
    });

    const opts: GetTasksOptions = {
        workspaceId,
        projectId,
        status: status.length > 0 ? status : undefined,
        assigneeId: assigneeId.length > 0 ? assigneeId : undefined,
        tagId: tagId.length > 0 ? tagId : undefined,
        search,
        dueAfter,
        dueBefore,
        sorts: sorts.length > 0 ? sorts : undefined,
        limit,
        includeSubTasks: includeSubTasksParam || hierarchyMode === "all",
        hierarchyMode,
        excludeParents,
        onlySubtasks,
        cursor,
    };

    try {
        const result = await getTasks(opts, user.id);
        return c.json({
            success: true,
            tasks: result.tasks,
            totalCount: result.totalCount,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
        });
    } catch (error: any) {
        console.error("Hono API Error [Tasks GET]:", error);
        return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
    }
});

// GET /api/tasks/count
tasks.get("/count", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) {
        return c.json({ error: "Missing workspaceId" }, 400);
    }

    const projectId = c.req.query("projectId") || undefined;
    const status = c.req.queries("status") || [];
    const assigneeId = c.req.queries("assigneeId") || [];
    const tagId = c.req.queries("tagId") || [];
    const search = c.req.query("search") || undefined;
    const dueAfter = c.req.query("dueAfter") || undefined;
    const dueBefore = c.req.query("dueBefore") || undefined;
    const excludeParents = c.req.query("excludeParents") === "true";
    const onlySubtasks = c.req.query("onlySubtasks") === "true";

    try {
        const {
            isWorkspaceAdmin,
            fullAccessProjectIds,
            restrictedProjectIds
        } = await resolveTaskPermissions(workspaceId, projectId, user.id);

        const toUTCDateOnly = (val: any) => {
            if (!val) return undefined;
            const d = new Date(val);
            d.setUTCHours(0, 0, 0, 0);
            return d;
        };

        const addOneDayUTC = (d: Date) => {
            const next = new Date(d);
            next.setUTCDate(next.getUTCDate() + 1);
            return next;
        };

        const where = buildWorkspaceFilterWhere({
            workspaceId,
            projectId,
            assigneeId: assigneeId.length > 0 ? assigneeId : undefined,
            status: status.length > 0 ? status : undefined,
            tagId: tagId.length > 0 ? tagId : undefined,
            dueAfter: toUTCDateOnly(dueAfter),
            dueBefore: dueBefore ? addOneDayUTC(toUTCDateOnly(dueBefore)!) : undefined,
            search,
            isAdmin: isWorkspaceAdmin,
            fullAccessProjectIds,
            restrictedProjectIds,
            onlyParents: !onlySubtasks && !excludeParents,
            excludeParents,
            onlySubtasks,
        }, user.id);

        const totalCount = await prisma.task.count({ where });

        return c.json({
            success: true,
            totalCount
        });
    } catch (error: any) {
        console.error("Hono API Error [Tasks COUNT]:", error);
        return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
    }
});

// POST /api/tasks
tasks.post("/", async (c) => {
    const user = c.get("user");
    try {
        const body = await c.req.json();
        const {
            name,
            projectId,
            description,
            assigneeUserId,
            reviewerId,
            tagId,
            status,
            startDate,
            dueDate,
            days
        } = body;

        if (!name || !projectId) {
            return c.json({ error: "Missing name or projectId" }, 400);
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { workspaceId: true }
        });

        if (!project) {
            return c.json({ error: "Project not found" }, 404);
        }

        const permissions = await getUserPermissions(project.workspaceId, projectId, user.id);

        const result = await TasksService.createTask({
            name,
            projectId,
            workspaceId: project.workspaceId,
            userId: user.id,
            permissions,
            description,
            assigneeUserId,
            reviewerId,
            tagId,
            status,
            startDate,
            dueDate,
            days
        });

        return c.json({
            success: true,
            task: result
        });
    } catch (error: any) {
        console.error("Hono API Error [Tasks POST]:", error);
        return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
    }
});

// PATCH /api/tasks
tasks.patch("/", async (c) => {
    const user = c.get("user");
    const taskId = c.req.query("taskId");

    if (!taskId) {
        return c.json({ error: "Missing taskId" }, 400);
    }

    try {
        const body = await c.req.json();

        const existingTask = await prisma.task.findUnique({
            where: { id: taskId },
            select: { 
                name: true, 
                taskSlug: true, 
                projectId: true, 
                reviewerId: true,
                status: true,
                project: {
                    select: {
                        workspaceId: true
                    }
                }
            }
        });

        if (!existingTask) {
            return c.json({ error: "Task not found" }, 404);
        }

        const updateData = {
            name: body.name || existingTask.name,
            taskSlug: body.taskSlug || existingTask.taskSlug,
            projectId: existingTask.projectId,
            reviewerId: body.reviewerId !== undefined ? body.reviewerId : existingTask.reviewerId,
            assigneeUserId: body.assigneeUserId !== undefined ? body.assigneeUserId : undefined,
            tagId: body.tagId !== undefined ? body.tagId : undefined,
            startDate: body.startDate !== undefined ? body.startDate : undefined,
            dueDate: body.dueDate !== undefined ? body.dueDate : undefined,
            status: body.status !== undefined ? body.status : undefined,
            description: body.description !== undefined ? body.description : undefined,
            days: body.days !== undefined ? body.days : undefined,
        };

        const result = await editTask(updateData, taskId);

        if (result.status === "error") {
            return c.json({ error: result.message }, 400);
        }

        if (body.status) {
            await prisma.$transaction(async (tx) => {
                await tx.task.update({
                    where: { id: taskId },
                    data: { status: body.status }
                });

                if ((body.comment && body.comment.trim()) || body.attachmentData) {
                    await tx.activity.create({
                        data: {
                            id: crypto.randomUUID(),
                            subTaskId: taskId,
                            authorId: user.id,
                            workspaceId: existingTask.project.workspaceId,
                            text: (body.comment || "").trim(),
                            attachment: body.attachmentData || null,
                            updatedAt: new Date(),
                        }
                    });
                }
            });
        } else if ((body.comment && body.comment.trim()) || body.attachmentData) {
            await prisma.activity.create({
                data: {
                    id: crypto.randomUUID(),
                    subTaskId: taskId,
                    authorId: user.id,
                    workspaceId: existingTask.project.workspaceId,
                    text: (body.comment || "").trim(),
                    attachment: body.attachmentData || null,
                    updatedAt: new Date(),
                }
            });
        }

        return c.json({
            success: true,
            message: result.message
        });
    } catch (error: any) {
        console.error("Hono API Error [Tasks PATCH]:", error);
        return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
    }
});

// DELETE /api/tasks
tasks.delete("/", async (c) => {
    const user = c.get("user");
    const taskId = c.req.query("taskId");
    if (!taskId) {
        return c.json({ error: "Missing taskId" }, 400);
    }

    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { project: { select: { id: true, workspaceId: true } } }
        });

        if (!task) {
            return c.json({ error: "Task not found" }, 404);
        }

        const permissions = await getUserPermissions(
            task.project.workspaceId,
            task.project.id,
            user.id
        );

        await TasksService.deleteTask({
            taskId,
            workspaceId: task.project.workspaceId,
            projectId: task.project.id,
            userId: user.id,
            permissions
        });

        await invalidateTaskMutation({
            projectId: task.project.id,
            workspaceId: task.project.workspaceId,
            userId: user.id,
            taskId,
            parentTaskId: task.parentTaskId || undefined
        });

        return c.json({ success: true, message: "Task deleted successfully" });
    } catch (error: any) {
        console.error("Hono API Error [Tasks DELETE]:", error);
        return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
    }
});

// GET /api/tasks/:taskId
tasks.get("/:taskId", async (c) => {
    const taskId = c.req.param("taskId");
    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                ProjectMember_Task_assigneeIdToProjectMember: {
                    include: { WorkspaceMember: { include: { user: true } } }
                },
                Tag: true,
                project: { select: { id: true, name: true, workspaceId: true, color: true } },
                parentTask: { select: { id: true, name: true } },
                subTasks: { select: { id: true } },
            }
        });

        if (!task) {
            return c.json({ error: "Task not found" }, 404);
        }

        const assigneeUser = (task as any).ProjectMember_Task_assigneeIdToProjectMember?.WorkspaceMember?.user;
        const mapped = {
            ...task,
            assignee: assigneeUser
                ? { id: assigneeUser.id, name: `${assigneeUser.name || ""}`.trim(), image: assigneeUser.image }
                : null,
            subtaskCount: task.subTasks.length,
            subTasks: undefined,
            ProjectMember_Task_assigneeIdToProjectMember: undefined,
        };

        return c.json({ success: true, task: mapped });
    } catch (error: any) {
        console.error("Hono API Error [Task GET by ID]:", error);
        return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
    }
});

// GET /api/tasks/:taskId/subtasks
tasks.get("/:taskId/subtasks", async (c) => {
    const taskId = c.req.param("taskId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
        return c.json({ error: "Missing workspaceId" }, 400);
    }

    const user = c.get("user");
    const projectId = c.req.query("projectId") || undefined;
    const viewMode = c.req.query("viewMode") || "list";
    const pageSize = parseInt(c.req.query("pageSize") || "30", 10);

    const filters: any = {};
    const statusStr = c.req.query("status");
    if (statusStr) {
        try {
            filters.status = JSON.parse(statusStr);
        } catch {
            filters.status = statusStr.split(',');
        }
    }

    const assigneeStr = c.req.query("assigneeId");
    if (assigneeStr) {
        try {
            filters.assigneeId = JSON.parse(assigneeStr);
        } catch {
            filters.assigneeId = assigneeStr.split(',');
        }
    }

    const tagStr = c.req.query("tagId");
    if (tagStr) {
        try {
            filters.tagId = JSON.parse(tagStr);
        } catch {
            filters.tagId = tagStr.split(',');
        }
    }

    const search = c.req.query("search");
    if (search) filters.search = search;

    const dueAfter = c.req.query("dueAfter");
    if (dueAfter && dueAfter !== "undefined" && dueAfter !== "null") filters.dueAfter = new Date(dueAfter);

    const dueBefore = c.req.query("dueBefore");
    if (dueBefore && dueBefore !== "undefined" && dueBefore !== "null") filters.dueBefore = new Date(dueBefore);

    try {
        const results = await getSubTasksByParentIds(
            [taskId],
            workspaceId,
            projectId,
            filters,
            pageSize,
            viewMode,
            user.id,
            true
        );

        const responsePayload = (results && results.length > 0) ? {
            success: true,
            subTasks: results[0].subTasks,
            totalCount: results[0].totalCount,
            hasMore: results[0].hasMore,
            nextCursor: results[0].nextCursor
        } : {
            success: true,
            subTasks: [],
            totalCount: 0,
            hasMore: false,
            nextCursor: null
        };

        return c.json(responsePayload);
    } catch (error: any) {
        console.error("Hono API Error [Subtasks GET]:", error);
        return c.json({ success: false, error: "Internal Error" }, 500);
    }
});

// POST /api/tasks/:taskId/subtasks
tasks.post("/:taskId/subtasks", async (c) => {
    const parentTaskId = c.req.param("taskId");
    const user = c.get("user");

    try {
        const body = await c.req.json();
        const { name } = body;

        if (!name) {
            return c.json({ error: "Missing name" }, 400);
        }

        const parentTask = await prisma.task.findUnique({
            where: { id: parentTaskId },
            select: { projectId: true, workspaceId: true, Tag: { select: { id: true } } }
        });

        if (!parentTask) {
            return c.json({ error: "Parent task not found" }, 404);
        }

        const permissions = await getUserPermissions(parentTask.workspaceId, parentTask.projectId, user.id);

        const result = await TasksService.createSubTask({
            name,
            description: body.description,
            projectId: parentTask.projectId,
            workspaceId: parentTask.workspaceId,
            parentTaskId: parentTaskId,
            userId: user.id,
            permissions,
            assigneeUserId: body.assigneeUserId || user.id,
            reviewerId: body.reviewerId || body.reviewerUserId || null,
            tagId: body.tagId || parentTask.Tag?.[0]?.id || null,
            startDate: body.startDate,
            dueDate: body.dueDate,
            days: body.days || 1,
            status: body.status || "TO_DO"
        });

        try {
            await invalidateTaskMutation({
                projectId: parentTask.projectId,
                workspaceId: parentTask.workspaceId,
                userId: user.id,
                taskId: result.id,
                parentTaskId: parentTaskId,
            });
        } catch (cacheError) {
            console.error("Cache Invalidation Error [Subtasks POST]:", cacheError);
        }

        return c.json({
            success: true,
            task: result
        });
    } catch (error: any) {
        console.error("Hono API Error [Subtasks POST]:", error);
        return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
    }
});

// GET /api/tasks/:taskId/comments
tasks.get("/:taskId/comments", async (c) => {
    const taskId = c.req.param("taskId");
    try {
        const comments = await prisma.comment.findMany({
            where: { taskId, isDeleted: false },
            include: {
                user: {
                    select: { id: true, name: true, surname: true, image: true }
                },
            },
            orderBy: { createdAt: "asc" },
        });

        const mapped = comments.map(co => ({
            id: co.id,
            content: co.content,
            createdAt: co.createdAt,
            userId: co.userId,
            user: co.user
                ? {
                    id: co.user.id,
                    name: `${co.user.name || ""} ${co.user.surname || ""}`.trim(),
                    surname: co.user.surname,
                    image: (co.user as any).image ?? null,
                }
                : null,
        }));

        return c.json({ success: true, comments: mapped });
    } catch (error: any) {
        console.error("Hono API Error [Comments GET]:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/tasks/:taskId/comments
tasks.post("/:taskId/comments", async (c) => {
    const taskId = c.req.param("taskId");
    const user = c.get("user");

    try {
        const body = await c.req.json();
        const content = body?.content?.trim();
        if (!content) {
            return c.json({ error: "Content is required" }, 400);
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, workspaceId: true }
        });
        if (!task) {
            return c.json({ error: "Task not found" }, 404);
        }

        const comment = await prisma.comment.create({
            data: {
                content,
                taskId,
                userId: user.id,
            },
            include: {
                user: {
                    select: { id: true, name: true, surname: true }
                }
            }
        });

        try {
            const targetUserIds = await getTaskInvolvedUserIds(taskId);
            await recordActivity({
                userId: user.id,
                userName: comment.user?.surname || comment.user?.name || "Someone",
                workspaceId: task.workspaceId,
                action: "COMMENT_CREATED",
                entityType: "TASK",
                entityId: taskId,
                newData: { content: comment.content },
                broadcastEvent: "team_update",
                targetUserIds,
            });
        } catch (e) {
            console.error("[AUDIT_ERROR] Comment activity failed:", e);
        }

        return c.json({
            success: true,
            comment: {
                id: comment.id,
                content: comment.content,
                createdAt: comment.createdAt,
                userId: comment.userId,
                user: comment.user
                    ? {
                        id: comment.user.id,
                        name: `${comment.user.name || ""} ${comment.user.surname || ""}`.trim(),
                        surname: comment.user.surname,
                    }
                    : null,
            }
        });
    } catch (error: any) {
        console.error("Hono API Error [Comments POST]:", error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// PATCH /api/tasks/:taskId/assignee
tasks.patch("/:taskId/assignee", async (c) => {
    const user = c.get("user");
    const taskId = c.req.param("taskId");

    const body = await c.req.json();
    const { assigneeUserId, explanation } = body as { assigneeUserId: string | null; explanation?: string };

    const subTaskContext = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
            id: true,
            parentTaskId: true,
            project: { select: { id: true, workspaceId: true } },
        }
    });

    if (!subTaskContext) {
        throw AppError.NotFound("Subtask not found");
    }

    const permissions = await getUserPermissions(
        subTaskContext.project.workspaceId,
        subTaskContext.project.id,
        user.id
    );

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
            userName: permissions.workspaceMember?.user?.surname || permissions.workspaceMember?.user?.name || (user as any).surname || (user as any).name || "Someone",
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

// GET /api/tasks/:taskId/activities
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
