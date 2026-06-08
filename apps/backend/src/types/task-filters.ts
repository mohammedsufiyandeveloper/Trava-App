import { TaskStatus } from "@prisma/client";

/**
 * Comprehensive filter interface for Tasks
 * Supports both single-select and multi-select filtering
 */
export interface TaskFilters {
    /** Required: Always filter by workspace */
    workspaceId: string;

    /** Optional: Single project filter */
    projectId?: string;

    /** Status filter (single or multiple) */
    status?: TaskStatus | TaskStatus[];

    /** Assignee filter (single or multiple) */
    assigneeId?: string | string[];

    /** Tag filter (single or multiple) */
    tagId?: string | string[];

    /** Full-text search across name, description, taskSlug */
    search?: string;

    /** Filter by due date range */
    dueAfter?: Date;
    dueBefore?: Date;

    /** Filter by pinned status */
    isPinned?: boolean;

    /** Optional: Filter by specific parent task (use null for root) */
    parentTaskId?: string | null;

    /** Filter by creator */
    createdById?: string;
}

/**
 * Facet counts for dynamic filter options
 * Shows available options based on current filters
 */
export interface TaskFacets {
    /** Count of tasks per status */
    status: Record<string, number>;

    /** Count of tasks per assignee */
    assignee: Record<string, number>;

    /** Count of tasks per tag */
    tags: Record<string, number>;
}
