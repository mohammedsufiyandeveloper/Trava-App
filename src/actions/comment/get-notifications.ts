"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
export async function getNotificationsAction(workspaceId: string, limit: number = 25, offset: number = 0) {
    try {
        const user = await requireUser();
        const perms = await getWorkspacePermissions(workspaceId, user.id);

        if (!perms.workspaceMemberId) {
            return { success: false, error: "Access denied" };
        }

        const isAuthorized = perms.isWorkspaceAdmin || perms.workspaceMember;

        if (!isAuthorized) {
            return { success: false, error: "Access denied" };
        }

        const where: any = {
            task: {
                workspaceId: workspaceId
            }
        };

        if (!perms.isWorkspaceAdmin) {
            const privilegedProjectIds = [
                ...(perms.leadProjectIds || []),
                ...(perms.managedProjectIds || [])
            ];

            where.task = {
                ...where.task,
                OR: [
                    { assigneeId: user.id },
                    { createdById: user.id },
                    { reviewerId: user.id },
                    ...(privilegedProjectIds.length > 0
                        ? [{ projectId: { in: privilegedProjectIds } }]
                        : [])
                ]
            };
        }

        where.userId = {
            not: user.id
        };
        // 1. Fetch general comments
        const comments = await prisma.comment.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        surname: true,
                        image: true,
                    }
                },
                readBy: {
                    where: {
                        userId: user.id
                    }
                },
                task: {
                    select: {
                        id: true,
                        name: true,
                        taskSlug: true,
                        project: {
                            select: {
                                name: true,
                                color: true,
                            }
                        },
                        parentTask: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: limit
        });

        // 2. Fetch activities (Note: Activity table doesn't have readBy, so we treat recent ones as new)
        // We'll treat activities created in last 24h as "New" if not by current user
        // In a future update, we should add a separate read-tracking table for Activities
        const activities = await prisma.activity.findMany({
            where: {
                workspaceId: workspaceId,
                authorId: { not: user.id },
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
            },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true,
                    }
                },
                Task: {
                    select: {
                        id: true,
                        name: true,
                        taskSlug: true,
                        project: {
                            select: {
                                name: true,
                            }
                        },
                        parentTask: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 10
        });

        // Group comments by task
        const groupedMap = new Map();

        // Process general comments
        comments.forEach((comment: any) => {
            const isRead = comment.readBy.length > 0;

            if (!groupedMap.has(comment.taskId)) {
                groupedMap.set(comment.taskId, {
                    taskId: comment.taskId,
                    taskName: comment.task.name,
                    taskSlug: comment.task.taskSlug,
                    projectName: comment.task.project.name,
                    parentTaskName: comment.task.parentTask?.name || null,
                    latestComment: {
                        content: comment.content,
                        createdAt: comment.createdAt,
                        user: {
                            name: `${comment.user.name ?? ''} ${comment.user.surname ?? ''}`.trim(),
                            image: (comment.user as any).image
                        }
                    },
                    count: 0,
                    isNew: false
                });
            }

            const group = groupedMap.get(comment.taskId);
            group.count++;
            if (!isRead) group.isNew = true;
        });

        // Process activities (Merge into existing groups or create new)
        activities.forEach((rc: any) => {
            if (!groupedMap.has(rc.subTaskId)) {
                groupedMap.set(rc.subTaskId, {
                    taskId: rc.subTaskId,
                    taskName: rc.Task.name,
                    taskSlug: rc.Task.taskSlug,
                    projectName: rc.Task.project.name,
                    parentTaskName: rc.Task.parentTask?.name || null,
                    latestComment: {
                        content: rc.text,
                        createdAt: rc.createdAt,
                        user: {
                            name: rc.user.name,
                            image: (rc.user as any).image
                        }
                    },
                    count: 0,
                    isNew: true // Recent activities are treated as new
                });
            }

            const group = groupedMap.get(rc.subTaskId);
            group.count++;
            
            // If this activity is newer than what we have, update latest
            if (new Date(rc.createdAt) > new Date(group.latestComment.createdAt)) {
                group.latestComment = {
                    content: rc.text,
                    createdAt: rc.createdAt,
                    user: {
                        name: rc.user.name,
                        image: (rc.user as any).image
                    }
                };
            }
        });

        const allNotifications = Array.from(groupedMap.values())
            .sort((a, b) => new Date(b.latestComment.createdAt).getTime() - new Date(a.latestComment.createdAt).getTime());

        // Split into two sections
        const unreadNotifications = allNotifications.filter((n: any) => n.isNew);
        const readNotifications = allNotifications.filter((n: any) => !n.isNew);

        // Count for the badge (only unread)
        const unreadCommenters = await prisma.comment.groupBy({
            by: ['userId'],
            where: {
                ...where,
                readBy: {
                    none: { userId: user.id }
                }
            },
            _count: {
                userId: true
            }
        });

        // Add activity authors to the count (approximate based on recipients)
        const unreadActivityCount = activities.length > 0 ? 1 : 0;

        return {
            success: true,
            unreadNotifications,
            readNotifications,
            peopleCount: unreadCommenters.length + unreadActivityCount,
            totalCount: allNotifications.length,
            hasMore: comments.length === limit
        };

    } catch (error) {
        console.error("Error fetching notifications:", error);
        return { success: false, error: "Failed to fetch notifications" };
    }
}

/**
 * Marks all comments for a specific task as read for the current user.
 */
export async function markTaskCommentsReadAction(taskId: string) {
    try {
        const user = await requireUser();

        // Find all unread comments for this task (not written by the user)
        const unreadComments = await prisma.comment.findMany({
            where: {
                taskId,
                userId: { not: user.id },
                readBy: {
                    none: { userId: user.id }
                }
            },
            select: { id: true }
        });

        if (unreadComments.length === 0) return { success: true };

        // Create read receipts
        await prisma.commentRead.createMany({
            data: unreadComments.map((c: any) => ({
                userId: user.id,
                commentId: c.id
            })),
            skipDuplicates: true
        });

        return { success: true };
    } catch (error) {
        console.error("Error marking comments as read:", error);
        return { success: false, error: "Failed to mark as read" };
    }
}
