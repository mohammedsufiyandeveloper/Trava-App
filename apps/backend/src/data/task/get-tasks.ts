"use server";

const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
const unstable_cache = <T extends (...args: any[]) => any>(fn: T, _keys?: string[], _opts?: any) => fn; // next/cache no-op
import crypto from "crypto";
import prisma from "@/lib/db";
import { getUserPermissions, getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { CacheTags } from "@/data/cache-tags";
import { getTaskSelect, TaskCursor, buildProjectRootWhere, buildSubtaskExpansionWhere, buildWorkspaceFilterWhere, WorkspaceFilterOpts, } from "@/lib/tasks/query-builder";
import { mapTaskAssignee } from "@/lib/tasks/mapper";
import { logger } from "@/lib/logger";

export type TaskViewType = "list" | "kanban" | "gantt" | "calendar";

export interface GetTasksOptions {
    workspaceId: string;
    projectId?: string;
    hierarchyMode?: "parents" | "children" | "all";
    groupBy?: "status";

    status?: string | string[];
    permissionStatus?: string | string[];
    assigneeId?: string | string[];
    tagId?: string | string[];
    tag?: string | string[];
    search?: string;
    dueAfter?: string | Date;
    dueBefore?: string | Date;
    startDate?: string | Date;
    endDate?: string | Date;
    isPinned?: boolean;

    filterParentTaskId?: string;
    onlyParents?: boolean;
    excludeParents?: boolean;
    onlySubtasks?: boolean;

    cursor?: TaskCursor;
    skip?: number;
    expandedProjectIds?: string[];
    page?: number;
    limit?: number;
    includeSubTasks?: boolean;
    includeFacets?: boolean;

    view_mode?: "default" | "search" | "list" | "kanban" | "gantt" | "calendar" | "subtask";
    sorts?: Array<{ field: string; direction: "asc" | "desc" }>;
}

// ============================================================
//  SORT CONTRACT — Single Source of Truth
//  Client field name → DB column + null-handling strategy.
//
//  ⚠️  DO NOT add relation fields here (e.g. assignee → assigneeId).
//  Sorting by a FK id is semantically meaningless.
//  Denormalize the display value into the Task table first,
//  then add it here.
// ============================================================
type SortDefinition = {
    /** Exact Prisma field name on the Task model */
    dbField: string;
    /** How to handle NULL rows — omit for non-nullable columns */
    nulls?: "last" | "first";
};

const SORT_MAP: Record<string, SortDefinition> = {
    name: { dbField: "name" },
    status: { dbField: "status", nulls: "last" },
    dueDate: { dbField: "dueDate", nulls: "last" },
    startDate: { dbField: "startDate", nulls: "last" },
    createdAt: { dbField: "createdAt" },
    assignee: { dbField: "assigneeId", nulls: "last" },
    reviewer: { dbField: "reviewerId", nulls: "last" },
};

function buildOrderBy(sorts?: Array<{ field: string; direction: "asc" | "desc" }>) {
    if (!sorts || sorts.length === 0) {
        return [
            { createdAt: "desc" as const },
            { id: "desc" as const },
        ];
    }

    const { field, direction } = sorts[0];
    const def = SORT_MAP[field];

    if (!def) {
        throw new Error(`[buildOrderBy] Invalid sort field: "${field}". Add it to SORT_MAP first.`);
    }

    const primary: any = def.nulls
        ? { [def.dbField]: { sort: direction, nulls: def.nulls } }
        : { [def.dbField]: direction };

    // ALWAYS use id: desc as the deterministic tiebreaker
    // and take advantage of standard compound indexes (field, id).
    return [primary, { id: "desc" as const }];
}

/**
 * Builds a WHERE extension that skips all rows already delivered by the previous page.
 * Uses the exact same field order as buildOrderBy so pagination is stable.
 *
 * IMPORTANT: cursor keys are DB column names (e.g. "startDate"), NOT client field names.
 */
function buildSeekCondition(
    sorts: Array<{ field: string; direction: "asc" | "desc" }>,
    cursor: any
): any {
    try {
        if (!sorts?.length || !cursor) return {};

        const { field, direction } = sorts[0];
        const def = SORT_MAP[field];
        if (!def) return {};

        const dbField = def.dbField;
        const lastFieldValue = cursor[dbField];
        const lastId = cursor.id;

        if (lastId === undefined || lastId === null) return {};

        const op = direction === "asc" ? "gt" : "lt";

        if (lastFieldValue === null || lastFieldValue === undefined) {
            // We are in the NULL block at the end (nulls: 'last')
            return {
                AND: [
                    { [dbField]: null },
                    { id: { lt: lastId } },
                ],
            };
        }

        // We are in the non-null block
        const conditions: any[] = [
            // 1. All rows strictly after this value (direction-dependent: lt for DESC, gt for ASC)
            { [dbField]: { [op]: lastFieldValue } },
            // 2. Rows with SAME value but strictly after this ID (ALWAYS 'lt' because tiebreaker is ALWAYS 'desc')
            {
                AND: [
                    { [dbField]: lastFieldValue },
                    { id: { lt: lastId } },
                ],
            },
        ];

        // 3. If we haven't hit the NULL block yet, include it
        if (def.nulls === "last") {
            conditions.push({ [dbField]: null });
        }

        return { OR: conditions };
    } catch (err) {
        console.error("[buildSeekCondition] Error building skip condition:", err);
        return {};
    }
}

const toArray = <T>(v: T | T[] | undefined): T[] | undefined =>
    v === undefined ? undefined : Array.isArray(v) ? v : [v];

const toUTCDateOnly = (input: string | Date | undefined) => {
    if (!input) return undefined;

    const d = new Date(input);

    // If it's a Date object (not a string), it likely came from a local UI picker.
    // We want the calendar day the user sees. Use local components getFullYear/getMonth/getDate.
    if (typeof input !== 'string') {
        return new Date(Date.UTC(
            d.getFullYear(),
            d.getMonth(),
            d.getDate()
        ));
    }

    // For strings like "2024-10-10", stay in UTC
    return new Date(Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate()
    ));
};

