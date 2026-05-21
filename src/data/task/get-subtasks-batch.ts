"use server";

const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
import prisma from "@/lib/db";
const unstable_cache = (..._args: any[]) => {}; // next/cache no-op
import { CacheTags } from "@/data/cache-tags";
import { TaskFilters } from "@/types/task-filters";
import { buildSubTaskConditions } from "@/lib/tasks/filter-utils";
import { resolveTaskPermissions } from "./get-tasks";
import { getTaskSelect } from "@/lib/tasks/query-builder";
import { mapTaskAssignee } from "@/lib/tasks/mapper";

/**
 * Result structure for batch subtask fetching.
 */
export type BatchSubTasksResult = {
    parentTaskId: string;
    subTasks: any[];
    totalCount: number;
    hasMore: boolean;
    nextCursor?: any;
}[];

/**
 * Normalizes query filters into a stable hash for the cache key.
 * Normalizes dates to prevent timestamp-based cache misses.
 */
function getFilterHash(filters: Partial<TaskFilters>): string {
    const normalizeDate = (d: any) => {
        if (!d) return null;
        const date = new Date(d);
        // Normalize to day-only UTC timestamp for stable caching
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).getTime();
    };

    return JSON.stringify({
        status: filters.status,
        assigneeId: filters.assigneeId,
        tagId: filters.tagId,
        search: filters.search?.trim().toLowerCase(),
        dueAfter: normalizeDate(filters.dueAfter || (filters as any).startDate),
        dueBefore: normalizeDate(filters.dueBefore || (filters as any).endDate),
    });
}

/**
 * Internal function to fetch subtasks for multiple parent tasks in a SINGLE query.
 * Optimized for performance and high cache hit ratios.
 */
