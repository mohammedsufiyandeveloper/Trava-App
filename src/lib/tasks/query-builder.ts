import { Prisma } from "@prisma/client";

export function getTaskSelect(view_mode: string = "list"): Prisma.TaskSelect {
    const isList = view_mode === "list" || view_mode === "default" || !view_mode;
    const isKanban = view_mode === "kanban";
    const isGantt = view_mode === "gantt";
    const isCalendar = view_mode === "calendar";
    const isSearch = view_mode === "search";
    const isSubtask = view_mode === "subtask";

    // 1. Core fields required everywhere
    const select: Prisma.TaskSelect = {
        id: true,
        name: true,
        taskSlug: true,
        status: true,
        dueDate: true,
        subtaskCount: true,
        completedSubtaskCount: true,
        tagId: true,
        description: true,
        startDate: true,
        days: true,

        // Always include basic assignee info
        ProjectMember_Task_assigneeIdToProjectMember: {
            select: {
                id: true,
                WorkspaceMember: { select: { userId: true, user: { select: { id: true, name: true, surname: true } } } }
            }
        },

        createdAt: true,
        createdById: true,
        projectId: true,
        parentTaskId: true,
        isParent: true,
        assigneeId: true,
    };

    // Include detailed createdBy only if NOT in Gantt view to save on payload/joins
    if (!isGantt) {
        select.createdBy = {
            select: {
                id: true,
                WorkspaceMember: { select: { userId: true, user: { select: { id: true, surname: true } } } }
            }
        };
    }

    // 2. Metadata: Tags & Comment Counts
    // Uniformly added to most views for UI consistency
    if (isKanban || isList || isSearch || isGantt || isCalendar || isSubtask) {
        select._count = {
            select: {
                Activity: true,
                subTasks: true
            }
        };
        select.tag = { select: { id: true, name: true } };
    }

    // 3. Project & Parent Context
    // Essential for workspace views and search results
    if (isKanban || isSearch || isList || isGantt || isSubtask || isCalendar) {
        select.project = {
            select: {
                id: true,
                name: true,
                color: true,
                projectMembers: {
                    select: {
                        projectRole: true,
                        WorkspaceMember: {
                            select: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        surname: true,
                                        image: true,
                                        email: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
        select.parentTask = {
            select: { id: true, name: true }
        };
    }

    // 4. Extended Info: Description & Reviewer
    // Omit Reviewer for Gantt view to save on joins and payload size
    if (isList || isSearch || isSubtask || isCalendar) {
        select.reviewer = {
            select: {
                id: true,
                WorkspaceMember: { select: { userId: true, user: { select: { id: true, name: true, surname: true } } } }
            }
        };
    }

    // 5. specialized view fields
    if (isList || isGantt || isCalendar || isSubtask) {
        select.position = true;
    }

    if (isGantt) {
        select.Task_TaskDependency_A = {
            select: { id: true }
        };
    }

    return select;
}


// Keep a default for simple migrations
export const TASK_CORE_SELECT = getTaskSelect("list");

// ============================================================
//  TYPE: Cursor for pagination
// ============================================================
export interface TaskCursor {
    id: string;
    createdAt: Date;
}

// ============================================================
//  QUERY BUILDER: Project Root (Parent Tasks Only)
//  INDEX USED: (projectId, isParent, status, createdAt DESC)
// ============================================================
export function buildProjectRootWhere(
    projectId: string,
    opts: {
        status?: string[];
        assigneeId?: string | string[];   // null = unfiltered (admin/lead sees all)
        cursor?: TaskCursor;
        userId?: string;
        isAdmin?: boolean;
        fullAccessProjectIds?: string[];
    }
): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {
        projectId,
        isParent: true,     // ← prefix match on index col 2
        parentTaskId: null, // redundant safety guard
    };

    // Index col 3: status — include only when provided to allow partial scan
    if (opts.status && opts.status.length > 0) {
        where.status = { in: opts.status as any };
    }

    const assigneeClauses: Prisma.TaskWhereInput[] = [];
    const isRestricted = opts.userId && !opts.isAdmin && (!opts.fullAccessProjectIds || !opts.fullAccessProjectIds.includes(projectId));

    // If it's a restricted member, they MUST see only their tasks.
    // If an explicit assigneeId is provided, they MUST see only that person's tasks.
    // We combine these: if both are present, we use the explicit one (assuming it's a sub-filter of what they can see).
    const targetAssigneeId = opts.assigneeId || (isRestricted ? [opts.userId] : undefined);

    if (targetAssigneeId) {
        const ids = (Array.isArray(targetAssigneeId) ? targetAssigneeId : [targetAssigneeId]).filter((id): id is string => !!id);
        if (ids.length > 0) {
            assigneeClauses.push({
                OR: [
                    { assigneeId: { in: ids } },
                    { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: { in: ids } } } },
                    { subTasks: { some: { OR: [
                        { assigneeId: { in: ids } }, 
                        { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: { in: ids } } } }
                    ] } } }
                ]
            });
        }
    }

    if (assigneeClauses.length > 0) {
        if (where.AND) {
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : [where.AND]),
                ...assigneeClauses
            ];
        } else {
            where.AND = assigneeClauses;
        }
    }

    // Cursor pagination: keyed on (createdAt DESC, id)
    if (opts.cursor) {
        const cursorCondition = {
            OR: [
                { createdAt: { lt: opts.cursor.createdAt } },
                { createdAt: opts.cursor.createdAt, id: { lt: opts.cursor.id } },
            ]
        };

        if (where.AND) {
            (where.AND as any[]).push(cursorCondition);
        } else {
            where.AND = [cursorCondition];
        }
    }

    return where;
}