const addOneDayUTC = (date: Date) =>
    new Date(date.getTime() + 24 * 60 * 60 * 1000);


// const ORDER_BY_CREATED_DESC = [{ createdAt: "desc" as const }, { id: "asc" as const }];

/**
 * Normalizes query options into a stable signature object for better cache hit ratios.
 */
function buildQuerySignature(
    workspaceId: string,
    projectId: string | undefined,
    permissionScope: { fullAccessProjectIds: string[], restrictedProjectIds: string[] } | string,
    opts: GetTasksOptions
) {
    const f: Record<string, any> = {};
    const sortArr = (val: any) => (Array.isArray(val) ? [...val].sort() : val);

    if (opts.status) f.st = sortArr(opts.status);
    if (opts.assigneeId) f.as = sortArr(opts.assigneeId);
    if (opts.tagId) f.tg = sortArr(opts.tagId);
    if (opts.search) f.q = opts.search.trim().toLowerCase();
    const dueAfter = opts.dueAfter || opts.startDate;
    const dueBefore = opts.dueBefore || opts.endDate;
    if (dueAfter) f.da = new Date(dueAfter).getTime();
    if (dueBefore) f.db = new Date(dueBefore).getTime();

    if (opts.hierarchyMode) f.hm = opts.hierarchyMode;
    if (opts.excludeParents) f.epx = opts.excludeParents;
    if (opts.onlySubtasks) f.ost = opts.onlySubtasks;
    if (opts.groupBy) f.gb = opts.groupBy;
    if (opts.filterParentTaskId) f.pt = opts.filterParentTaskId;
    if (opts.expandedProjectIds) f.ep = sortArr(opts.expandedProjectIds);
    if (opts.view_mode) f.vm = opts.view_mode;
    const signature = {
        ws: workspaceId,
        p: projectId ?? "all",
        ps: permissionScope,
        f,
        // sorts MUST be in the key — without this every sort variant hits the same cached unsorted result
        so: opts.sorts && opts.sorts.length > 0
            ? opts.sorts.map(s => `${s.field}:${s.direction}`).join(",")
            : null,
        c: opts.cursor?.id ?? null,
        sk: opts.skip ?? 0,
        l: opts.limit ?? 20,
    };

    // 3. Hash the signature
    return crypto.createHash("sha256").update(JSON.stringify(signature)).digest("hex");
}

export const resolveTaskPermissions = cache(async (workspaceId: string, projectId?: string, userId?: string) => {
    let permissions: any;
    let isWorkspaceAdmin = false;
    let authorizedProjectIds: string[] = [];

    if (projectId) {
        permissions = await getUserPermissions(workspaceId, projectId, userId);
        isWorkspaceAdmin = permissions.isWorkspaceAdmin;

        const hasFullAccess =
            isWorkspaceAdmin ||
            permissions.isProjectLead ||
            permissions.isProjectManager;

        const result = {
            permissions,
            isWorkspaceAdmin,
            authorizedProjectIds: [projectId],
            fullAccessProjectIds: hasFullAccess ? [projectId] : [],
            restrictedProjectIds: hasFullAccess ? [] : [projectId]
        };
        return result;
    } else {
        const wsPerms = await getWorkspacePermissions(workspaceId, userId);
        permissions = wsPerms;
        isWorkspaceAdmin = wsPerms.isWorkspaceAdmin;

        if (isWorkspaceAdmin) {
            authorizedProjectIds = [];
        } else {
            // AUTHORIZED PROJECTS: Combine all projects where user has a defined role
            authorizedProjectIds = [
                ...(wsPerms.leadProjectIds || []),
                ...(wsPerms.managedProjectIds || []),
                ...(wsPerms.memberProjectIds || []),
                ...(wsPerms.viewerProjectIds || [])
            ];
        }

        const fullAccessProjectIds = [
            ...(wsPerms.leadProjectIds ?? []),
            ...(wsPerms.managedProjectIds ?? [])
        ];

        const restrictedProjectIds = authorizedProjectIds.filter(
            id => !fullAccessProjectIds.includes(id)
        );

        const result = {
            permissions,
            isWorkspaceAdmin,
            authorizedProjectIds,
            fullAccessProjectIds,
            restrictedProjectIds
        };
        return result;
    }
});

