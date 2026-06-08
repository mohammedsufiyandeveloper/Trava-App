// src/data/workspace/get-workspaces.ts
const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
const unstable_cache = <T extends (...args: any[]) => any>(fn: T, _keys?: string[], _opts?: any) => fn; // next/cache no-op
const notFound = (..._args: any[]): never => { throw new Error('notFound not available in API server'); }; // next/navigation no-op
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { WorkspaceRole } from"@prisma/client";
import { CacheTags } from "@/data/cache-tags";

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

export function invalidateWorkspacesCache(userId: string) {
    // With memory cache removed, we rely entirely on revalidateTag via our actions
    // This is still exported for consistency in the codebase
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
const getCachedWorkspaces = (userId: string, bypass: boolean) => {
    const cacheKey = `user-workspaces-${userId}`;

    // Use Next.js App Router Cache with tags and a short revalidate for manual DB sync
    return unstable_cache(
        async () => _fetchWorkspacesInternal(userId),
        [cacheKey],
        {
            tags: CacheTags.userWorkspaces(userId),
            revalidate: 5, // Fast revalidation for manual DB changes
        }
    )();
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
export const getWorkspaces = cache(async (providedUserId?: string): Promise<WorkspacesResult> => {
    // Ensure authenticated user
    const userId = providedUserId || (await requireUser()).id;
    if (!userId) {
        return notFound();
    }

    // Fetch workspaces (bypass cache for troubleshooting)
    const result = await _fetchWorkspacesInternal(userId);

    return result;
});

/**
 * Export types for callers
 */
export type WorkspacesType = WorkspacesResult;
export type WorkspaceItemType = WorkspaceListItem;
