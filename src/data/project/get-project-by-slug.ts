"use server";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags } from "@/data/cache-tags";

/**
 * Internal function to fetch project by slug or ID
 */
async function _getProjectBySlugInternal(workspaceId: string, slug: string) {
    return prisma.project.findFirst({
        where: {
            workspaceId,
            OR: [
                { slug },
                { id: slug }
            ]
        },
        select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            workspaceId: true,
            description: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

/**
 * Cached version using Next.js unstable_cache
 */
const getCachedProjectBySlug = (workspaceId: string, slug: string) =>
    unstable_cache(
        async () => _getProjectBySlugInternal(workspaceId, slug),
        [`project-${workspaceId}-${slug}`],
        {
            tags: CacheTags.projectBySlug(slug, workspaceId),
            revalidate: 60 // 1 minute - projects don't change often
        }
    )();

/**
 * Get a single project by slug or ID
 * 
 * Behavior:
 * - Validates user authentication
 * - Fetches project by slug or ID (cached)
 * - Returns null if project not found
 * 
 * Caching Strategy:
 * 1. React cache() - Deduplicates requests within the same render
 * 2. unstable_cache() - Persists data across requests for 1 minute
 * 
 * Cache Invalidation:
 * - Use revalidateTag(`project-${slug}`) to invalidate specific project
 * - Use revalidateTag(`workspace-${workspaceId}-projects`) to invalidate all workspace projects
 * 
 * @param workspaceId - The workspace ID
 * @param slug - The project slug or ID
 * @returns Project data or null if not found
 * 
 * @example
 * const project = await getProjectBySlug(workspaceId, "my-project");
 * if (project) {
 *   console.log(project.name);
 * }
 */
export const getProjectBySlug = cache(
    async (workspaceId: string, slug: string) => {
        await requireUser();

        try {
            return await getCachedProjectBySlug(workspaceId, slug);
        } catch (error) {
            console.error("Error fetching project by slug:", error);
            return null;
        }
    }
);

export type ProjectBySlugType = Awaited<ReturnType<typeof getProjectBySlug>>;