// ============================================================
//  VIEW 1: PROJECT ROOT  (Parent Tasks — initial load)
//  Index:  (projectId, isParent, status, createdAt DESC)
// ============================================================
async function _fetchProjectRoot(
    projectId: string,
    workspaceId: string,
    userId: string,
    isAdmin: boolean,
    fullAccessProjectIds: string[],
    restrictedProjectIds: string[],
    opts: GetTasksOptions
) {
    const limit = opts.limit ?? 50;
    const status = toArray(opts.status);
    const assigneeIds = toArray(opts.assigneeId);

    const where = buildProjectRootWhere(projectId, {
        status,
        assigneeId: toArray(opts.assigneeId),
        cursor: opts.cursor,
        userId,
        isAdmin,
        fullAccessProjectIds,
    });

    const [rawTasks, totalCount] = await Promise.all([
        prisma.task.findMany({
            where,
            select: getTaskSelect(opts.view_mode),
            orderBy: buildOrderBy(opts.sorts),
            take: limit + 1,
        }),
        Promise.resolve(null as number | null),
    ]);

    const hasMore = rawTasks.length > limit;
    if (hasMore) rawTasks.pop();

    const nextCursor: TaskCursor | null = hasMore
        ? { id: rawTasks[rawTasks.length - 1].id, createdAt: rawTasks[rawTasks.length - 1].createdAt }
        : null;

    return {
        tasks: rawTasks,
        totalCount,
        hasMore,
        nextCursor,
        facets: { status: {}, assignee: {}, tags: {}, projects: {} }
    };
}

// ============================================================
//  VIEW 2: SUBTASK EXPANSION  (Children of a Parent)
//  Index: (parentTaskId, createdAt)
// ============================================================
async function _fetchSubtasks(
    parentTaskId: string,
    userId: string,
    isAdmin: boolean,
    fullAccessProjectIds: string[],
    restrictedProjectIds: string[],
    opts: GetTasksOptions
) {
    const limit = opts.limit ?? 30;
    const status = toArray(opts.status);

    // Resolve the parent's projectId so we can apply the correct per-project scope.
    let isRestrictedMember = false;
    if (!isAdmin) {
        const parent = await prisma.task.findUnique({
            where: { id: parentTaskId },
            select: { projectId: true },
        });
        const parentProjectId = parent?.projectId;
        if (parentProjectId) {
            if (restrictedProjectIds.includes(parentProjectId)) {
                // Member-only project: restrict to own subtasks
                isRestrictedMember = true;
            }
        }
    }

    console.log(`🔍 [EXPAND_API] parentTaskId: ${parentTaskId}, userId: ${userId}, isAdmin: ${isAdmin}`);
    console.log(`🔍 [EXPAND_API] restrictedProjectIds: ${restrictedProjectIds.join(', ')}`);

    const where = buildSubtaskExpansionWhere(parentTaskId, {
        status: status,
        assigneeId: toArray(opts.assigneeId),
        tagId: toArray(opts.tagId),
        search: opts.search,
        dueAfter: toUTCDateOnly(opts.dueAfter),
        dueBefore: opts.dueBefore ? addOneDayUTC(toUTCDateOnly(opts.dueBefore)!) : undefined,
        cursor: opts.cursor,
        userId,
        isAdmin,
        isRestrictedMember,
    });

    console.log(`🔍 [EXPAND_API] Final WHERE structure for expansion:`, JSON.stringify(where, null, 2));

    const rawSubtasks = await prisma.task.findMany({
        where,
        select: getTaskSelect(opts.view_mode),
        orderBy: buildOrderBy(opts.sorts),
        take: limit + 1,
    });

    console.log(`🔍 [EXPAND_API] Found ${rawSubtasks.length} raw subtasks.`);

    const hasMore = rawSubtasks.length > limit;
    if (hasMore) rawSubtasks.pop();

    const nextCursor: TaskCursor | null = hasMore
        ? { id: rawSubtasks[rawSubtasks.length - 1].id, createdAt: rawSubtasks[rawSubtasks.length - 1].createdAt }
        : null;

    return {
        tasks: rawSubtasks,
        totalCount: null,
        hasMore,
        nextCursor,
        facets: { status: {}, assignee: {}, tags: {}, projects: {} }
    };
}

