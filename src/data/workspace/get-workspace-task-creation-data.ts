"use server";

const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
const unstable_cache = (..._args: any[]) => {}; // next/cache no-op
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { getUserProjects } from "@/data/project/get-projects";
import { getWorkspaceMembers } from "@/data/workspace/get-workspace-members";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import { CacheTags } from "@/data/cache-tags";

/**
 * Optimized data structure for workspace-level task creation
 */
export interface WorkspaceTaskCreationData {
    projects: Array<{
        id: string;
        name: string;
    }>;
    members: Array<{
        id: string;
        WorkspaceMember: {
            id: string;
            user: {
                id: string;
                surname: string | null;
            };
        };
    }>;
    tags: Array<{
        id: string;
        name: string;
    }>;
    parentTasks: Array<{
        id: string;
        name: string;
        projectId: string;
    }>;
    permissions: {
        isWorkspaceAdmin: boolean;
        canCreateTasks: boolean;
        canCreateSubTasks: boolean;
    };
}

/**
 * Internal function to fetch all data needed for workspace-level task creation
 * Respects user permissions and access levels
 */
async function _getWorkspaceTaskCreationDataInternal(
    workspaceId: string,
    userId: string
): Promise<WorkspaceTaskCreationData> {
    // Get user permissions first
    const permissions = await getWorkspacePermissions(workspaceId);

    if (!permissions.WorkspaceMemberId) {
        // User is not a member of this workspace
        return {
            projects: [],
            members: [],
            tags: [],
            parentTasks: [],
            permissions: {
                isWorkspaceAdmin: false,
                canCreateTasks: false,
                canCreateSubTasks: false,
            },
        };
    }

    // Fetch all data in parallel
    const [projectsData, membersData, tagsData] = await Promise.all([
        getUserProjects(workspaceId), // Already filtered by user access
        getWorkspaceMembers(workspaceId),
        getWorkspaceTags(workspaceId),
    ]);

    // Map projects to simple format
    const projects = projectsData.map(p => ({
        id: p.id,
        name: p.name,
    }));

    // Map members to required format
    const members = membersData.workspaceMembers.map(m => ({
        id: m.id,
        WorkspaceMember: {
            id: m.id,
            user: {
                id: m.user?.id || "",
                surname: m.user?.surname || null,
            },
        },
    }));

    // Map tags to simple format
    const tags = tagsData.map(tag => ({
        id: tag.id,
        name: tag.name,
    }));

    // Optimized: Fetch parent tasks from ALL accessible projects in a single query
    // instead of calling getTasks() multiple times in a loop.
    const projectIds = projectsData.map(p => p.id);
    const parentTasksData = await prisma.task.findMany({
        where: {
            workspaceId,
            projectId: { in: projectIds },
            parentTaskId: null, // Only parents
        },
        select: {
            id: true,
            name: true,
            projectId: true,
        },
        take: 500, // Reasonable cap for dropdown list
        orderBy: { createdAt: 'desc' }
    });

    const parentTasks = parentTasksData.map(task => ({
        id: task.id,
        name: task.name,
        projectId: task.projectId!,
    }));

    return {
        projects,
        members,
        tags,
        parentTasks,
        permissions: {
            isWorkspaceAdmin: permissions.isWorkspaceAdmin,
            canCreateTasks: permissions.isWorkspaceAdmin, // Only admins can create parent tasks at workspace level
            canCreateSubTasks: true, // All members can create subtasks
        },
    };
}

/**
 * Cached version with Next.js unstable_cache
 * Cache key includes userId to ensure user-specific data
 */
const getCachedWorkspaceTaskCreationData = (workspaceId: string, userId: string) =>
    unstable_cache(
        async () => _getWorkspaceTaskCreationDataInternal(workspaceId, userId),
        [`workspace-task-creation-data-${workspaceId}-${userId}`],
        {
            tags: CacheTags.workspaceTaskCreationData(workspaceId, userId),
            revalidate: 60, // 1 minute
        }
    )();

/**
 * Public API - Get all data needed for workspace-level task creation
 * 
 * This function fetches and caches data based on user permissions:
 * - Workspace Admins: See all projects, members, and parent tasks
 * - Regular Members: See only projects they're assigned to and related data
 * 
 * Data includes:
 * - Projects (filtered by user access)
 * - Workspace members
 * - Workspace tags
 * - Parent tasks (from accessible projects only)
 * - User permissions
 * 
 * @param workspaceId - The workspace ID
 * @returns Permission-filtered data for task creation forms
 * 
 * @example
 * ```typescript
 * const data = await getWorkspaceTaskCreationData(workspaceId);
 * 
 * if (data.permissions.canCreateTasks) {
 *   // Show Create Task button
 * }
 * 
 * if (data.permissions.canCreateSubTasks) {
 *   // Show Create SubTask button
 * }
 * ```
 */
export const getWorkspaceTaskCreationData = cache(
    async (workspaceId: string): Promise<WorkspaceTaskCreationData> => {
        const user = await requireUser();

        try {
            return await getCachedWorkspaceTaskCreationData(workspaceId, user.id);
        } catch (error) {
            console.error("Error fetching workspace task creation data:", error);
            // Return empty data structure on error
            return {
                projects: [],
                members: [],
                tags: [],
                parentTasks: [],
                permissions: {
                    isWorkspaceAdmin: false,
                    canCreateTasks: false,
                    canCreateSubTasks: false,
                },
            };
        }
    }
);

export type WorkspaceTaskCreationDataType = Awaited<ReturnType<typeof getWorkspaceTaskCreationData>>;
