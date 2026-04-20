import { Prisma, TaskStatus } from"@prisma/client";
import { TaskFilters } from "@/types/task-filters";

/**
 * Builds an optimized Prisma WHERE clause for Task filtering
 * 
 * This function constructs index-friendly queries that leverage:
 * - Composite indexes: (projectId, status), (status, createdAt)
 * - Single-column indexes: workspaceId, assigneeId, tagId, isPinned
 * 
 * PostgreSQL will automatically use index intersection when beneficial.
 * 
 * @param filters - The filter criteria
 * @param authorizedProjectIds - Project IDs the user has access to (undefined = all projects)
 * @returns Prisma WHERE clause optimized for index usage
 */
export interface PermissionConfig {
    userId: string;
    isAdmin: boolean;
    authorizedProjectIds: string[];
    fullAccessIds: string[];
}

/**
 * Builds an optimized Prisma WHERE clause for Task filtering with security enforcement
 */
export function buildTaskFilter(
    filters: TaskFilters,
    permissions?: PermissionConfig
): Prisma.TaskWhereInput {
    // 1. Build common subtask conditions (status, assignee, tag, dates, search)
    const subtaskConditions = buildSubTaskConditions(filters);

    // Determine if we are in a "Filtering" context (Explicit UI filters)
    const hasExplicitFilters = Object.keys(subtaskConditions).length > 0;

    // Determine if we are in "Global Hierarchy" mode or "Search/Board" mode
    const isKanban = (filters as any)._forceSubTask;
    const isMemberOnlyMode = permissions && !permissions.isAdmin && permissions.fullAccessIds.length === 0;

    // hasActiveFilters determines if we pivot away from the "Root Parents" view
    const hasActiveFilters = hasExplicitFilters || isKanban || isMemberOnlyMode;

    // 2. Determine View Strategy
    const where: Prisma.TaskWhereInput = {
        workspaceId: filters.workspaceId,
    };

    const parentId = filters.parentTaskId;

    if (parentId === null) {
        // CASE A: Explicitly viewing ROOT (Parents only)
        where.parentTaskId = null;
        where.isParent = true;
    } else if (parentId) {
        // CASE B: Explicitly viewing children of a specific parent (folder)
        where.parentTaskId = parentId;
        where.isParent = false;
    } else if (isKanban) {
        // CASE C: Kanban Board (Always subtasks/work-items)
        where.parentTaskId = { not: null };
        where.isParent = false;
    } else if (hasExplicitFilters) {
        // CASE D: Search/Filter Mode (Return everything matching at any level)
        // We leave parentTaskId and isParent undefined to allow matches anywhere
    } else {
        // CASE E: Default Mode (No filters, no parent selected) -> Show Root Parents
        where.parentTaskId = null;
        where.isParent = true;
    }

    // 3. APPLY CONTENT FILTERS
    if (hasActiveFilters) {
        Object.assign(where, subtaskConditions);
    }

    // 4. APPLY PROJECT & PERMISSION FILTERS
    if (permissions) {
        const { isAdmin, authorizedProjectIds, fullAccessIds, userId } = permissions;
        const isMemberOnly = !isAdmin && fullAccessIds.length === 0;
        const isHybrid = !isAdmin && fullAccessIds.length > 0 && fullAccessIds.length < authorizedProjectIds.length;

        if (isMemberOnly) {
            // Strict Member: Project scope + Direct assignment
            where.projectId = { in: authorizedProjectIds };
            // Enforce via AND to avoid overwriting existing UI filters in 'where'
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : []),
                { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId } } }
            ];
        } else if (isHybrid) {
            // Hybrid: Full access to some, personal access to others
            const memberOnlyIds = authorizedProjectIds.filter(id => !fullAccessIds.includes(id));
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : []),
                {
                    OR: [
                        { projectId: { in: fullAccessIds } },
                        {
                            projectId: { in: memberOnlyIds },
                            ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId } }
                        }
                    ]
                }
            ];
        } else {
            // Admin / Lead: Just simple project scope
            where.projectId = { in: authorizedProjectIds };
        }
    } else if (filters.projectId) {
        // Fallback or explicit project filter without full permission block
        where.projectId = filters.projectId;
    }

    return where;
}

