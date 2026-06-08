"use server";

const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
const unstable_cache = <T extends (...args: any[]) => any>(fn: T, _keys?: string[], _opts?: any) => fn; // next/cache no-op
const notFound = (..._args: any[]): never => { throw new Error('notFound not available in API server'); }; // next/navigation no-op
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { CacheTags } from "@/data/cache-tags";

// ============================================
// INTERNAL FUNCTIONS (Actual DB queries)
// ============================================

/**
 * Internal function to fetch a single task by ID with full details
 * Includes role-based access control
 */
async function _getTaskByIdInternal(
    taskId: string,
    workspaceId: string,
    projectId: string,
    userId: string,
    workspaceMemberId: string,
    isMember: boolean
) {
    const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
            id: true,
            name: true,
            taskSlug: true,
            description: true,
            status: true,
            startDate: true,
            dueDate: true,
            days: true,
            Tag: {
                select: {
                    id: true,
                    name: true,
                },
            },
            projectId: true,
            parentTaskId: true,
            reviewerId: true,
            reviewer: {
                select: {
                    id: true,
                    WorkspaceMember: { select: { userId: true, user: { select: { id: true, name: true, surname: true } } } }
                },
            },
            createdAt: true,
            updatedAt: true,
            createdBy: {
                select: {
                    id: true,
                    WorkspaceMember: { select: { userId: true, user: { select: { id: true, name: true, surname: true } } } }
                },
            },
            ProjectMember_Task_assigneeIdToProjectMember: {
                select: {
                    id: true,
                    WorkspaceMember: { select: { userId: true, user: { select: { id: true, name: true, surname: true } } } }
                },
            },
            project: {
                select: {
                    id: true,
                    name: true,
                    color: true,
                },
            },
            parentTask: {
                select: {
                    id: true,
                    name: true,
                },
            },
            subTasks: isMember
                ? {
                    where: {
                        ProjectMember_Task_assigneeIdToProjectMember: {
                            WorkspaceMember: {
                                userId: userId,
                            }
                        },
                    },
                    select: {
                        id: true,
                        name: true,
                        taskSlug: true,
                        description: true,
                        status: true,
                        startDate: true,
                        days: true,
                        Tag: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        ProjectMember_Task_assigneeIdToProjectMember: {
                            select: {
                                id: true,
                                WorkspaceMember: { select: { userId: true, user: { select: { surname: true } } } }
                            },
                        },
                        _count: {
                            select: {
                                Activity: true,
                            },
                        },
                    },
                }
                : {
                    select: {
                        id: true,
                        name: true,
                        taskSlug: true,
                        description: true,
                        status: true,
                        startDate: true,
                        days: true,
                        Tag: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        ProjectMember_Task_assigneeIdToProjectMember: {
                            select: {
                                id: true,
                                WorkspaceMember: { select: { userId: true, user: { select: { surname: true } } } }
                            },
                        },
                        _count: {
                            select: {
                                Activity: true,
                            },
                        },
                    },
                },
            _count: {
                select: {
                    subTasks: isMember
                        ? {
                            where: {
                                ProjectMember_Task_assigneeIdToProjectMember: {
                                    WorkspaceMember: {
                                        userId: userId,
                                    }
                                },
                            },
                        }
                        : true,
                    Activity: true,
                },
            },
        },
    });

    // If task not found, return null
    if (!task) {
        return null;
    }

    // Check access permissions for members
    if (isMember) {
        // If it's a subtask, check if user is assigned
        if (task.parentTaskId) {
            const isAssigned = (task as any).ProjectMember_Task_assigneeIdToProjectMember?.WorkspaceMember?.userId === userId;
            if (!isAssigned) {
                return null; // Member doesn't have access to this subtask
            }
        } else {
            // If it's a parent task, check if user has any assigned subtasks
            const hasAssignedSubtasks = task.subTasks && task.subTasks.length > 0;
            if (!hasAssignedSubtasks) {
                return null; // Member doesn't have access to this parent task
            }
        }
    }

    // Map for UI compatibility
    const mappedTask = {
        ...task,
        assignee: (task as any).ProjectMember_Task_assigneeIdToProjectMember,
    };

    return mappedTask as typeof task & { assignee: any };
}

// ============================================
// CACHED VERSION (Next.js unstable_cache)
// ============================================

/**
 * Cached version of getTaskById with role-based filtering
 */
const getCachedTaskById = (
    taskId: string,
    workspaceId: string,
    projectId: string,
    userId: string,
    workspaceMemberId: string,
    isMember: boolean
) =>
    unstable_cache(
        async () => _getTaskByIdInternal(taskId, workspaceId, projectId, userId, workspaceMemberId, isMember),
        [`task-${taskId}-user-member-${workspaceMemberId}`],
        {
            tags: CacheTags.taskDetails(taskId, projectId),
            revalidate: 60, // 1 minute
        }
    )();

// ============================================
// PUBLIC API (React cache for request deduplication)
// ============================================

/**
 * Get a single task by ID with full details and role-based access control
 * 
 * Access Rules:
 * - ADMINs and LEADs: Can access any task in the project
 * - MEMBERs: Can only access:
 *   - Subtasks assigned to them
 *   - Parent tasks that have at least one subtask assigned to them
 * 
 * @param taskId - The task ID
 * @param workspaceId - The workspace ID
 * @param projectId - The project ID
 * @returns Task object or calls notFound() if not found/no access
 * 
 * @example
 * const task = await getTaskById(taskId, workspaceId, projectId);
 */
export const getTaskById = cache(
    async (taskId: string, workspaceId: string, projectId: string) => {
        const user = await requireUser();

        try {
            // Get user's permissions using the centralized function
            const permissions = await getUserPermissions(workspaceId, projectId);

            if (!permissions.workspaceMemberId) {
                return notFound();
            }

            const task = await getCachedTaskById(
                taskId,
                workspaceId,
                projectId,
                user.id,
                permissions.workspaceMemberId,
                permissions.isMember
            );

            if (!task) {
                return notFound();
            }

            return task;
        } catch (error) {
            console.error("Error fetching task by ID:", error);
            return notFound();
        }
    }
);

// ============================================
// TYPE EXPORTS
// ============================================

export type TaskByIdType = Awaited<ReturnType<typeof getTaskById>>;
