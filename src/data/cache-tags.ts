/**
 * Centralized Cache Tags Management
 * 
 * This file defines all cache tags used across the application.
 * Using centralized tag generation ensures consistency and prevents duplicates.
 * 
 * @example
 * ```typescript
 * import { CacheTags } from '@/data/cache-tags';
 * 
 * unstable_cache(
 *   async () => fetchData(),
 *   ['cache-key'],
 *   { tags: CacheTags.project(projectId) }
 * )
 * ```
 */

/**
 * Cache Tags Generator
 * All cache tags should be generated through these functions
 */
export const CacheTags = {
    // ============================================
    // WORKSPACE TAGS
    // ============================================

    /**
     * Tag for a specific workspace
     * Use when: Workspace data changes
     */
    workspace: (workspaceId: string) => [`workspace-${workspaceId}`],

    /**
     * Tag for user's workspaces
     * Use when: User joins/leaves workspaces
     */
    userWorkspaces: (userId: string) => [`user-workspaces-${userId}`, 'workspaces'],

    /**
     * Tag for workspace members
     * Use when: Members are added/removed from workspace
     */
    workspaceMembers: (workspaceId: string) => [`workspace-members-${workspaceId}`],

    /**
     * Tag for workspace admin checks
     * Use when: User roles change in workspace
     */
    workspaceAdmin: (workspaceId: string) => [`workspace-admin-${workspaceId}`],

    // ============================================
    // PROJECT TAGS
    // ============================================

    /**
     * Tag for a specific project
     * Use when: Project data changes
     */
    project: (projectId: string) => [`project-${projectId}`],

    /**
     * Tag for project by slug
     * Use when: Project slug or data changes
     */
    projectBySlug: (slug: string, workspaceId: string) => [
        `project-${slug}`,
        `workspace-projects-${workspaceId}`
    ],

    /**
     * Tag for all projects in a workspace
     */
    workspaceProjects: (workspaceId: string) => [`workspace-projects-${workspaceId}`],

    /**
     * Tag for full project data
     * Use when: Comprehensive project data changes
     */
    fullProject: (projectId: string) => [
        `full-project-${projectId}`,
        `project-${projectId}`
    ],

    /**
     * Tag for user's projects in a workspace
     * Use when: User project access changes
     */
    userProjects: (userId: string, workspaceId: string) => [
        `user-projects-${userId}`,
        `workspace-projects-${workspaceId}`
    ],

    /**
     * Tag for project members
     * Use when: Project members are added/removed
     */
    projectMembers: (projectId: string) => [`project-members-${projectId}`],

    /**
     * Tag for project client
     * Use when: Project client data changes
     */
    projectClient: (projectId: string) => [
        `project-client-${projectId}`,
        `project-${projectId}`
    ],

    // ============================================
    // TASK TAGS
    // ============================================

    /**
     * Tag for a specific task
     * Use when: Task data changes
     */
    task: (taskId: string) => [`task-${taskId}`],

    /**
     * Tag for task details
     * Use when: Detailed task data changes
     */
    taskDetails: (taskId: string, projectId: string) => [
        `task-${taskId}`,
        `project-tasks-${projectId}`,
        'task-details'
    ],

    /**
     * Tag for project tasks
     * Use when: Tasks are created/updated/deleted in a project
     */
    projectTasks: (projectId: string, userId?: string) => {
        const tags = [`project-tasks-${projectId}`];
        if (userId) tags.push(`project-tasks-user-${userId}`);
        return tags;
    },

    /**
     * Tag for parent tasks only
     * Use when: Parent tasks change
     */
    parentTasksOnly: (projectId: string, userId: string) => [
        `project-tasks-${projectId}`,
        `project-tasks-user-${userId}`,
        'parent-tasks-only'
    ],

    /**
     * Tag for workspace tasks
     * Use when: Tasks change in any project within workspace
     */
    workspaceTasks: (workspaceId: string, userId?: string) => {
        const tags = [`workspace-tasks-${workspaceId}`];
        if (userId) tags.push(`workspace-tasks-user-${userId}`);
        return tags;
    },

    // ============================================
    // SUBTASK TAGS
    // ============================================

    /**
     * Tag for a specific subtask
     * Use when: Subtask data changes
     */
    subtask: (subTaskId: string) => [`subtask-${subTaskId}`],

    /**
     * Tag for task subtasks
     * Use when: Subtasks are created/updated/deleted under a task
     */
    taskSubTasks: (parentTaskId: string, workspaceMemberId?: string) => {
        const tags = [`task-subtasks-${parentTaskId}`];
        if (workspaceMemberId) tags.push(`task-subtasks-member-${workspaceMemberId}`);
        return tags;
    },

    /**
     * Tag for project subtasks
     * Use when: Subtasks change in a project
     */
    projectSubTasks: (projectId: string) => [
        `project-tasks-${projectId}`,
        `project-subtasks-${projectId}`,
    ],

    /**
     * Tag for subtasks by status (Kanban)
     * Use when: Subtask status changes
     */
    subtasksByStatus: (projectId: string, status: string, parentTaskId?: string) => {
        const tags = [
            `project-subtasks-${projectId}`,
            `project-subtasks-status-${status}`,
            `project-tasks-${projectId}`,
        ];
        if (parentTaskId) tags.push(`task-subtasks-${parentTaskId}`);
        return tags;
    },

    // ============================================
    // COMMENT TAGS
    // ============================================

    /**
     * Tag for task comments
     * Use when: Comments are created/updated/deleted
     */
    taskComments: (taskId: string) => [
        `task-comments-${taskId}`,
        `task-${taskId}`,
    ],

    /**
     * Tag for activities
     * Use when: Activities change
     */
    activities: (subTaskId: string) => [
        `activities-${subTaskId}`,
        `subtask-${subTaskId}`,
    ],

    // ============================================
    // TAG TAGS (for workspace tags feature)
    // ============================================

    /**
     * Tag for workspace tags
     * Use when: Tags are created/updated/deleted
     */
    workspaceTags: (workspaceId: string) => [`workspace-tags-${workspaceId}`],

    // ============================================
    // PERMISSION TAGS
    // ============================================

    /**
     * Tag for user permissions
     * Use when: User permissions change
     */
    userPermissions: (userId: string, workspaceId: string, projectId?: string) => {
        const tags = [`user-permissions-${userId}-${workspaceId}`];
        if (projectId) tags.push(`user-permissions-${userId}-${projectId}`);
        return tags;
    },

    /**
     * Tag for admin check
     * Use when: Admin status changes
     */
    adminCheck: (userId: string) => [`admin-check-${userId}`],

    // ============================================
    // COMBINED TAGS
    // ============================================

    /**
     * Tag for workspace task creation data
     * Use when: Any data needed for task creation changes
     */
    workspaceTaskCreationData: (workspaceId: string, userId: string) => [
        `workspace-task-creation-data-${workspaceId}-${userId}`,
        `workspace-tasks-${workspaceId}`,
    ],
} as const;

/**
 * Type-safe cache tag arrays
 */
export type CacheTagArray = readonly string[];

/**
 * Helper to combine multiple tag arrays
 */
export function combineTags(...tagArrays: CacheTagArray[]): string[] {
    return Array.from(new Set(tagArrays.flat()));
}

/**
 * Helper to add custom tags to generated tags
 */
export function withCustomTags(baseTags: CacheTagArray, ...customTags: string[]): string[] {
    return combineTags(baseTags, customTags);
}
