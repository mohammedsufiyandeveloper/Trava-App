"use server";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags, combineTags } from "@/data/cache-tags";

import { ProjectRole } from"@prisma/client";

/**
 * NormalMember shape for UI components
 */
export type NormalMember = {
    id: string; // userId
    userId: string;
    projectRole?: ProjectRole;
    projectMemberId: string;
    user: {
        id: string;
        name: string | null;
        surname: string | null;
        email?: string;
        image?: string | null;
    };
    workspaceRole?: string;
};

/**
 * Internal function to fetch project members
 * Supports both single project and workspace-wide unique members
 */
async function _getProjectMembersInternal(params: { projectId?: string; workspaceId?: string }) {
    const { projectId, workspaceId } = params;

    if (!projectId && !workspaceId) {
        throw new Error("Either projectId or workspaceId must be provided");
    }

    const projectMembers = await prisma.projectMember.findMany({
        where: projectId ? { projectId } : { project: { workspaceId } },
        select: {
            id: true,
            projectRole: true,
            WorkspaceMember: {
                select: {
                    userId: true,
                    workspaceRole: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            surname: true,
                            email: true,
                        }
                    }
                }
            }
        }
    });

    // Normalize to unique members by userId
    const uniqueMembers = new Map<string, NormalMember>();
    projectMembers.forEach(m => {
        const user = m.WorkspaceMember?.user;
        const userId = m.WorkspaceMember?.userId;

        if (user && userId && !uniqueMembers.has(userId)) {
            uniqueMembers.set(userId, {
                id: userId,
                userId: userId,
                projectMemberId: m.id,
                projectRole: m.projectRole as ProjectRole,
                user: user,
                workspaceRole: m.WorkspaceMember?.workspaceRole
            });
        }
    });


    return Array.from(uniqueMembers.values());
}


/**
 * Cached version using Next.js unstable_cache
 */
const getCachedProjectMembers = (params: { projectId?: string; workspaceId?: string }) => {
    const cacheKey = params.projectId
        ? [`project-members-${params.projectId}`]
        : [`workspace-project-members-${params.workspaceId}`];

    const tags = params.projectId
        ? CacheTags.projectMembers(params.projectId)
        : combineTags(CacheTags.workspace(params.workspaceId!), ["project-members"]);

    return unstable_cache(
        async () => _getProjectMembersInternal(params),
        cacheKey,
        {
            tags,
            revalidate: 60,
        }
    )();
};

/**
 * Unified function to get project members
 * Usage: 
 *   getProjectMembers(projectId) 
 *   getProjectMembers({ workspaceId })
 */
export const getProjectMembers = cache(async (arg: string | { workspaceId: string; projectId?: string }) => {
    await requireUser();

    const params = typeof arg === "string" ? { projectId: arg } : arg;

    try {
        return await getCachedProjectMembers(params);
    } catch (error) {
        console.error("Error fetching project members:", error);
        return [];
    }
});

export type ProjectMembersType = Awaited<ReturnType<typeof getProjectMembers>>;
