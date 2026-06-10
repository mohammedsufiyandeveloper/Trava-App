"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags } from "@/data/cache-tags";
import { cached } from "@/lib/cache/runtime-cache";

/**
 * Get workspace-level permissions for the current user
 * Use this for workspace-level queries (no specific project)
 */
/**
 * Internal function to fetch workspace permissions
 */
async function _fetchWorkspacePermissionsInternal(workspaceId: string, userId: string): Promise<any> {
    try {
        const [workspace, workspaceMember, projectRoles] = await Promise.all([
            prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { ownerId: true }
            }),
            prisma.workspaceMember.findFirst({
                where: {
                    workspaceId: workspaceId,
                    userId: userId,
                },
                include: { user: { select: { name: true, surname: true } } }
            }),
            prisma.projectMember.findMany({
                where: {
                    WorkspaceMember: {
                        userId: userId,
                        workspaceId: workspaceId,
                    },
                },
                select: {
                    projectId: true,
                    projectRole: true,
                },
            }),
        ]);

        if (!workspaceMember && workspace?.ownerId !== userId) {
            return {
                isWorkspaceAdmin: false,
                canCreateProject: false,
                isProjectLead: false,
                hasAccess: false,
                WorkspaceMemberId: null,
                workspaceMemberId: null,
                WorkspaceMember: null,
                workspaceMember: null,
                leadProjectIds: [],
                managedProjectIds: [],
                memberProjectIds: []
            };
        }

        const isWorkspaceAdmin = workspace?.ownerId === userId || 
            workspaceMember?.workspaceRole === "OWNER" || 
            workspaceMember?.workspaceRole === "ADMIN" || 
            workspaceMember?.workspaceRole === "MANAGER";
        const canCreateProject = isWorkspaceAdmin;

        // projectRoles is now the result of the separate query
        const leadProjectIds = projectRoles.filter(p => p.projectRole === "LEAD").map(p => p.projectId);
        const managedProjectIds = projectRoles.filter(p => p.projectRole === "PROJECT_MANAGER").map(p => p.projectId);
        const memberProjectIds = projectRoles.filter(p => p.projectRole === "MEMBER").map(p => p.projectId);
        const viewerProjectIds = projectRoles.filter(p => p.projectRole === "VIEWER").map(p => p.projectId);

        const isProjectLead = leadProjectIds.length > 0;
        const isProjectManager = managedProjectIds.length > 0;
        const hasAccess = isWorkspaceAdmin || isProjectManager || isProjectLead || memberProjectIds.length > 0 || viewerProjectIds.length > 0;

        return {
            isWorkspaceAdmin,
            canCreateProject,
            isProjectLead,
            isProjectManager,
            hasAccess,
            leadProjectIds,
            managedProjectIds,
            memberProjectIds,
            viewerProjectIds,
            WorkspaceMemberId: workspaceMember?.id || null,
            workspaceMemberId: workspaceMember?.id || null,
            WorkspaceMember: workspaceMember || null,
            workspaceMember: workspaceMember || null,
        };
    } catch (error) {
        console.error("Error fetching workspace permissions:", error);
        return {
            isWorkspaceAdmin: false,
            canCreateProject: false,
            isProjectLead: false,
            hasAccess: false,
            leadProjectIds: [],
            WorkspaceMemberId: null,
            workspaceMemberId: null,
            WorkspaceMember: null,
            workspaceMember: null,
        };
    }
}

/**
 * Get workspace-level permissions for the current user
 */
export const getWorkspacePermissions = async (
    workspaceId: string,
    providedUserId?: string
): Promise<any> => {
    const userId = providedUserId || (await requireUser()).id;
    const cacheKey = `ws-perms-${workspaceId}-${userId}`;

    return cached(
        cacheKey,
        async () => _fetchWorkspacePermissionsInternal(workspaceId, userId),
        {
            tags: CacheTags.userPermissions(userId, workspaceId),
            ttlSeconds: 30,
        }
    );
};

/**
 * Get project-level permissions for the current user
 * Use this for project-specific queries
 */
/**
 * Internal function to fetch project permissions
 */
async function _getUserPermissionsInternal(
    workspaceId: string,
    projectId: string,
    userId: string
): Promise<any> {
    try {
        const [workspaceMember, projectMember] = await Promise.all([
            prisma.workspaceMember.findFirst({
                where: { workspaceId, userId },
                include: { user: { select: { name: true, surname: true } } }
            }),
            prisma.projectMember.findFirst({
                where: {
                    projectId,
                    WorkspaceMember: { userId },
                },
            }),
        ]);

        if (!workspaceMember) {
            return {
                isWorkspaceAdmin: false,
                isWorkspaceManager: false,
                isProjectManager: false,
                isProjectLead: false,
                isMember: false,
                canCreateSubTask: false,
                canPerformBulkOperations: false,
                WorkspaceMemberId: null,
                workspaceMemberId: null,
                WorkspaceMember: null,
                workspaceMember: null,
                projectMember: null,
            };
        }

        const isWorkspaceAdmin = workspaceMember.workspaceRole === "OWNER" || workspaceMember.workspaceRole === "ADMIN";
        const isWorkspaceManager = workspaceMember.workspaceRole === "MANAGER";
        const isProjectManager = projectMember?.projectRole === "PROJECT_MANAGER";
        const isProjectLead = projectMember?.projectRole === "LEAD";
        const isMember = !isWorkspaceAdmin && !isWorkspaceManager && !isProjectManager && !isProjectLead;
        
        const hasHighLevelAccess = isWorkspaceAdmin || isWorkspaceManager;
        const canCreateSubTask = hasHighLevelAccess || isProjectManager || isProjectLead;
        const canPerformBulkOperations = hasHighLevelAccess || isProjectManager || isProjectLead;

        return {
            isWorkspaceAdmin,
            isWorkspaceManager,
            isProjectManager,
            isProjectLead,
            isMember,
            canCreateSubTask,
            canPerformBulkOperations,
            WorkspaceMemberId: workspaceMember.id,
            workspaceMemberId: workspaceMember.id,
            WorkspaceMember: workspaceMember,
            workspaceMember: workspaceMember,
            projectMember,
        };
    } catch (error) {
        console.error("Error fetching user permissions:", error);
        return {
            isWorkspaceAdmin: false,
            isProjectManager: false,
            isProjectLead: false,
            isMember: false,
            canCreateSubTask: false,
            canPerformBulkOperations: false,
            WorkspaceMemberId: null,
            workspaceMemberId: null,
            WorkspaceMember: null,
            workspaceMember: null,
        };
    }
}

/**
 * Get project-level permissions for the current user
 */
export const getUserPermissions = async (
    workspaceId: string,
    projectId: string,
    providedUserId?: string
): Promise<any> => {
    const userId = providedUserId || (await requireUser()).id;
    const cacheKey = `proj-perms-${workspaceId}-${projectId}-${userId}`;

    return cached(
        cacheKey,
        async () => _getUserPermissionsInternal(workspaceId, projectId, userId),
        {
            tags: CacheTags.userPermissions(userId, workspaceId, projectId),
            ttlSeconds: 30,
        }
    );
};

export type WorkspacePermissionsType = Awaited<ReturnType<typeof getWorkspacePermissions>>;
export type UserPermissionsType = Awaited<ReturnType<typeof getUserPermissions>>;
