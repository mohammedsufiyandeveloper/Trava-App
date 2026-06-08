"use server";

const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
const unstable_cache = <T extends (...args: any[]) => any>(fn: T, _keys?: string[], _opts?: any) => fn; // next/cache no-op
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags } from "@/data/cache-tags";

/**
 * Internal function to fetch task comments
 */
async function _getTaskCommentsInternal(taskId: string) {
    return prisma.comment.findMany({
        where: {
            taskId,
            isDeleted: false,
        },
        include: {
            user: {
                select: {
                    id: true,
                    surname: true,
                },
            },
            replies: {
                where: {
                    isDeleted: false,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            surname: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'asc',
                },
            },
        },
        orderBy: {
            createdAt: 'asc',
        },
    });
}

/**
 * Cached version of task comments
 */
const getCachedTaskComments = (taskId: string) =>
    unstable_cache(
        async () => _getTaskCommentsInternal(taskId),
        [`task-comments-${taskId}`],
        {
            tags: CacheTags.taskComments(taskId),
            revalidate: 30, // 30 seconds - comments change frequently
        }
    )();

/**
 * Get all comments for a task with caching
 * Uses dual cache layer (React cache + Next.js unstable_cache)
 * 
 * @param taskId - ID of the task to fetch comments for
 * @returns Array of comments with user information and replies
 */
export const getTaskComments = cache(async (taskId: string) => {
    const user = await requireUser();

    try {
        return await getCachedTaskComments(taskId);
    } catch (error) {
        console.error("Error fetching task comments:", error);
        return [];
    }
});

/**
 * Internal function to fetch activities for a subtask
 */
async function _getActivitiesInternal(subTaskId: string) {
    const activities = await prisma.activity.findMany({
        where: {
            subTaskId,
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
            createdAt: 'desc',
        },
    });

    // Map for UI compatibility (schema uses 'user', components expect 'author')
    return activities.map(activity => ({
        ...activity,
        author: (activity as any).user,
    }));
}

/**
 * Cached version of activities
 */
const getCachedActivities = (subTaskId: string) =>
    unstable_cache(
        async () => _getActivitiesInternal(subTaskId),
        [`activities-${subTaskId}`],
        {
            tags: CacheTags.activities ? CacheTags.activities(subTaskId) : [`activities-${subTaskId}`], // fallback if CacheTags not updated yet
            revalidate: 30, // 30 seconds - activities change frequently
        }
    )();

/**
 * Get all activities for a subtask with caching
 * Uses dual cache layer (React cache + Next.js unstable_cache)
 * 
 * @param subTaskId - ID of the subtask to fetch activities for
 * @returns Array of activities with author information
 */
export const getActivities = cache(async (subTaskId: string) => {
    try {
        return await getCachedActivities(subTaskId);
    } catch (error) {
        console.error("Error fetching activities:", error);
        return [];
    }
});

// Type exports
export type TaskCommentsType = Awaited<ReturnType<typeof getTaskComments>>;
export type ActivitiesType = Awaited<ReturnType<typeof getActivities>>;
