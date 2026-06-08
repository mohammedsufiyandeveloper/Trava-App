
const revalidateTag = (tag: string, type?: string) => {
    // No-op in standalone Hono API server
};
import { CacheTags } from "@/data/cache-tags";

// ============================================
// WORKSPACE CACHE INVALIDATION
// ============================================

/**
 * Invalidate workspace data cache
 */
export async function invalidateWorkspace(workspaceId: string) {
    const tags = CacheTags.workspace(workspaceId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate user workspaces cache
 */
export async function invalidateUserWorkspaces(userId: string) {
    const tags = CacheTags.userWorkspaces(userId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate workspace members cache
 */
export async function invalidateWorkspaceMembers(workspaceId: string) {
    const tags = [
        ...CacheTags.workspaceMembers(workspaceId),
        ...CacheTags.workspace(workspaceId), // Ensure full workspace data is also updated
    ];
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate admin check cache for a specific user
 */
export async function invalidateAdminCheck(userId: string) {
    const tags = CacheTags.adminCheck(userId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate admin check cache for a workspace (all users)
 */
export async function invalidateWorkspaceAdminChecks(workspaceId: string) {
    const tags = CacheTags.workspaceAdmin(workspaceId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate workspace tags cache
 */
export async function invalidateWorkspaceTags(workspaceId: string) {
    const tags = CacheTags.workspaceTags(workspaceId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

// ============================================
// PROJECT CACHE INVALIDATION
// ============================================

/**
 * Invalidate user projects cache for a specific user
 */
export async function invalidateUserProjects(userId: string, workspaceId: string) {
    const tags = CacheTags.userProjects(userId, workspaceId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate all projects cache for a workspace
 */
export async function invalidateWorkspaceProjects(workspaceId: string) {
    (revalidateTag as any)(`workspace-projects-${workspaceId}`, 'layout');
}

/**
 * Invalidate both user and workspace project caches
 */
export async function invalidateProjectCaches(userId: string, workspaceId: string) {
    await invalidateUserProjects(userId, workspaceId);
    await invalidateWorkspaceProjects(workspaceId);
}

/**
 * Invalidate project data cache
 */
export async function invalidateProject(projectId: string) {
    const tags = CacheTags.project(projectId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate project members cache
 * Call this when project members are added, removed, or updated
 */
export async function invalidateProjectMembers(projectId: string) {
    const tags = [
        ...CacheTags.projectMembers(projectId),
        ...CacheTags.fullProject(projectId),
        ...CacheTags.project(projectId)
    ];
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate full project data cache
 */
export async function invalidateFullProject(projectId: string) {
    const tags = CacheTags.fullProject(projectId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

// ============================================
// TASK CACHE INVALIDATION
// ============================================

/**
 * Invalidate project tasks cache for a specific project
 * Call this when tasks are created, updated, or deleted
 */
export async function invalidateProjectTasks(projectId: string, userId?: string) {
    const tags = CacheTags.projectTasks(projectId, userId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate all project tasks cache
 * Use sparingly - only when needed for global changes
 */
export async function invalidateAllProjectTasks() {
    (revalidateTag as any)('project-tasks-all', 'layout');
}

/**
 * Invalidate workspace tasks cache for a specific workspace
 * Call this when tasks are created, updated, or deleted in any project within the workspace
 */
export async function invalidateWorkspaceTasks(workspaceId: string, userId?: string) {
    const tags = CacheTags.workspaceTasks(workspaceId, userId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate all workspace tasks cache
 * Use sparingly - only when needed for global changes
 */
export async function invalidateAllWorkspaceTasks() {
    (revalidateTag as any)('workspace-tasks-all', 'layout');
}

/**
 * Invalidate both project and workspace task caches
 * Call this on any task mutation to ensure both views are updated
 */
export async function invalidateTaskCaches(projectId: string, workspaceId: string, userId?: string) {
    await invalidateProjectTasks(projectId, userId);
    await invalidateWorkspaceTasks(workspaceId, userId);
}

/**
 * Invalidate specific task cache
 */
export async function invalidateTask(taskId: string) {
    const tags = CacheTags.task(taskId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate task details cache
 */
export async function invalidateTaskDetails(taskId: string, projectId: string) {
    const tags = CacheTags.taskDetails(taskId, projectId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

// ============================================
// SUBTASK CACHE INVALIDATION
// ============================================

/**
 * Invalidate subtasks cache for a specific parent task
 * Call this when subtasks are created, updated, or deleted
 */
export async function invalidateTaskSubTasks(parentTaskId: string, workspaceMemberId?: string) {
    const tags = CacheTags.taskSubTasks(parentTaskId, workspaceMemberId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate all subtasks cache
 * Use sparingly - only when needed for global changes
 */
export async function invalidateAllTaskSubTasks() {
    (revalidateTag as any)('task-subtasks-all', 'layout');
}

/**
 * Invalidate project subtasks cache
 */
export async function invalidateProjectSubTasks(projectId: string) {
    const tags = CacheTags.projectSubTasks(projectId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate specific subtask cache
 */
export async function invalidateSubTask(subTaskId: string) {
    const tags = CacheTags.subtask(subTaskId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate subtasks by status for a project
 */
export async function invalidateSubTasksByStatus(projectId: string, status: string, parentTaskId?: string) {
    const tags = CacheTags.subtasksByStatus(projectId, status, parentTaskId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

// ============================================
// COMMENT CACHE INVALIDATION
// ============================================

/**
 * Invalidate task comments cache for a specific task
 * Call this when comments are created, updated, or deleted
 */
export async function invalidateTaskComments(taskId: string) {
    const tags = CacheTags.taskComments(taskId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate all comments cache
 * Use sparingly - only when needed for global changes
 */
export async function invalidateAllComments() {
    (revalidateTag as any)('comments-all', 'layout');
}

/**
 * Invalidate activities cache for a specific subtask
 * Call this when activities are created or updated
 */
export async function invalidateActivities(subTaskId: string) {
    const tags = CacheTags.activities ? CacheTags.activities(subTaskId) : [`activities-${subTaskId}`];
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

/**
 * Invalidate all activities cache
 * Use sparingly - only when needed for global changes
 */
export async function invalidateAllActivities() {
    (revalidateTag as any)('activities-all', 'layout');
}

// ============================================
// PERMISSION CACHE INVALIDATION
// ============================================

/**
 * Invalidate user permissions cache
 */
export async function invalidateUserPermissions(userId: string, workspaceId: string, projectId?: string) {
    const tags = CacheTags.userPermissions(userId, workspaceId, projectId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}

// ============================================
// COMBINED CACHE INVALIDATION
// ============================================

/**
 * Invalidate workspace task creation data
 * Call this when any data needed for task creation changes
 */
export async function invalidateWorkspaceTaskCreationData(workspaceId: string, userId: string) {
    const tags = CacheTags.workspaceTaskCreationData(workspaceId, userId);
    tags.forEach(tag => (revalidateTag as any)(tag, 'layout'));
}


/**
 * Comprehensive invalidation for task mutations
 * Invalidates all related caches when a task is created, updated, or deleted
 */
export async function invalidateTaskMutation(params: {
    taskId?: string;
    projectId: string;
    workspaceId: string;
    userId?: string;
    parentTaskId?: string;
    involvedUserIds?: string[];
}) {
    const { taskId, projectId, workspaceId, userId, parentTaskId, involvedUserIds = [] } = params;

    const invalidations: Promise<void>[] = [];

    // Invalidate task-specific caches
    if (taskId) {
        invalidations.push(invalidateTask(taskId));
        invalidations.push(invalidateTaskDetails(taskId, projectId));
    }

    // Invalidate project and workspace caches for the mutator
    invalidations.push(invalidateTaskCaches(projectId, workspaceId, userId));

    // Invalidate for all involved users (e.g., old/new assignees)
    involvedUserIds.forEach(id => {
        if (id && id !== userId) {
            invalidations.push(invalidateTaskCaches(projectId, workspaceId, id));
        }
    });

    // Invalidate parent task subtasks if applicable
    if (parentTaskId) {
        // Invalidate the generic tag
        invalidations.push(invalidateTaskSubTasks(parentTaskId));

        // Invalidate user-specific tags for the subtask batch fetcher
        if (userId) {
            invalidations.push(invalidateTaskSubTasks(parentTaskId, userId));
        }
        involvedUserIds.forEach(id => {
            if (id && id !== userId) {
                invalidations.push(invalidateTaskSubTasks(parentTaskId, id));
            }
        });
    }

    // Invalidate workspace task creation data for all involved users
    if (userId) {
        invalidations.push(invalidateWorkspaceTaskCreationData(workspaceId, userId));
    }
    involvedUserIds.forEach(id => {
        if (id && id !== userId) {
            invalidations.push(invalidateWorkspaceTaskCreationData(workspaceId, id));
        }
    });

    // Invalidate workspace tags (since task counts might have changed)
    invalidations.push(invalidateWorkspaceTags(workspaceId));

    await Promise.all(invalidations);
}