/**
 * Builds the conditions for filtering subtasks directly
 */
export function buildSubTaskConditions(filters: TaskFilters): any {
    const conditions: any = {};

    // ============================================================
    // STATUS FILTER
    // ============================================================
    if (filters.status) {
        if (Array.isArray(filters.status) && filters.status.length > 0) {
            conditions.status = { in: filters.status };
        } else if (!Array.isArray(filters.status)) {
            conditions.status = filters.status;
        }
    }

    // ============================================================
    // ASSIGNEE FILTER: Support both ProjectMemberId and User ID (relational)
    // ============================================================
    if (filters.assigneeId) {
        const assigneeVal = Array.isArray(filters.assigneeId) ? { in: filters.assigneeId } : filters.assigneeId;
        conditions.OR = [
            { assigneeId: assigneeVal },
            { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: (Array.isArray(filters.assigneeId) ? { in: filters.assigneeId } : filters.assigneeId) as any } } }
        ];
    }

    // ============================================================
    // TAG FILTER
    // ============================================================
    if (filters.tagId) {
        if (Array.isArray(filters.tagId) && filters.tagId.length > 0) {
            conditions.tagId = { in: filters.tagId };
        } else if (!Array.isArray(filters.tagId)) {
            conditions.tagId = filters.tagId;
        }
    }

    // ============================================================
    // ============================================================
    // ============================================================
    // DATE RANGE FILTERS (Strict Due Date)
    // ============================================================
    if (filters.dueAfter || filters.dueBefore) {
        conditions.dueDate = {
            ...(filters.dueAfter ? { gte: filters.dueAfter } : {}),
            ...(filters.dueBefore ? { lte: filters.dueBefore } : {}),
            not: null
        };
    }

    // ============================================================
    // FULL-TEXT SEARCH
    // ============================================================
    if (filters.search && filters.search.trim().length > 0) {
        const searchTerm = filters.search.trim();

        const searchOR = [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { taskSlug: { contains: searchTerm, mode: 'insensitive' } },
        ];

        if (conditions.OR) {
            // If we already have an OR (from dates), we must wrap everything in AND to avoid conflict
            const currentOR = conditions.OR;
            delete conditions.OR;
            conditions.AND = [
                ...(conditions.AND || []),
                { OR: currentOR },
                { OR: searchOR }
            ];
        } else {
            conditions.OR = searchOR;
        }
    }

    return conditions;
}

/**
 * Builds a WHERE clause for facet counting (excludes the facet being counted)
 * 
 * Example: When counting available statuses, we exclude the current status filter
 * so users can see "what other statuses exist in the filtered dataset"
 */
export function buildFacetFilter(
    filters: TaskFilters,
    excludeFacet: 'status' | 'assigneeId' | 'tagId',
    permissions?: PermissionConfig
): Prisma.TaskWhereInput {
    const facetFilters = { ...filters };

    // Remove the facet we're counting
    delete (facetFilters as any)[excludeFacet];

    return buildTaskFilter(facetFilters, permissions);
}

/**
 * Calculates the effective due date for a task consistently across the app.
 * Logic: Priority is explicit dueDate > (startDate + days) > null
 */
export function calculateEffectiveDueDate(task: {
    dueDate?: Date | string | null;
    startDate?: Date | string | null;
    days?: number | null
}): Date | null {
    if (task.dueDate) return new Date(task.dueDate);

    if (task.startDate && task.days) {
        const start = new Date(task.startDate);
        const due = new Date(start);
        due.setDate(due.getDate() + task.days);
        return due;
    }

    return null;
}