// ============================================================
//  QUERY BUILDER: Subtask Expansion (Children of a Parent)
//  INDEX USED: (parentTaskId, createdAt)
// ============================================================
export function buildSubtaskExpansionWhere(
    parentTaskId: string | undefined,
    opts: {
        parentIds?: string[];
        assigneeId?: string | string[];  // member constraint or filter
        status?: string[];
        tagId?: string[];
        search?: string;
        dueAfter?: Date;
        dueBefore?: Date;
        cursor?: TaskCursor;
        userId?: string;
        isAdmin?: boolean;
        isRestrictedMember?: boolean; // explicitly pass this for subtasks
    }
): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {};

    if (parentTaskId) {
        where.parentTaskId = parentTaskId;
    } else if (opts.parentIds && opts.parentIds.length > 0) {
        where.parentTaskId = { in: opts.parentIds };
    }

    // Status filter
    if (opts.status && opts.status.length > 0) {
        where.status = { in: opts.status as any };
    }

    // Tag filter
    if (opts.tagId && opts.tagId.length > 0) {
        where.tagId = { in: opts.tagId };
    }

    const assigneeClauses: Prisma.TaskWhereInput[] = [];

    // Combine restricted member filter and explicit assigneeId filter
    const targetAssigneeId = opts.assigneeId || (opts.isRestrictedMember ? [opts.userId] : undefined);

    if (targetAssigneeId) {
        const ids = (Array.isArray(targetAssigneeId) ? targetAssigneeId : [targetAssigneeId]).filter((id): id is string => !!id);
        if (ids.length > 0) {
            assigneeClauses.push({
                OR: [
                    { assigneeId: { in: ids } },
                    { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: { in: ids } } } }
                ]
            });
        }
    }

    if (assigneeClauses.length > 0) {
        if (where.AND) {
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : [where.AND]),
                ...assigneeClauses
            ];
        } else {
            where.AND = assigneeClauses;
        }
    }

    // Date filters
    if (opts.dueAfter || opts.dueBefore) {
        where.dueDate = {
            ...(opts.dueAfter ? { gte: opts.dueAfter } : {}),
            ...(opts.dueBefore ? { lt: opts.dueBefore } : {}),
        };
    }

    // Search filter
    if (opts.search && opts.search.trim().length > 0) {
        const q = opts.search.trim();
        where.OR = [
            { name: { contains: q, mode: "insensitive" } },
            { taskSlug: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
        ];
    }

    if (opts.cursor) {
        const cursorCondition = {
            OR: [
                { createdAt: { lt: opts.cursor.createdAt } },
                { createdAt: opts.cursor.createdAt, id: { lt: opts.cursor.id } },
            ]
        };
        where.AND = [
            ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
            cursorCondition
        ];
    }

    return where;
}

