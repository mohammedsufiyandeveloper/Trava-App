"use server";

const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
import prisma from "@/lib/db";
const unstable_cache = (..._args: any[]) => {}; // next/cache no-op
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags } from "@/data/cache-tags";
import { getUserPermissions } from "../user/get-user-permissions";

/**
 * Internal function to fetch procurement tasks using the optimized join table
 */
async function _getProcurementTasksInternal(
    workspaceId: string,
    page: number = 1,
    pageSize: number = 20
) {
    // Determine pagination offset
    const skip = (page - 1) * pageSize;

    // Use transaction to get count and data
    const [totalCount, procurementItems] = await prisma.$transaction([
        prisma.procurementTask.count({
            where: { workspaceId }
        }),
        prisma.procurementTask.findMany({
            where: { workspaceId },
            include: {
                task: {
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
                                WorkspaceMember: { select: { user: { select: { name: true, surname: true, image: true } } } }
                            }
                        },
                        createdBy: {
                            select: {
                                id: true,
                                WorkspaceMember: { select: { user: { select: { name: true, surname: true, image: true } } } }
                            }
                        }
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: pageSize
        })
    ]);

    const hasMore = totalCount > page * pageSize;

    // Transform to flatten the structure slightly if needed, or return as is
    return {
        tasks: procurementItems.map(item => ({
            ...item.task,
            project: item.project,
            procurementEntryId: item.id,
            addedToProcurementAt: item.createdAt
        })),
        totalCount,
        hasMore
    };
}

/**
 * Cached version of procurement tasks
 */
const getCachedProcurementTasks = (
    workspaceId: string,
    userId: string, // Used for cache key uniqueness if we add personalization later
    page: number,
    pageSize: number
) => {
    return unstable_cache(
        async () => _getProcurementTasksInternal(workspaceId, page, pageSize),
        [`procurement-tasks-${workspaceId}-page-${page}-size-${pageSize}`],
        {
            tags: CacheTags.workspaceTasks(workspaceId, userId),
            revalidate: 60,
        }
    )();
};

/**
 * Get Procurement Tasks
 * Public API that handles auth and permissions
 */
export const getProcurementTasks = cache(
    async (
        workspaceId: string,
        page: number = 1,
        pageSize: number = 20
    ) => {
        try {
            const user = await requireUser();

            // Check if user has access to this workspace
            // We use a light check here, or the full permissions check
            const permissions = await getUserPermissions(workspaceId, user.id);

            if (!permissions.WorkspaceMember) {
                return { tasks: [], totalCount: 0, hasMore: false };
            }

            return await getCachedProcurementTasks(
                workspaceId,
                user.id,
                page,
                pageSize
            );
        } catch (error) {
            console.error("Error fetching procurement tasks:", error);
            return { tasks: [], totalCount: 0, hasMore: false };
        }
    }
);
