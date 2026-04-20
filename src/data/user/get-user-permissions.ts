"use server";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags } from "@/data/cache-tags";

// 🚀 Emergency Performance Cache (Bypasses even next-cache overhead for 30s)
const PERMISSION_MEMORY_CACHE = new Map<string, { data: any, timestamp: number }>();
const MEMORY_TTL = 15000; // 15 seconds

function getMemoryCached<T>(key: string): T | null {
    const cached = PERMISSION_MEMORY_CACHE.get(key);
    if (cached && Date.now() - cached.timestamp < MEMORY_TTL) {
        return cached.data;
    }
    return null;
}

function setMemoryCached(key: string, data: any) {
    PERMISSION_MEMORY_CACHE.set(key, { data, timestamp: Date.now() });
    // Cleanup old items periodically (simple)
    if (PERMISSION_MEMORY_CACHE.size > 500) PERMISSION_MEMORY_CACHE.clear();
}

/**
 * Get workspace-level permissions for the current user
 * Use this for workspace-level queries (no specific project)
 */
/**
 * Internal function to fetch workspace permissions
 */
async function _fetchWorkspacePermissionsInternal(workspaceId: string, userId: string) {
    try {
        const [workspaceMember, projectRoles] = await Promise.all([
            prisma.workspaceMember.findFirst({
                where: {
                    workspaceId: workspaceId,
                    userId: userId,
                },
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

        if (!workspaceMember) {
            return {
                isWorkspaceAdmin: false,
                canCreateProject: false,
                isProjectLead: false,
                hasAccess: false,
                WorkspaceMemberId: null,
                WorkspaceMember: null,
                workspaceMember: null,
                leadProjectIds: [],
                managedProjectIds: [],
                memberProjectIds: []
            };
        }

        const isWorkspaceAdmin = workspaceMember.workspaceRole === "OWNER" || workspaceMember.workspaceRole === "ADMIN";
        const canCreateProject = isWorkspaceAdmin || workspaceMember.workspaceRole === "MANAGER";

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
            WorkspaceMemberId: workspaceMember.id,
            WorkspaceMember: workspaceMember,
            workspaceMember: workspaceMember,
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
            WorkspaceMember: null,
            workspaceMember: null,
        };
    }
}

/**
 * Get workspace-level permissions for the current user
 */
export const getWorkspacePermissions = cache(async (workspaceId: string, providedUserId?: string) => {
    // If userId is provided (e.g. from a Server Action), bypass requireUser to save ~1s
    const userId = providedUserId || (await requireUser()).id;
    const cacheKey = `ws-perms-${workspaceId}-${userId}`;

    // 1. FAST PATH: Memory Cache (0.1ms)
    const memoryCached = getMemoryCached<any>(cacheKey);
    if (memoryCached) return memoryCached;

    // 2. SERVER ACTION BYPASS: If providedUserId explicitly passed, skip Next.js disk cache overhead (~1s latency)
    if (providedUserId) {
        const directResult = await _fetchWorkspacePermissionsInternal(workspaceId, userId);
        setMemoryCached(cacheKey, directResult);
        return directResult;
    }

    // 3. SLOW PATH: Next.js Cache / Database (for pages/layouts)
    const fetchPerms = unstable_cache(
        async () => _fetchWorkspacePermissionsInternal(workspaceId, userId),
        [`workspace-perms-${workspaceId}-${userId}`],
        {
            tags: CacheTags.userPermissions(userId, workspaceId),
            revalidate: 60, // 1 minute
        }
    );

    const result = await fetchPerms();
    setMemoryCached(cacheKey, result);
    return result;
});

/**
 * Get project-level permissions for the current user
 * Use this for project-specific queries
 */
/**
 * Internal function to fetch project permissions
 */
async function _getUserPermissionsInternal(workspaceId: string, projectId: string, userId: string) {
    try {
        const [workspaceMember, projectMember] = await Promise.all([
            prisma.workspaceMember.findFirst({
                where: { workspaceId, userId },
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
            WorkspaceMember: null,
            workspaceMember: null,
        };
    }
}

/**
 * Get project-level permissions for the current user
 */
export const getUserPermissions = cache(async (workspaceId: string, projectId: string, providedUserId?: string) => {
    // If userId is provided (e.g. from a Server Action), bypass requireUser to save ~1s
    const userId = providedUserId || (await requireUser()).id;
    const cacheKey = `proj-perms-${projectId}-${userId}`;

    // 1. FAST PATH: Memory Cache (0.1ms)
    const memoryCached = getMemoryCached<any>(cacheKey);
    if (memoryCached) return memoryCached;

    // 2. SERVER ACTION BYPASS: If providedUserId explicitly passed, bypass Next.js disk cache overhead (~1s latency)
    if (providedUserId) {
        const directResult = await _getUserPermissionsInternal(workspaceId, projectId, userId);
        setMemoryCached(cacheKey, directResult);
        return directResult;
    }

    // 3. SLOW PATH: Next.js Cache / Database (for pages/layouts)
    const fetchPerms = unstable_cache(
        async () => _getUserPermissionsInternal(workspaceId, projectId, userId),
        [`project-perms-${projectId}-${userId}`],
        {
            tags: CacheTags.userPermissions(userId, workspaceId),
            revalidate: 60, // 1 minute
        }
    );

    const result = await fetchPerms();
    setMemoryCached(cacheKey, result);
    return result;
});

export type WorkspacePermissionsType = Awaited<ReturnType<typeof getWorkspacePermissions>>;
export type UserPermissionsType = Awaited<ReturnType<typeof getUserPermissions>>;
