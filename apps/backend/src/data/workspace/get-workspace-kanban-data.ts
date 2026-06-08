const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
const unstable_cache = <T extends (...args: any[]) => any>(fn: T, _keys?: string[], _opts?: any) => fn; // next/cache no-op
import prisma from "@/lib/db";
import { CacheTags } from "@/data/cache-tags";


/**
 * Fetches and groups all project members in a workspace.
 * Highly optimized for Kanban project filtering.
 */
async function _fetchWorkspaceProjectMembersInternal(workspaceId: string) {
    const projectMembers = await prisma.projectMember.findMany({
        where: {
            project: { workspaceId }
        },
        select: {
            projectId: true,
            WorkspaceMember: {
                select: { userId: true }
            }
        }
    });

    const projectUserMap: Record<string, string[]> = {};
    projectMembers.forEach(pm => {
        if (!projectUserMap[pm.projectId]) {
            projectUserMap[pm.projectId] = [];
        }
        projectUserMap[pm.projectId].push((pm as any).WorkspaceMember.userId);
    });

    return projectUserMap;
}

export const getWorkspaceProjectMembersMap = cache(async (workspaceId: string) => {
    return await unstable_cache(
        () => _fetchWorkspaceProjectMembersInternal(workspaceId),
        [`workspace-pm-map-${workspaceId}`],
        {
            tags: [CacheTags.workspaceProjects(workspaceId)[0], `workspace-${workspaceId}-pm-map`],
            revalidate: 300
        }
    )();
});

/**
 * Fetches all project managers in a workspace for Kanban attribution.
 */
async function _fetchWorkspaceProjectManagersInternal(workspaceId: string) {
    const managers = await prisma.projectMember.findMany({
        where: {
            project: { workspaceId },
            projectRole: "PROJECT_MANAGER",
            hasAccess: true,
            WorkspaceMember: {
                workspaceRole: {
                    notIn: ["OWNER", "ADMIN"]
                }
            }
        },
        select: {
            projectId: true,
            WorkspaceMember: {
                select: {
                    user: {
                        select: { id: true, surname: true }
                    }
                }
            }
        }
    });

    const pmMap: Record<string, Array<{ id: string, surname: string | null }>> = {};
    managers.forEach(m => {
        const user = (m as any).WorkspaceMember?.user;
        if (user) {
            if (!pmMap[m.projectId]) {
                pmMap[m.projectId] = [];
            }
            pmMap[m.projectId].push(user);
        }
    });

    return pmMap;
}

export const getWorkspaceProjectManagersMap = cache(async (workspaceId: string) => {
    return await unstable_cache(
        () => _fetchWorkspaceProjectManagersInternal(workspaceId),
        [`workspace-pm-leaders-map-${workspaceId}`],
        {
            tags: [CacheTags.workspaceProjects(workspaceId)[0], `workspace-${workspaceId}-pms`],
            revalidate: 300 // 5 minutes
        }
    )();
});
