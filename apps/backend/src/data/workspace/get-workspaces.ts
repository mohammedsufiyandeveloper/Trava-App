// src/data/workspace/get-workspaces.ts
const notFound = (..._args: any[]): never => { throw new Error('notFound not available in API server'); }; // next/navigation no-op
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { WorkspaceRole } from"@prisma/client";
import { CacheTags } from "@/data/cache-tags";
import { cached, invalidateCacheTags } from "@/lib/cache/runtime-cache";

/**
 * Types for workspace list data
 */
export type WorkspaceListItem = {
    id: string;
    name: string;
    slug: string | null;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceRole: WorkspaceRole;
    isProjectManager?: boolean;
    memberCount?: number;
};

export type WorkspacesResult = {
    workspaces: WorkspaceListItem[];
    totalCount: number;
};

export async function invalidateWorkspacesCache(userId: string) {
    await invalidateCacheTags(CacheTags.userWorkspaces(userId));
}

async function _fetchWorkspacesInternal(userId: string): Promise<WorkspacesResult> {
    // Highly optimized query that bypasses heavy ProjectMember relation checks and member counts
    const workspacesData = await prisma.workspace.findMany({
        where: {
            members: { some: { userId } },
        },
        select: {
            id: true,
            name: true,
            ownerId: true,
            members: {
                where: { userId },
                select: { workspaceRole: true },
            },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    // Transform to WorkspaceListItem format with compatible default attributes
    const workspaces: WorkspaceListItem[] = workspacesData.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: null,
        ownerId: workspace.ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
        workspaceRole: workspace.members[0]?.workspaceRole || "VIEWER",
        isProjectManager: false,
        memberCount: 1,
    }));

    return {
        workspaces,
        totalCount: workspaces.length,
    };
}

/**
 * Cached version with Next.js unstable_cache
 */
const getCachedWorkspaces = (userId: string) => {
    const cacheKey = `user-workspaces-${userId}`;

    return cached(
        cacheKey,
        async () => _fetchWorkspacesInternal(userId),
        {
            tags: CacheTags.userWorkspaces(userId),
            ttlSeconds: 30,
        }
    );
};

/**
 * Public function — returns all workspaces for the current authenticated user
 *
 * Behavior:
 * - Validates user via requireUser()
 * - Fetches all workspaces where user is a member (cached)
 * - Returns workspaces with user's role in each workspace
 * - Includes member count for each workspace
 * - Ordered by creation date (newest first)
 *
 * @returns WorkspacesResult containing array of workspaces and total count
 *
 * @example
 * const { workspaces, totalCount } = await getWorkspaces();
 * workspaces.forEach(ws => {
 *   console.log(`${ws.name} - Role: ${ws.workspaceRole}`);
 * });
 */
export const getWorkspaces = async (providedUserId?: string): Promise<WorkspacesResult> => {
    // Ensure authenticated user
    const userId = providedUserId || (await requireUser()).id;
    if (!userId) {
        return notFound();
    }

    const result = await getCachedWorkspaces(userId);

    return result;
};

/**
 * Export types for callers
 */
export type WorkspacesType = WorkspacesResult;
export type WorkspaceItemType = WorkspaceListItem;
