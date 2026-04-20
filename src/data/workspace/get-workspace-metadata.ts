"use server";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";

/**
 * Lightweight workspace metadata for layouts
 * ONLY fetches minimal, static data needed for structure
 * 
 * This is layout-safe because it:
 * - Is wrapped in cache()
 * - Only fetches workspace name and ID
 * - Does NOT fetch mutable business data
 */
const METADATA_MEMORY_CACHE = new Map<string, { data: any, timestamp: number }>();
const MEMORY_TTL = 60000; // 60 seconds for metadata

function getMemoryMetadata(key: string) {
    const cached = METADATA_MEMORY_CACHE.get(key);
    if (cached && Date.now() - cached.timestamp < MEMORY_TTL) return cached.data;
    return null;
}

function setMemoryMetadata(key: string, data: any) {
    METADATA_MEMORY_CACHE.set(key, { data, timestamp: Date.now() });
    if (METADATA_MEMORY_CACHE.size > 200) METADATA_MEMORY_CACHE.clear();
}
async function _getWorkspaceMetadataInternal(workspaceId: string, userId: string) {
    // Verify workspace exists and user has access — run in parallel
    const [workspace, member] = await Promise.all([
        prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: {
                id: true,
                name: true,
            }
        }),
        prisma.workspaceMember.findFirst({
            where: {
                workspaceId,
                userId,
            },
            select: { id: true }
        })
    ]);

    if (!workspace || !member) return null;

    return {
        id: workspace.id,
        name: workspace.name,
        userId: userId,
    };
}

/**
 * Public function — returns lightweight workspace metadata
 */
export const getWorkspaceMetadata = cache(async (workspaceId: string, providedUserId?: string) => {
    const userId = providedUserId || (await requireUser()).id;
    const cacheKey = `metadata-${workspaceId}-${userId}`;

    // 1. Memory Cache
    const memory = getMemoryMetadata(cacheKey);
    if (memory) return memory;

    // 2. Next.js cache
    const fetchMetadata = unstable_cache(
        async () => _getWorkspaceMetadataInternal(workspaceId, userId),
        [`workspace-metadata-${workspaceId}-${userId}`],
        {
            tags: ["workspace-metadata", `workspace-${workspaceId}`],
            revalidate: 3600, // 1 hour - metadata rarely changes
        }
    );

    const result = await fetchMetadata();
    setMemoryMetadata(cacheKey, result);
    return result;
});

export type WorkspaceMetadata = Awaited<ReturnType<typeof getWorkspaceMetadata>>;