// ============================================================
//  QUERY BUILDER: Workspace Filter Search ("Search Mode")
//  INDEX USED: (workspaceId, assigneeId, status, createdAt)
//              OR (projectId, assigneeId, status, createdAt)
// ============================================================
export interface WorkspaceFilterOpts {
    workspaceId: string;
    projectId?: string;         // narrows to a project — uses project index
    assigneeId?: string | string[];
    status?: string[];
    tagId?: string | string[];
    dueBefore?: Date;
    dueAfter?: Date;
    search?: string;
    cursor?: TaskCursor;
    isAdmin?: boolean;
    fullAccessProjectIds?: string[];
    restrictedProjectIds?: string[];
    projectIds?: string[];
    onlyParents?: boolean;
    excludeParents?: boolean;
    onlySubtasks?: boolean;
    includeSubTasks?: boolean;
    view_mode?: string;
}

export function buildWorkspaceFilterWhere(
    opts: WorkspaceFilterOpts,
    userId: string
): Prisma.TaskWhereInput {
    const view_mode = opts.view_mode || "list";
    const isList = view_mode === "list" || view_mode === "default";
    const isKanban = view_mode === "kanban";
    const isGantt = view_mode === "gantt";
    const isSearch = view_mode === "search";
    const isCalendar = view_mode === "calendar";

    const where: Prisma.TaskWhereInput = {};

    // ─── Scope: which projects can these results come from? ─────────────
    if (opts.isAdmin) {
        // Workspace admin: scope to workspace and optionally narrow to projectId or projectIds
        where.workspaceId = opts.workspaceId;
        if (opts.projectId) {
            where.projectId = opts.projectId;
        } else if (opts.projectIds && opts.projectIds.length > 0) {
            where.projectId = { in: opts.projectIds };
        }
    } else {
        // Non-admin: enforce the access model:
        where.workspaceId = opts.workspaceId;

        let fullIds = opts.fullAccessProjectIds ?? [];
        let restrictedIds = opts.restrictedProjectIds ?? [];

        // Narrow authorized sets based on requested projectId or projectIds
        if (opts.projectId) {
            fullIds = fullIds.filter(id => id === opts.projectId);
            restrictedIds = restrictedIds.filter(id => id === opts.projectId);
        } else if (opts.projectIds && opts.projectIds.length > 0) {
            fullIds = fullIds.filter(id => opts.projectIds!.includes(id));
            restrictedIds = restrictedIds.filter(id => opts.projectIds!.includes(id));
        }

        if (fullIds.length === 0 && restrictedIds.length === 0) {
            where.id = { in: [] };
        } else if (restrictedIds.length === 0) {
            where.projectId = { in: fullIds };
        } else if (fullIds.length === 0) {
            where.projectId = { in: restrictedIds };

            if (opts.onlyParents || isKanban || isList || isGantt || isSearch) {
                // Parent visible if assigned OR if child is assigned
                where.OR = [
                    { assigneeId: userId as any },
                    { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: userId } } },
                    {
                        subTasks: {
                            some: {
                                OR: [
                                    { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: userId } } },
                                    { assigneeId: userId as any }
                                ]
                            }
                        }
                    }
                ];
            } else {
                where.OR = [
                    { assigneeId: userId as any },
                    { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: userId } } }
                ];
            }
        } else {
            // Mixed access
            const restrictedCondition: Prisma.TaskWhereInput = {
                projectId: { in: restrictedIds },
                OR: [
                    { assigneeId: userId as any },
                    { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: userId } } },
                    {
                        subTasks: {
                            some: {
                                OR: [
                                    { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: userId } } },
                                    { assigneeId: userId as any }
                                ]
                            }
                        }
                    }
                ]
            };

            where.AND = [
                {
                    OR: [
                        { projectId: { in: fullIds } },
                        restrictedCondition
                    ]
                }
            ];
        }
    }

    // ─── Apply User Filters ─────────────────────────────────────────────
    const applyFilter = (key: keyof Prisma.TaskWhereInput, values: any) => {
        if (!values || (Array.isArray(values) && values.length === 0)) return;
        const filterVal = Array.isArray(values) ? { in: values } : values;

        if (where[key]) {
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : (where.AND ? [where.AND] : [])),
                { [key]: filterVal }
            ];
        } else {
            (where as any)[key] = filterVal;
        }
    };

    applyFilter('status', opts.status);
    applyFilter('tagId', opts.tagId);

    // Filter by assignee: handle both direct ProjectMemberId and relational UserId
    if (opts.assigneeId) {
        const aVal = Array.isArray(opts.assigneeId) ? { in: opts.assigneeId } : opts.assigneeId;
        const aValRel = (Array.isArray(opts.assigneeId) ? { in: opts.assigneeId } : opts.assigneeId) as any;

        const assigneeFilter: Prisma.TaskWhereInput = {
            OR: [
                { assigneeId: aVal },
                { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: aValRel } } },
                { subTasks: { some: { OR: [{ assigneeId: aVal }, { ProjectMember_Task_assigneeIdToProjectMember: { WorkspaceMember: { userId: aValRel } } }] } } }
            ]
        };

        if (where.AND) {
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : [where.AND]),
                assigneeFilter
            ];
        } else {
            where.AND = [assigneeFilter];
        }
    }

    const hasFilters = !!(
        (opts.status && opts.status.length > 0) ||
        (opts.assigneeId) ||
        (opts.tagId) ||
        (opts.search && opts.search.trim().length > 0) ||
        opts.dueAfter ||
        opts.dueBefore
    );

    if (opts.onlyParents) {
        where.isParent = true;
        where.parentTaskId = null;
    } else if (opts.excludeParents || opts.onlySubtasks) {
        where.parentTaskId = { not: null };
        where.isParent = false;
    } else if (isList || isGantt || isCalendar) {
        // Default to hierarchy only if NO filters are active AND not explicitly including/excluding parents
        // Also skip this for Admins or specific project views to ensure we see everything
        if (!hasFilters && !opts.excludeParents && !opts.onlySubtasks && !opts.includeSubTasks && !opts.isAdmin && !opts.projectId) {
            where.isParent = true;
            where.parentTaskId = null;
        }
    }

    if (opts.dueAfter || opts.dueBefore) {
        where.dueDate = {
            ...(opts.dueAfter ? { gte: opts.dueAfter } : {}),
            ...(opts.dueBefore ? { lt: opts.dueBefore } : {}),
        };
    }

    if (opts.search && opts.search.trim().length > 0) {
        const q = opts.search.trim();
        const searchClause = [
            { name: { contains: q, mode: "insensitive" as const } },
            { taskSlug: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
        ];
        if (where.OR) {
            where.AND = [
                ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
                { OR: searchClause }
            ];
        } else {
            where.OR = searchClause;
        }
    }

    if (opts.cursor) {
        const cur = {
            OR: [
                { createdAt: { lt: opts.cursor.createdAt } },
                { createdAt: opts.cursor.createdAt, id: { lt: opts.cursor.id } },
            ]
        };
        where.AND = [
            ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
            cur
        ];
    }

    return where;
}