async function _getSubTasksByParentIdsInternal(
    parentTaskIds: string[],
    workspaceId: string,
    projectId: string | undefined,
    userId: string,
    isAdmin: boolean,
    fullAccessProjectIds: string[],
    restrictedProjectIds: string[],
    filters: Partial<TaskFilters> = {},
    pageSize: number = 30,
    viewMode: string = "list"
): Promise<BatchSubTasksResult> {
    if (parentTaskIds.length === 0) {
        return [];
    }

    const startTime = performance.now();

    // ── 1. Build Raw Conditions ──────────────────────────────────────────
    // Normalize date filters to UTC days (matches get-tasks.ts logic)
    const normalize = (d: any) => d ? new Date(new Date(d).setUTCHours(0, 0, 0, 0)) : undefined;
    const dueAfter = normalize(filters.dueAfter || (filters as any).startDate);
    const dueBefore = normalize(filters.dueBefore || (filters as any).endDate);

    const countWhere: any = {
        workspaceId,
        parentTaskId: { in: parentTaskIds },
        // isParent: false removed to allow nested folders/subtasks to show
        ...buildSubTaskConditions({
            ...filters,
            workspaceId,
            dueAfter,
            dueBefore
        })
    };

    if (!isAdmin) {
        if (fullAccessProjectIds.length > 0 && restrictedProjectIds.length > 0) {
            countWhere.OR = [
                { projectId: { in: fullAccessProjectIds } },
                { projectId: { in: restrictedProjectIds }, ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId } } }
            ];
        } else if (fullAccessProjectIds.length > 0) {
            countWhere.projectId = { in: fullAccessProjectIds };
        } else if (restrictedProjectIds.length > 0) {
            countWhere.projectId = { in: restrictedProjectIds };
            countWhere.ProjectMember_Task_assigneeIdToProjectMember = { WorkspaceMember: { userId } };
        } else {
            // Short-circuit: no access to any requested project
            return parentTaskIds.map(parentTaskId => ({
                parentTaskId,
                subTasks: [],
                totalCount: 0,
                hasMore: false,
            }));
        }
    }

    // ── 2. SINGLE PARENT OPTIMIZATION (THE FAST PATH) ──────────────────────
    // If only one parent is requested (expansion), use 'take' for maximum speed.
    if (parentTaskIds.length === 1) {
        const parentId = parentTaskIds[0];

        // 🚀 Optimization: Fetch parent data once and subtasks separately
        const baseSelect = getTaskSelect(viewMode);
        const subtaskSelect = { ...baseSelect };
        const parentRelationSelect = baseSelect.parentTask as any;
        delete subtaskSelect.parentTask;

        // 🚀 PERF: Remove _count entirely — activities generates a correlated
        // COUNT(*) subquery PER ROW which is the single biggest query cost.
        // subTasks count is also removed. Both default to 0 in the response.
        delete subtaskSelect._count;

        // 🚀 PERF: Remove project relation — all subtasks share the parent's project.
        // Fetch it once with parent data instead of JOINing per row (~30 JOINs saved).
        delete subtaskSelect.project;

        // 🚀 PERF: Build a leaner WHERE for single parent:
        // - Direct equality instead of IN for single value
        // - No workspaceId (all children share parent's workspace, allows
        //   PostgreSQL to use the (parentTaskId, createdAt) index directly)
        const singleParentWhere: any = {
            parentTaskId: parentId,
            ...buildSubTaskConditions({
                ...filters,
                workspaceId,
                dueAfter,
                dueBefore
            })
        };

        // Apply permission scoping (only for non-admins)
        if (!isAdmin) {
            if (fullAccessProjectIds.length > 0 && restrictedProjectIds.length > 0) {
                singleParentWhere.OR = [
                    { projectId: { in: fullAccessProjectIds } },
                    { projectId: { in: restrictedProjectIds }, ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId } } }
                ];
            } else if (fullAccessProjectIds.length > 0) {
                singleParentWhere.projectId = { in: fullAccessProjectIds };
            } else if (restrictedProjectIds.length > 0) {
                singleParentWhere.projectId = { in: restrictedProjectIds };
                singleParentWhere.ProjectMember_Task_assigneeIdToProjectMember = { WorkspaceMember: { userId } };
            }
        }

        // Fetch subtasks and parent+project metadata in parallel
        const [rawTasks, parentAndProjectData] = await Promise.all([
            prisma.task.findMany({
                where: singleParentWhere,
                select: {
                    ...subtaskSelect,
                    parentTaskId: true,
                },
                take: pageSize + 1,
                orderBy: [
                    { createdAt: 'desc' },
                    { id: 'desc' },
                ]
            }),
            prisma.task.findUnique({
                where: { id: parentId },
                select: {
                    ...(parentRelationSelect?.select || { id: true, name: true }),
                    project: { select: { id: true, name: true, color: true } },
                }
            })
        ]);

        // Extract parent and project data from the combined query
        const parentData = parentAndProjectData
            ? { id: parentAndProjectData.id, name: (parentAndProjectData as any).name }
            : null;
        const projectData = (parentAndProjectData as any)?.project || null;

        console.log(`🔍 [BATCH_SUBTASKS_EXPAND] parent: ${parentId}, userId: ${userId}`);
        console.log(`🔍 [BATCH_SUBTASKS_EXPAND] Project: ${projectData?.name || "Unknown"}`);
        console.log(`🔍 [BATCH_SUBTASKS_EXPAND] Found ${rawTasks.length} raw subtasks.`);
        if (rawTasks.length === 0) {
            console.log(`⚠️ [BATCH_SUBTASKS_EXPAND] No subtasks found for where:`, JSON.stringify(singleParentWhere, null, 2));
        }

        const hasMore = rawTasks.length > pageSize;
        const finalTasks = (hasMore ? rawTasks.slice(0, pageSize) : rawTasks).map(t => {
            const entry = mapTaskAssignee({
                ...t,
                parentTask: parentData,
                project: projectData,
                _count: { activities: 0 },
            });
            return entry;
        });

        const duration = performance.now() - startTime;

        const nextCursor = hasMore && finalTasks.length > 0
            ? { id: finalTasks[finalTasks.length - 1].id, createdAt: finalTasks[finalTasks.length - 1].createdAt }
            : undefined;

        return [{
            parentTaskId: parentId,
            subTasks: finalTasks,
            totalCount: finalTasks.length,
            hasMore,
            nextCursor
        }];
    }

    // ── 3. Optimized BATCH Fetch (THE SCALABLE PATH) ────────────────────────
    // For many parents, we fetch a matching set and group them in memory.
    const BATCH_HARD_LIMIT = 500;

    // 🚀 PERF: Remove _count for batch path too — same correlated subquery issue
    const batchSelect = { ...getTaskSelect(viewMode) };
    delete batchSelect._count;

    const rawSubTasksAll = await prisma.task.findMany({
        where: countWhere,
        select: {
            ...batchSelect,
            parentTaskId: true,
        },
        take: BATCH_HARD_LIMIT,
        orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
        ]
    });

    const subTasksMap = new Map<string, any[]>();
    const totalCountMap = new Map<string, number>();

    rawSubTasksAll.forEach(task => {
        const pId = task.parentTaskId!;
        const currentCount = totalCountMap.get(pId) || 0;
        totalCountMap.set(pId, currentCount + 1);

        if (currentCount < pageSize) {
            if (!subTasksMap.has(pId)) subTasksMap.set(pId, []);
            subTasksMap.get(pId)!.push(mapTaskAssignee({
                ...task,
                _count: { activities: 0 }
            }));
        }
    });

    const duration = performance.now() - startTime;
    if (duration > 150) {
        console.log(`[PERF] Batch Subtasks: ${duration.toFixed(2)}ms for ${parentTaskIds.length} parents`);
    }

    return parentTaskIds.map(parentTaskId => {
        const subTasks = subTasksMap.get(parentTaskId) || [];
        const totalCount = totalCountMap.get(parentTaskId) || 0;
        return {
            parentTaskId,
            subTasks,
            totalCount,
            hasMore: totalCount > pageSize,
        };
    });
}

