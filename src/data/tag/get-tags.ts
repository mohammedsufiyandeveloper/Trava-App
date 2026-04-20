import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CacheTags } from "@/data/cache-tags";
import prisma from "@/lib/db";

/**
 * Get all tags for a workspace
 */
export const getWorkspaceTags = cache(async (workspaceId: string) => {
    return unstable_cache(
        async () => {
            try {
                const tags = await prisma.tag.findMany({
                    where: {
                        workspaceId,
                    },
                    orderBy: {
                        name: "asc",
                    },
                });

                return tags;
            } catch (error) {
                console.error("Error fetching workspace tags:", error);
                throw new Error("Failed to fetch workspace tags");
            }
        },
        [`workspace-tags-${workspaceId}`],
        {
            tags: CacheTags.workspaceTags(workspaceId),
            revalidate: 60 * 60 * 24, // 24 hours
        }
    )();
});

/**
 * Get all tags for a workspace with task counts
 */
export const getWorkspaceTagsWithCount = cache(async (workspaceId: string) => {
    return unstable_cache(
        async () => {
            try {
                const tags = await prisma.tag.findMany({
                    where: {
                        workspaceId,
                    },
                    include: {
                        _count: {
                            select: {
                                tasks: true,
                            },
                        },
                    },
                    orderBy: {
                        name: "asc",
                    },
                });

                return tags;
            } catch (error) {
                console.error("Error fetching workspace tags with count:", error);
                throw new Error("Failed to fetch workspace tags with count");
            }
        },
        [`workspace-tags-count-${workspaceId}`],
        {
            tags: CacheTags.workspaceTags(workspaceId),
            revalidate: 60 * 60 * 24, // 24 hours
        }
    )();
});

/**
 * Get a single tag by ID
 */
export async function getTagById(tagId: string) {
    try {
        const tag = await prisma.tag.findUnique({
            where: {
                id: tagId,
            },
        });

        return tag;
    } catch (error) {
        console.error("Error fetching tag:", error);
        throw new Error("Failed to fetch tag");
    }
}

/**
 * Check if a tag name already exists in the workspace
 */
export async function tagNameExists(workspaceId: string, name: string, excludeTagId?: string) {
    try {
        const tag = await prisma.tag.findFirst({
            where: {
                workspaceId,
                name: {
                    equals: name,
                    mode: "insensitive",
                },
                ...(excludeTagId && { id: { not: excludeTagId } }),
            },
        });

        return !!tag;
    } catch (error) {
        console.error("Error checking tag name:", error);
        throw new Error("Failed to check tag name");
    }
}
