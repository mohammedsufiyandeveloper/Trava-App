import prisma from "@/lib/db";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { getSubTasksByParentIds } from "./get-subtasks-batch";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export function normalizeDetailPageSize(value: number | undefined, fallback = DEFAULT_PAGE_SIZE) {
    if (!Number.isFinite(value) || !value || value < 1) return fallback;
    return Math.min(Math.trunc(value), MAX_PAGE_SIZE);
}

async function getAccessibleTask(taskId: string, userId: string) {
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
            ProjectMember_Task_assigneeIdToProjectMember: {
                include: {
                    WorkspaceMember: {
                        include: {
                            user: {
                                select: { id: true, name: true, surname: true, image: true },
                            },
                        },
                    },
                },
            },
            Tag: true,
            project: {
                select: { id: true, name: true, workspaceId: true, color: true },
            },
            parentTask: { select: { id: true, name: true } },
            _count: { select: { subTasks: true } },
        },
    });

    if (!task) return { status: "not_found" as const, task: null };

    const permissions = await getUserPermissions(
        task.project.workspaceId,
        task.project.id,
        userId
    );

    if (!permissions.WorkspaceMemberId) {
        return { status: "forbidden" as const, task: null };
    }

    const assigneeUser =
        task.ProjectMember_Task_assigneeIdToProjectMember?.WorkspaceMember?.user;
    const mappedTask = {
        ...task,
        assignee: assigneeUser
            ? {
                id: assigneeUser.id,
                name: `${assigneeUser.name || ""} ${assigneeUser.surname || ""}`.trim(),
                image: assigneeUser.image,
            }
            : null,
        subtaskCount: task._count.subTasks,
        _count: undefined,
        ProjectMember_Task_assigneeIdToProjectMember: undefined,
    };

    return {
        status: "ok" as const,
        task: mappedTask,
        permissions,
    };
}

export async function getTaskCommentsPage(
    taskId: string,
    userId: string,
    options: { limit?: number; cursor?: string } = {}
) {
    const access = await getAccessibleTask(taskId, userId);
    if (access.status !== "ok") return access;

    const limit = normalizeDetailPageSize(options.limit);
    const comments = await prisma.comment.findMany({
        where: { taskId, isDeleted: false },
        select: {
            id: true,
            content: true,
            createdAt: true,
            userId: true,
            user: {
                select: { id: true, name: true, surname: true, image: true },
            },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });

    const hasMore = comments.length > limit;
    const page = comments.slice(0, limit);
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return {
        status: "ok" as const,
        comments: page.reverse().map((comment) => ({
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt,
            userId: comment.userId,
            user: comment.user
                ? {
                    id: comment.user.id,
                    name: `${comment.user.name || ""} ${comment.user.surname || ""}`.trim(),
                    surname: comment.user.surname,
                    image: comment.user.image ?? null,
                }
                : null,
        })),
        hasMore,
        nextCursor,
    };
}

export async function getTaskActivitiesPage(
    taskId: string,
    userId: string,
    options: { limit?: number; cursor?: string } = {}
) {
    const access = await getAccessibleTask(taskId, userId);
    if (access.status !== "ok") return access;

    const limit = normalizeDetailPageSize(options.limit);
    const activities = await prisma.activity.findMany({
        where: { subTaskId: taskId },
        select: {
            id: true,
            text: true,
            attachment: true,
            createdAt: true,
            user: {
                select: { id: true, name: true, surname: true, image: true },
            },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });

    const hasMore = activities.length > limit;
    const page = activities.slice(0, limit);

    return {
        status: "ok" as const,
        activities: page.map((activity) => ({
            id: activity.id,
            text: activity.text,
            attachment: activity.attachment,
            createdAt: activity.createdAt,
            author: activity.user,
        })),
        hasMore,
        nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
}

export async function getTaskDetail(
    taskId: string,
    userId: string,
    options: {
        subtaskLimit?: number;
        commentLimit?: number;
        activityLimit?: number;
    } = {}
) {
    const access = await getAccessibleTask(taskId, userId);
    if (access.status !== "ok") return access;

    const subtaskLimit = normalizeDetailPageSize(options.subtaskLimit, 30);
    const commentLimit = normalizeDetailPageSize(options.commentLimit);
    const activityLimit = normalizeDetailPageSize(options.activityLimit);

    const [subtaskResults, comments, activities] = await Promise.all([
        getSubTasksByParentIds(
            [taskId],
            access.task.project.workspaceId,
            access.task.project.id,
            {},
            subtaskLimit,
            "subtask",
            userId,
            true
        ),
        prisma.comment.findMany({
            where: { taskId, isDeleted: false },
            select: {
                id: true,
                content: true,
                createdAt: true,
                userId: true,
                user: {
                    select: { id: true, name: true, surname: true, image: true },
                },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: commentLimit + 1,
        }),
        prisma.activity.findMany({
            where: { subTaskId: taskId },
            select: {
                id: true,
                text: true,
                attachment: true,
                createdAt: true,
                user: {
                    select: { id: true, name: true, surname: true, image: true },
                },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: activityLimit + 1,
        }),
    ]);

    const subtaskPage = subtaskResults[0];
    const commentHasMore = comments.length > commentLimit;
    const commentPage = comments.slice(0, commentLimit);
    const activityHasMore = activities.length > activityLimit;
    const activityPage = activities.slice(0, activityLimit);

    return {
        status: "ok" as const,
        task: access.task,
        subTasks: subtaskPage?.subTasks ?? [],
        subTasksPage: {
            totalCount: subtaskPage?.totalCount ?? 0,
            hasMore: subtaskPage?.hasMore ?? false,
            nextCursor: subtaskPage?.nextCursor ?? null,
        },
        comments: commentPage.reverse().map((comment) => ({
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt,
            userId: comment.userId,
            user: comment.user
                ? {
                    id: comment.user.id,
                    name: `${comment.user.name || ""} ${comment.user.surname || ""}`.trim(),
                    surname: comment.user.surname,
                    image: comment.user.image ?? null,
                }
                : null,
        })),
        commentsPage: {
            hasMore: commentHasMore,
            nextCursor: commentHasMore
                ? commentPage[commentPage.length - 1]?.id ?? null
                : null,
        },
        activities: activityPage.map((activity) => ({
            id: activity.id,
            text: activity.text,
            attachment: activity.attachment,
            createdAt: activity.createdAt,
            author: activity.user,
        })),
        activitiesPage: {
            hasMore: activityHasMore,
            nextCursor: activityHasMore
                ? activityPage[activityPage.length - 1]?.id ?? null
                : null,
        },
    };
}