// ============================================================
async function _fetchFilteredHierarchy(
    workspaceId: string,
    userId: string,
    isAdmin: boolean,
    fullAccessProjectIds: string[],
    restrictedProjectIds: string[],
    opts: GetTasksOptions
) {
    const overallStart = performance.now();
    const limit = opts.limit ?? 50;

    // Filter Detection
    const hasExplicitFilters = !!(
        (opts.status && toArray(opts.status)?.length) ||
        (opts.assigneeId && toArray(opts.assigneeId)?.length) ||
        (opts.tagId && toArray(opts.tagId)?.length) ||
        (opts.search && opts.search.trim().length > 0) ||
        opts.dueAfter ||
        opts.dueBefore
    );

    const matchWhere = buildWorkspaceFilterWhere(
        {
            workspaceId,
            projectId: opts.projectId,
            assigneeId: toArray(opts.assigneeId),
            status: toArray(opts.status),
            tagId: toArray(opts.tagId),
            dueAfter: toUTCDateOnly(opts.dueAfter),
            dueBefore: opts.dueBefore ? addOneDayUTC(toUTCDateOnly(opts.dueBefore)!) : undefined,
            search: opts.search,
            isAdmin,
            fullAccessProjectIds,
            restrictedProjectIds,
            projectIds: (!opts.projectId && opts.expandedProjectIds?.length) ? opts.expandedProjectIds : undefined,
            includeSubTasks: opts.includeSubTasks,
            onlyParents: opts.hierarchyMode === "parents",
            onlySubtasks: opts.hierarchyMode === "children",
            view_mode: opts.view_mode,
        },
        userId
    );

    const expansionMatchWhere = { ...matchWhere };
    delete (expansionMatchWhere as any).isParent;
    delete (expansionMatchWhere as any).parentTaskId;
    // CRITICAL: We must remove these constraints so expansion can find children
    delete (expansionMatchWhere as any).isParent;
    // The matchWhere might have been built with onlyParents: true, which adds isParent: true
    // We need to make sure the subtask fetch doesn't inherit that.
    // Actually, matchWhere is an object already built. We need to find if it has isParent.
    if ((expansionMatchWhere as any).isParent !== undefined) {
        delete (expansionMatchWhere as any).isParent;
    }

    // Also, if matchWhere was built with hierarchy logic, it might have isParent inside an AND/OR.
    // But the easiest way is to ensure buildWorkspaceFilterWhere is called with the right flags.

    // Let's re-build expansionMatchWhere specifically for subtasks
    const subtaskMatchWhere = buildWorkspaceFilterWhere(
        {
            workspaceId,
            projectId: opts.projectId,
            assigneeId: toArray(opts.assigneeId),
            status: toArray(opts.status),
            tagId: toArray(opts.tagId),
            dueAfter: toUTCDateOnly(opts.dueAfter),
            dueBefore: opts.dueBefore ? addOneDayUTC(toUTCDateOnly(opts.dueBefore)!) : undefined,
            search: opts.search,
            isAdmin,
            fullAccessProjectIds,
            restrictedProjectIds,
            projectIds: (!opts.projectId && opts.expandedProjectIds?.length) ? opts.expandedProjectIds : undefined,
            includeSubTasks: false, // Don't recurse infinitely
            onlyParents: false,    // WE WANT SUBTASKS
            onlySubtasks: false,
            view_mode: opts.view_mode,
        },
        userId
    );

    // 1. Fetch matches directly
    const startMatches = performance.now();
    const rawMatches = await prisma.task.findMany({
        where: buildWorkspaceFilterWhere(
            {
                workspaceId,
                projectId: opts.projectId,
                assigneeId: toArray(opts.assigneeId),
                status: toArray(opts.status),
                tagId: toArray(opts.tagId),
                dueAfter: toUTCDateOnly(opts.dueAfter),
                dueBefore: opts.dueBefore ? addOneDayUTC(toUTCDateOnly(opts.dueBefore)!) : undefined,
                search: opts.search,
                isAdmin,
                fullAccessProjectIds,
                restrictedProjectIds,
                projectIds: (!opts.projectId && opts.expandedProjectIds?.length) ? opts.expandedProjectIds : undefined,
                includeSubTasks: opts.includeSubTasks,
                onlyParents: opts.hierarchyMode === "parents",
                onlySubtasks: opts.hierarchyMode === "children",
                view_mode: opts.view_mode,
                cursor: opts.cursor,
            },
            userId
        ),
        select: getTaskSelect(opts.view_mode),
        take: limit + 1,
        orderBy: buildOrderBy(opts.sorts),
    });
    // console.log(`⏱️ [_fetchFilteredHierarchy] Initial matches fetch: ${(performance.now() - startMatches).toFixed(2)}ms`);


    const hasMore = rawMatches.length > limit;
    const matches = rawMatches.slice(0, limit);

    if (matches.length === 0) {
        return { tasks: [], totalCount: 0, hasMore: false, nextCursor: null };
    }

    // 2. CONTEXT EXPANSION
    const taskMap = new Map<string, any>();
    const shouldHaveSubTasks = opts.includeSubTasks || hasExplicitFilters;
    matches.forEach(t => taskMap.set(t.id, { ...t, subTasks: shouldHaveSubTasks ? [] : undefined }));

    const maxDepth = hasExplicitFilters ? 3 : 1;
    let currentGeneration = [...matches];
    const expandedParentIds = new Set<string>();

    for (let i = 0; i < maxDepth; i++) {
        const missingParentIds = currentGeneration
            .filter(t => t.parentTaskId && !taskMap.has(t.parentTaskId))
            .map(t => t.parentTaskId!);

        const parentIdsToExpand = opts.includeSubTasks
            ? currentGeneration
                .filter(t => (t as any).isParent && !expandedParentIds.has(t.id))
                .map(t => t.id)
            : [];

        parentIdsToExpand.forEach(id => expandedParentIds.add(id));

        if (missingParentIds.length === 0 && parentIdsToExpand.length === 0) break;

        const orConditions: any[] = [];
        if (missingParentIds.length > 0) {
            orConditions.push({ id: { in: missingParentIds } });
        }
        if (parentIdsToExpand.length > 0) {
            orConditions.push({
                AND: [
                    { parentTaskId: { in: parentIdsToExpand } },
                    subtaskMatchWhere
                ]
            });
        }
        const extraTasks = await prisma.task.findMany({
            where: { OR: orConditions },
            select: getTaskSelect(opts.view_mode),
            orderBy: buildOrderBy(opts.sorts),
            take: opts.view_mode === "gantt" ? 1000 : 200
        });

        if (extraTasks.length === 0) break;

        const newEntries: any[] = [];
        extraTasks.forEach(t => {
            if (!taskMap.has(t.id)) {
                const entry = { ...t, subTasks: shouldHaveSubTasks ? [] : undefined };
                taskMap.set(t.id, entry);
                newEntries.push(entry);
            }
        });
        currentGeneration = newEntries;
        if (taskMap.size > 500) break;
    }

    // 3. RE-NESTING
    const startNesting = performance.now();
    const rootTasks: any[] = [];
    const nestedIds = new Set<string>();
    const allTasks = Array.from(taskMap.values());

    allTasks.forEach(task => {
        if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
            const parent = taskMap.get(task.parentTaskId);
            if (!parent.subTasks) parent.subTasks = [];
            if (!parent.subTasks.some((st: any) => st.id === task.id)) {
                parent.subTasks.push(task);
                nestedIds.add(task.id);
            }
        }
    });

    allTasks.forEach(task => {
        if (!nestedIds.has(task.id)) {
            rootTasks.push(task);
        }
    });
    // console.log(`⏱️ [_fetchFilteredHierarchy] Re-nesting: ${(performance.now() - startNesting).toFixed(2)}ms`);

    // 4. SORTING
    const sortedRoots = rootTasks.sort((a, b) => {
        const aIdx = matches.findIndex(m => m.id === a.id);
        const bIdx = matches.findIndex(m => m.id === b.id);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;

        const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (b.id < a.id ? -1 : (b.id > a.id ? 1 : 0));
    });

    const nextCursor: TaskCursor | null = hasMore && matches.length > 0
        ? { id: matches[matches.length - 1].id, createdAt: matches[matches.length - 1].createdAt }
        : null;

    // console.log(`⏱️ [_fetchFilteredHierarchy] Overall completion: ${(performance.now() - overallStart).toFixed(2)}ms`);

    // 5. PROJECT FACETS
    const projectFacets: Record<string, number> = {};
    if (opts.includeFacets) {
        const facetWhere = JSON.parse(JSON.stringify(matchWhere));
        if (Array.isArray(facetWhere.AND)) {
            facetWhere.AND = facetWhere.AND.filter((cond: any) =>
                !cond.OR || !cond.OR.some((c: any) => c.createdAt && (c.createdAt.lt || c.createdAt.gt))
            );
            if (facetWhere.AND.length === 0) delete facetWhere.AND;
        }

        const counts = await prisma.task.groupBy({
            by: ['projectId'],
            where: facetWhere,
            _count: { id: true }
        });
        counts.forEach(c => {
            if (c.projectId) projectFacets[c.projectId] = (projectFacets[c.projectId] || 0) + (c._count as any).id;
        });
    }

    return {
        tasks: sortedRoots,
        totalCount: matches.length,
        hasMore,
        nextCursor,
        facets: { status: {}, assignee: {}, tags: {}, projects: projectFacets }
    };
}