/**
 * Cached version of batch subtask fetch.
 * Uses Next.js unstable_cache for cross-request consistency.
 */
const getCachedSubTasksByParentIds = async (
    parentTaskIds: string[],
    workspaceId: string,
    projectId: string | undefined,
    userId: string,
    isAdmin: boolean,
    fullAccessProjectIds: string[],
    restrictedProjectIds: string[],
    filters: Partial<TaskFilters>,
    pageSize: number,
    viewMode: string
): Promise<BatchSubTasksResult> => {
    const sortedIds = [...parentTaskIds].sort().join(',');
    const filterHash = getFilterHash(filters);
    const scopeHash = JSON.stringify({
        isAdmin,
        full: [...fullAccessProjectIds].sort(),
        restricted: [...restrictedProjectIds].sort(),
    });

    const startTime = performance.now();
    const results = await unstable_cache(
        async () => _getSubTasksByParentIdsInternal(
            parentTaskIds,
            workspaceId,
            projectId,
            userId,
            isAdmin,
            fullAccessProjectIds,
            restrictedProjectIds,
            filters,
            pageSize,
            viewMode
        ),
        [`batch-subtasks-v8-${sortedIds}-${userId}-${scopeHash}-${filterHash}-${pageSize}-${viewMode}`],
        {
            tags: parentTaskIds.flatMap(id => CacheTags.taskSubTasks(id, userId)),
            revalidate: 300, // 5 minutes - reliable because we invalidate specifically on mutation
        }
    )();

    const duration = performance.now() - startTime;

    return results;
};

/**
 * Get subtasks for multiple parent tasks in a SINGLE database query.
 * Entry point for client/server components.
 */
export const getSubTasksByParentIds = cache(
    async (
        parentTaskIds: string[],
        workspaceId: string,
        projectId?: string,
        filters: Partial<TaskFilters> = {},
        pageSize: number = 30,
        viewMode: string = "list",
        userId?: string,
        skipPermissionsCheck: boolean = false
    ): Promise<BatchSubTasksResult> => {
        try {
            if (parentTaskIds.length === 0) {
                return [];
            }

            let isWorkspaceAdmin = false;
            let fullAccessProjectIds: string[] = [];
            let restrictedProjectIds: string[] = [];
            let workspaceMemberUserId = userId || "";

            if (!skipPermissionsCheck) {
                const {
                    permissions,
                    isWorkspaceAdmin: isAdmin,
                    fullAccessProjectIds: fullAccess,
                    restrictedProjectIds: restricted,
                } = await resolveTaskPermissions(workspaceId, projectId, userId);

                if (!permissions?.WorkspaceMember) {
                    throw new Error("User does not have access to this workspace");
                }
                isWorkspaceAdmin = isAdmin;
                fullAccessProjectIds = fullAccess;
                restrictedProjectIds = restricted;
                workspaceMemberUserId = permissions.WorkspaceMember.userId;
            } else if (userId) {
                // We still resolve permissions to get the correct isAdmin status and security scopes
                // for the database query, even if we are 'skipping' the strict existence check.
                const {
                    isWorkspaceAdmin: isAdmin,
                    fullAccessProjectIds: fullAccess,
                    restrictedProjectIds: restricted,
                } = await resolveTaskPermissions(workspaceId, projectId, userId);

                isWorkspaceAdmin = isAdmin;
                fullAccessProjectIds = fullAccess;
                restrictedProjectIds = restricted;
                workspaceMemberUserId = userId;
            }

            // 🚀 CRITICAL OPTIMIZATION: Next.js unstable_cache has severe read/write blocking overhead (~3s locally).
            // When a user expands a single folder (Server Action), bypass cache and query DB instantly!
            if (parentTaskIds.length === 1) {
                return await _getSubTasksByParentIdsInternal(
                    parentTaskIds,
                    workspaceId,
                    projectId,
                    workspaceMemberUserId,
                    isWorkspaceAdmin,
                    fullAccessProjectIds,
                    restrictedProjectIds,
                    filters,
                    pageSize,
                    viewMode
                );
            }

            return await getCachedSubTasksByParentIds(
                parentTaskIds,
                workspaceId,
                projectId,
                workspaceMemberUserId,
                isWorkspaceAdmin,
                fullAccessProjectIds,
                restrictedProjectIds,
                filters,
                pageSize,
                viewMode
            );
        } catch (error) {
            console.error("Error fetching batch subtasks:", error);
            // Graceful fallback: return empty sets for all requested parents
            return parentTaskIds.map(parentTaskId => ({
                parentTaskId,
                subTasks: [],
                totalCount: 0,
                hasMore: false,
            }));
        }
    }
);

// ============================================
// TYPE EXPORTS
// ============================================

export type BatchSubTasksResponse = Awaited<ReturnType<typeof getSubTasksByParentIds>>;
export type BatchSubTaskItem = BatchSubTasksResponse[number];
