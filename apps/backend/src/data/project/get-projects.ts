"use server";

const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
const unstable_cache = <T extends (...args: any[]) => any>(fn: T, _keys?: string[], _opts?: any) => fn; // next/cache no-op
import prisma from "@/lib/db";
const notFound = (..._args: any[]): never => { throw new Error('notFound not available in API server'); }; // next/navigation no-op
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags } from "@/data/cache-tags";

/**
 * Project Visibility Rules (STRICT ENFORCEMENT):
 * 
 * OWNER/ADMIN:
 * - Can see ALL projects in the workspace
 * - Automatic visibility, no ProjectMember record needed
 * 
 * MANAGER:
 * - Can see ONLY:
 *   1. Projects they created (createdBy = userId)
 *   2. Projects where they are explicitly added as ProjectMember
 * 
 * MEMBER/VIEWER:
 * - Can see ONLY projects where they are added as ProjectMember
 */

// Internal function that does the actual data fetching
async function _getUserProjectsInternal(userId: string, workspaceId: string, lite = false) {
    const workspaceMember = await prisma.workspaceMember.findUnique({
        where: {
            userId_workspaceId: {
                userId,
                workspaceId,
            },
        },
        select: {
            id: true,
            workspaceRole: true,
            userId: true,
        },
    });

    if (!workspaceMember) {
        return null;
    }

    const isOwnerOrAdmin = workspaceMember.workspaceRole === "OWNER" ||
        workspaceMember.workspaceRole === "ADMIN";
    const isManager = workspaceMember.workspaceRole === "MANAGER";

    const projectSelect: any = lite ? {
        id: true,
        name: true,
        slug: true,
        color: true,
    } : {
        id: true,
        name: true,
        slug: true,
        color: true,
        description: true,
        createdBy: true,
        _count: {
            select: {
                projectMembers: true
            }
        },
        projectMembers: {
            select: {
                id: true,
                projectRole: true,
                WorkspaceMember: {
                    select: {
                        userId: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                surname: true,
                                image: true,
                                email: true,
                            }
                        }
                    }
                }
            }
        }
    };


    let projects;

    if (isOwnerOrAdmin) {
        projects = await prisma.project.findMany({
            where: { workspaceId },
            select: projectSelect,
            orderBy: [
                { createdAt: "desc" },
                { id: "desc" },
            ],
        });
    } else if (isManager) {
        projects = await prisma.project.findMany({
            where: {
                workspaceId,
                OR: [
                    { createdBy: userId },
                    {
                        projectMembers: {
                            some: {
                                WorkspaceMember: { userId: userId },
                                hasAccess: true,
                            },
                        },
                    },
                ],
            },
            select: projectSelect,
            orderBy: [
                { createdAt: "desc" },
                { id: "desc" },
            ],
        });
    } else {
        projects = await prisma.project.findMany({
            where: {
                workspaceId,
                projectMembers: {
                    some: {
                        WorkspaceMember: { userId: userId },
                        hasAccess: true,
                    },
                },
            },
            select: projectSelect,
            orderBy: [
                { createdAt: "desc" },
                { id: "desc" },
            ],
        });
    }

    return projects.map((project: any) => {
        if (lite) {
            return {
                id: project.id,
                name: project.name,
                slug: project.slug,
                color: project.color,
                description: undefined,
                createdBy: undefined,
                canManageMembers: undefined,
                memberCount: undefined,
                memberIds: undefined,
                projectManagers: undefined,
                isLead: undefined,
            };
        }

        const userProjectMember = project.projectMembers.find((m: any) => m.WorkspaceMember.userId === userId);
        const isProjectManager = userProjectMember?.projectRole === "PROJECT_MANAGER";
        const isProjectLead = userProjectMember?.projectRole === "LEAD";
        const isCreator = project.createdBy === userId;

        return {
            id: project.id,
            name: project.name,
            slug: project.slug,
            color: project.color,
            description: project.description,
            createdBy: project.createdBy,
            canManageMembers: isOwnerOrAdmin || isProjectManager || isCreator,
            memberCount: project._count.projectMembers,
            memberIds: project.projectMembers.map((m: any) => m.WorkspaceMember.userId),
            projectManagers: project.projectMembers
                .filter((m: any) => (m.projectRole === "PROJECT_MANAGER" || m.projectRole === "LEAD") && m.WorkspaceMember?.user)
                .map((m: any) => ({
                    id: m.WorkspaceMember.user.id,
                    name: m.WorkspaceMember.user.name || "Unknown",
                    surname: m.WorkspaceMember.user.surname || "",
                    image: m.WorkspaceMember.user.image,
                    email: m.WorkspaceMember.user.email,
                    projectRole: m.projectRole,
                })),
            isLead: isProjectLead,
        };
    });
}


// Cached version with Next.js unstable_cache (persists across requests)
const getCachedUserProjects = (userId: string, workspaceId: string, lite = false) =>
    unstable_cache(
        async () => _getUserProjectsInternal(userId, workspaceId, lite),
        [`user-projects-${userId}-${workspaceId}-${lite ? "lite" : "full"}-v3`],
        {
            tags: CacheTags.userProjects(userId, workspaceId),
            revalidate: 60,
        }
    )();

// React cache wrapper (deduplicates requests within the same render)
export const getUserProjects = cache(async (workspaceId: string, lite = false) => {
    const user = await requireUser();
    const projects = await getCachedUserProjects(user.id, workspaceId, lite);

    if (!projects) {
        return notFound();
    }

    return projects;
});

export type UserProjectsType = Awaited<ReturnType<typeof getUserProjects>>;