// ============================================================
//  VIEW 4: WORKSPACE FILTER (Flat Layout)
// ============================================================
async function _fetchWorkspaceFilter(
    workspaceId: string,
    userId: string,
    isAdmin: boolean,
    fullAccessProjectIds: string[],
    restrictedProjectIds: string[],
    opts: GetTasksOptions
) {
    const limit = opts.limit ?? 50;
    const start = toUTCDateOnly(opts.dueAfter);
    const end = toUTCDateOnly(opts.dueBefore);
    const normalizedStart = start;
    const normalizedEnd = end ? addOneDayUTC(end) : undefined;
    const isSorting = opts.sorts && opts.sorts.length > 0;

    const filterOpts: WorkspaceFilterOpts = {
        workspaceId,
        projectId: opts.projectId,
        assigneeId: toArray(opts.assigneeId),
        status: toArray(opts.status),
        tagId: toArray(opts.tagId),
        dueAfter: normalizedStart,
        dueBefore: normalizedEnd,
        search: opts.search,
        cursor: isSorting ? undefined : opts.cursor,
        isAdmin,
        fullAccessProjectIds,
        restrictedProjectIds,
        projectIds: (!opts.projectId && opts.expandedProjectIds?.length) ? opts.expandedProjectIds : undefined,
        onlyParents: isSorting ? false : opts.onlyParents,
        excludeParents: opts.excludeParents,
        onlySubtasks: isSorting ? true : opts.onlySubtasks,
        view_mode: opts.view_mode,
    };

    const where = buildWorkspaceFilterWhere(filterOpts, userId);

    if (isSorting && opts.cursor) {
        const seek = buildSeekCondition(opts.sorts!, opts.cursor);
        if (seek) {
            if (where.OR) {
                const existingOR = where.OR;
                delete where.OR;
                where.AND = [
                    ...(Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : [])),
                    { OR: existingOR },
                    seek
                ];
            } else {
                where.AND = [
                    ...(Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : [])),
                    seek
                ];
            }
        }
    }

    const primarySort = opts.sorts?.[0];

    const [rawTasks, totalCount] = await Promise.all([
        prisma.task.findMany({
            where,
            select: getTaskSelect(opts.view_mode),
            orderBy: buildOrderBy(opts.sorts),
            take: limit + 1,
            skip: opts.skip || 0,
        }),
        Promise.resolve(null),
    ]);

    const hasMore = rawTasks.length > limit;
    if (hasMore) rawTasks.pop();

    const lastTask = rawTasks[rawTasks.length - 1] as any;
    const nextCursor: any = hasMore && lastTask
        ? primarySort && SORT_MAP[primarySort.field]
            ? {
                id: lastTask.id,
                [SORT_MAP[primarySort.field].dbField]: lastTask[SORT_MAP[primarySort.field].dbField],
            }
            : { id: lastTask.id, createdAt: lastTask.createdAt }
        : null;

    const projectFacets: Record<string, number> = {};
    if (opts.includeFacets) {
        const facetWhere = JSON.parse(JSON.stringify(where));
        if (Array.isArray(facetWhere.AND)) {
            facetWhere.AND = facetWhere.AND.filter((cond: any) =>
                !cond.OR || !cond.OR.some((c: any) => c.createdAt && (c.createdAt.lt || c.createdAt.gt))
            );
            if (facetWhere.AND.length === 0) delete facetWhere.AND;
        }

        const counts = await prisma.task.groupBy({
            by: ['projectId'],
            where: facetWhere,
            _count: { id: true }
        });
        counts.forEach(c => {
            if (c.projectId) projectFacets[c.projectId] = (projectFacets[c.projectId] || 0) + (c._count as any).id;
        });
    }

    return {
        tasks: rawTasks,
        totalCount,
        hasMore,
        nextCursor,
        facets: { status: {}, assignee: {}, tags: {}, projects: projectFacets }
    };
}

// ============================================================
//  ROUTER: Chooses the right fetch strategy
// ============================================================
async function _getTasksInternal(
    workspaceId: string,
    userId: string,
    isAdmin: boolean,
    fullAccessProjectIds: string[],
    restrictedProjectIds: string[],
    opts: GetTasksOptions
) {
    if (opts.startDate && !opts.dueAfter) opts.dueAfter = opts.startDate;
    if (opts.endDate && !opts.dueBefore) opts.dueBefore = opts.endDate;

    const startTime = performance.now();
    const { projectId, hierarchyMode, filterParentTaskId } = opts;
    let strategy = "NONE";

    try {
        const hasExplicitFilters =
            !!(
                (opts.status && toArray(opts.status)?.length) ||
                (opts.assigneeId && toArray(opts.assigneeId)?.length) ||
                (opts.tagId && toArray(opts.tagId)?.length) ||
                (opts.search && opts.search.trim().length > 0) ||
                opts.dueAfter ||
                opts.dueBefore ||
                opts.startDate ||
                opts.endDate ||
                opts.onlySubtasks ||
                opts.onlyParents ||
                opts.excludeParents ||
                (opts.sorts && opts.sorts.length > 0)
            );

        const emptyFacets = {
            status: {} as Record<string, number>,
            assignee: {} as Record<string, number>,
            tags: {} as Record<string, number>,
            projects: {} as Record<string, number>
        };

        if (!projectId && !hasExplicitFilters && !opts.expandedProjectIds?.length && hierarchyMode !== "parents") {
            strategy = "SAFETY_GUARD";
            return {
                tasks: [],
                totalCount: 0,
                hasMore: false,
                nextCursor: null,
                facets: emptyFacets,
            };
        }

        if (filterParentTaskId) {
            strategy = "SUBTASK_EXPANSION";
            const result = await _fetchSubtasks(
                filterParentTaskId, userId, isAdmin,
                fullAccessProjectIds, restrictedProjectIds, opts
            );
            return { ...result, totalCount: null, facets: emptyFacets };
        }

        if (projectId && !hasExplicitFilters && !opts.excludeParents && !opts.onlySubtasks && (hierarchyMode === "parents" || !hierarchyMode)) {
            strategy = opts.includeSubTasks ? "RECURSIVE_HIERARCHY" : "PROJECT_ROOT";
            const result = await _fetchProjectRoot(
                projectId, workspaceId, userId, isAdmin,
                fullAccessProjectIds, restrictedProjectIds, opts
            );

            if (opts.includeSubTasks && result.tasks.length > 0) {
                const parentIds = result.tasks.filter(t => t.isParent).map(t => t.id);
                if (parentIds.length > 0) {
                    const hasFullAccess = isAdmin || (projectId ? fullAccessProjectIds.includes(projectId) : false);

                    // Resolve the ProjectMember ID to ensure direct assigneeId filtering works (User ID vs PM ID parity)
                    const subtaskAssigneeIds: string[] = toArray(opts.assigneeId) || [];
                    if (!hasFullAccess && userId && projectId) {
                        const pm = await prisma.projectMember.findFirst({
                            where: { projectId, WorkspaceMember: { userId } },
                            select: { id: true }
                        });
                        if (pm) subtaskAssigneeIds.push(pm.id);
                    }

                    const subtasks = await prisma.task.findMany({
                        where: buildSubtaskExpansionWhere(undefined, {
                            parentIds,
                            status: toArray(opts.status),
                            assigneeId: subtaskAssigneeIds.length > 0 ? subtaskAssigneeIds : undefined,
                            tagId: toArray(opts.tagId),
                            search: opts.search,
                            userId,
                            isAdmin,
                            isRestrictedMember: !hasFullAccess
                        }),
                        select: getTaskSelect(opts.view_mode),
                        orderBy: buildOrderBy(opts.sorts)
                    });

                    // Nest subtasks into parents
                    result.tasks.forEach((parent: any) => {
                        if (parent.isParent) {
                            parent.subTasks = subtasks.filter(st => st.parentTaskId === parent.id);
                        } else {
                            parent.subTasks = [];
                        }
                    });
                }
            }

            return { ...result, facets: (result as any).facets || emptyFacets };
        }

        const isSorting = opts.sorts && opts.sorts.length > 0;

        if ((!isSorting || opts.view_mode === "gantt") && !opts.onlySubtasks && !opts.excludeParents && (hasExplicitFilters || (hierarchyMode === "parents" || !hierarchyMode))) {
            strategy = opts.includeSubTasks ? "FILTERED_RECURSIVE_HIERARCHY" : "FILTERED_HIERARCHY";
            const result = await _fetchFilteredHierarchy(
                workspaceId, userId, isAdmin,
                fullAccessProjectIds, restrictedProjectIds, opts
            );

            return { ...result, facets: (result as any).facets || emptyFacets };
        }

        if (opts.groupBy === "status") {
            strategy = opts.includeSubTasks ? "KANBAN_RECURSIVE_HIERARCHY" : "KANBAN_SINGLE_QUERY";
            const baseWhere = buildWorkspaceFilterWhere({
                workspaceId,
                projectId: opts.projectId,
                assigneeId: toArray(opts.assigneeId),
                tagId: toArray(opts.tagId),
                search: opts.search,
                dueAfter: toUTCDateOnly(opts.dueAfter),
                dueBefore: opts.dueBefore ? addOneDayUTC(toUTCDateOnly(opts.dueBefore)!) : undefined,
                isAdmin,
                fullAccessProjectIds,
                restrictedProjectIds,
                cursor: opts.cursor,
                onlyParents: opts.hierarchyMode === "parents",
                onlySubtasks: opts.hierarchyMode === "children",
                excludeParents: opts.excludeParents,
                includeSubTasks: opts.includeSubTasks,
                view_mode: opts.view_mode,
            }, userId);

            const countWhere = JSON.parse(JSON.stringify(baseWhere));
            // Only remove cursor conditions from AND, NOT permission scoping
            if (Array.isArray(countWhere.AND)) {
                countWhere.AND = countWhere.AND.filter((cond: any) =>
                    !cond.OR || !cond.OR.some((c: any) => c.createdAt && (c.createdAt.lt || c.createdAt.gt))
                );
                if (countWhere.AND.length === 0) delete countWhere.AND;
            }

            const countsResult = await prisma.task.groupBy({
                by: ['status'],
                where: countWhere,
                _count: true
            });

            const statusCounts: Record<string, number> = {};
            countsResult.forEach(c => {
                if (c.status) statusCounts[c.status] = c._count;
            });

            const limit = opts.limit ?? 50;
            const tasks = await prisma.task.findMany({
                where: baseWhere,
                take: limit + 1,
                select: getTaskSelect(opts.view_mode),
                orderBy: buildOrderBy(opts.sorts)
            });

            const trueHasMore = tasks.length > limit;
            if (trueHasMore) tasks.pop();

            if (opts.includeSubTasks && tasks.length > 0) {
                const parentIds = tasks.filter(t => t.isParent).map(t => t.id);
                if (parentIds.length > 0) {
                    const hasFullAccess = isAdmin || (opts.projectId ? fullAccessProjectIds.includes(opts.projectId) : false);

                    // Resolve ProjectMember ID for robust filtering
                    const subtaskAssigneeIds: string[] = toArray(opts.assigneeId) || [];
                    if (!hasFullAccess && userId && opts.projectId) {
                        const pm = await prisma.projectMember.findFirst({
                            where: { projectId: opts.projectId, WorkspaceMember: { userId } },
                            select: { id: true }
                        });
                        if (pm) subtaskAssigneeIds.push(pm.id);
                    }

                    const subtasks = await prisma.task.findMany({
                        where: buildSubtaskExpansionWhere(undefined, {
                            parentIds,
                            status: toArray(opts.status),
                            assigneeId: subtaskAssigneeIds.length > 0 ? subtaskAssigneeIds : undefined,
                            tagId: toArray(opts.tagId),
                            search: opts.search,
                            dueAfter: toUTCDateOnly(opts.dueAfter),
                            dueBefore: opts.dueBefore ? addOneDayUTC(toUTCDateOnly(opts.dueBefore)!) : undefined,
                            userId,
                            isAdmin,
                            isRestrictedMember: !hasFullAccess
                        }),
                        select: getTaskSelect(opts.view_mode),
                        orderBy: buildOrderBy(opts.sorts)
                    });

                    tasks.forEach((parent: any) => {
                        if (parent.isParent) {
                            parent.subTasks = subtasks.filter(st => st.parentTaskId === parent.id);
                        } else {
                            parent.subTasks = [];
                        }
                    });
                }
            }

            const primarySort = opts.sorts?.[0];
            const lastTask = tasks.length > 0 ? (tasks[tasks.length - 1] as any) : null;

            const nextCursor: any = trueHasMore && lastTask
                ? primarySort && SORT_MAP[primarySort.field]
                    ? {
                        id: lastTask.id,
                        [SORT_MAP[primarySort.field].dbField]: lastTask[SORT_MAP[primarySort.field].dbField],
                    }
                    : { id: lastTask.id, createdAt: lastTask.createdAt }
                : null;

            return {
                tasks,
                totalCount: tasks.length,
                hasMore: trueHasMore,
                nextCursor,
                facets: {
                    ...emptyFacets,
                    statusCounts
                }
            };
        }

        strategy = "WORKSPACE_FLAT_FILTER";
        const filterResult = await _fetchWorkspaceFilter(
            workspaceId, userId, isAdmin,
            fullAccessProjectIds, restrictedProjectIds,
            {
                ...opts,
                onlyParents: opts.onlyParents || (!hasExplicitFilters && (hierarchyMode === "parents")),
                excludeParents: opts.excludeParents,
                onlySubtasks: opts.onlySubtasks || (!hasExplicitFilters && (isSorting || (hierarchyMode === "children")))
            }
        );

        return filterResult;
    } finally {
        const duration = performance.now() - startTime;
        if (duration > 50) {
            logger.serverPerf("GET_TASKS_INTERNAL", duration, {
                strategy,
                workspaceId,
                projectId: opts.projectId,
                groupBy: opts.groupBy,
                search: !!opts.search
            });
        }
    }
}

/**
 * Simple helper to map the new Prisma relation name back to 'assignee'
 * for UI compatibility. Handles recursive subtasks.
 */


// ============================================================
//  PUBLIC API  (React cache + Next.js unstable_cache)
// ============================================================
export const getTasks = cache(async (opts: GetTasksOptions, providedUserId?: string) => {
    const { workspaceId, projectId } = opts;

    if (opts.cursor && typeof opts.cursor.createdAt === 'string') {
        opts.cursor.createdAt = new Date(opts.cursor.createdAt);
    }

    const {
        permissions,
        isWorkspaceAdmin,
        authorizedProjectIds,
        fullAccessProjectIds,
        restrictedProjectIds
    } = await resolveTaskPermissions(workspaceId, projectId, providedUserId);

    // Guard: block access if the user is not a member AND not the workspace owner.
    // A workspace owner may not have a WorkspaceMember record if they created the workspace
    // without explicitly joining it, so we must allow them through if isWorkspaceAdmin is true.
    if (!permissions.WorkspaceMemberId && !isWorkspaceAdmin) {
        return {
            tasks: [],
            totalCount: 0,
            hasMore: false,
            nextCursor: null,
            facets: { status: {}, assignee: {}, tags: {}, projects: {} },
        };
    }
    if (!permissions.WorkspaceMemberId && !isWorkspaceAdmin && authorizedProjectIds.length === 0) {
        return {
            tasks: [],
            totalCount: 0,
            hasMore: false,
            nextCursor: null,
            facets: { status: {}, assignee: {}, tags: {}, projects: {} },
        };
    }

    // The effectiveUserId is the user making the request. For workspace owners who may
    // not have a WorkspaceMember record, we fall back to the providedUserId.
    const effectiveUserId = permissions.WorkspaceMember?.userId || providedUserId;
    if (!effectiveUserId) {
        return {
            tasks: [],
            totalCount: 0,
            hasMore: false,
            nextCursor: null,
            facets: { status: {}, assignee: {}, tags: {}, projects: {} },
        };
    }

    const sig = buildQuerySignature(workspaceId, projectId, { fullAccessProjectIds, restrictedProjectIds }, opts);
    const cacheKey = `tasks-v11-${workspaceId}-${isWorkspaceAdmin ? 'admin' : 'user'}-${effectiveUserId}-${sig}`;

    const tags = projectId
        ? CacheTags.projectTasks(projectId, effectiveUserId)
        : CacheTags.workspaceTasks(workspaceId, effectiveUserId);

    let res;
    if (providedUserId) {
        res = await _getTasksInternal(
            workspaceId,
            effectiveUserId,
            isWorkspaceAdmin,
            fullAccessProjectIds,
            restrictedProjectIds,
            opts
        );
    } else {
        res = await unstable_cache(
            () => _getTasksInternal(
                workspaceId,
                effectiveUserId,
                isWorkspaceAdmin,
                fullAccessProjectIds,
                restrictedProjectIds,
                opts
            ),
            [cacheKey],
            { tags, revalidate: 30 }
        )();
    }

    // Map for UI compatibility
    if (res && res.tasks) {
        res.tasks = res.tasks.map(mapTaskAssignee);
    }

    return res;
});

export type GetTasksResponse = Awaited<ReturnType<typeof getTasks>>;
export type GetTasksTask = NonNullable<GetTasksResponse>["tasks"][number];
