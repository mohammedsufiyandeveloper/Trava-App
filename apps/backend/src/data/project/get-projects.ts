"use server";

import prisma from "@/lib/db";
const notFound = (..._args: any[]): never => { throw new Error('notFound not available in API server'); }; // next/navigation no-op
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags } from "@/data/cache-tags";
import { cached } from "@/lib/cache/runtime-cache";

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
        // Lite projection for list/picker views: everything the Projects list and
        // workspace project pickers render, WITHOUT the heavy projectMembers array
        // (per-member user objects incl. emails) or _count. `description` is kept
        // because the Projects list renders it. `createdBy` is a cheap scalar and
        // is required to derive `canManageMembers` without loading other members.
        id: true,
        workspaceId: true,
        name: true,
        slug: true,
        color: true,
        description: true,
        createdBy: true,
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

    // The lite projection omits `projectMembers`, so the caller's own project role
    // is resolved in one extra query instead. This keeps other members' data (names,
    // images, emails) out of the payload while still allowing the client to decide
    // which project actions to offer.
    let ownProjectRoles = new Map<string, string>();
    if (lite && projects.length > 0) {
        const ownMemberships = await prisma.projectMember.findMany({
            where: {
                workspaceMemberId: workspaceMember.id,
                projectId: { in: projects.map((p: any) => p.id) },
            },
            select: { projectId: true, projectRole: true },
        });
        ownProjectRoles = new Map(
            ownMemberships.map((m) => [m.projectId, m.projectRole as string])
        );
    }

    return projects.map((project: any) => {
        if (lite) {
            const ownRole = ownProjectRoles.get(project.id);
            return {
                id: project.id,
                name: project.name,
                slug: project.slug,
                color: project.color,
                description: project.description,
                createdBy: project.createdBy,
                canManageMembers:
                    isOwnerOrAdmin ||
                    ownRole === "PROJECT_MANAGER" ||
                    project.createdBy === userId,
                memberCount: undefined,
                memberIds: undefined,
                projectManagers: undefined,
                isLead: ownRole === "LEAD",
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
    cached(
        `user-projects-${userId}-${workspaceId}-${lite ? "lite" : "full"}-v5`,
        async () => _getUserProjectsInternal(userId, workspaceId, lite),
        {
            tags: CacheTags.userProjects(userId, workspaceId),
            ttlSeconds: 60,
        }
    );

export const getUserProjects = async (workspaceId: string, lite = false) => {
    const user = await requireUser();
    const projects = await getCachedUserProjects(user.id, workspaceId, lite);

    if (!projects) {
        return notFound();
    }

    return projects;
};

export type UserProjectsType = Awaited<ReturnType<typeof getUserProjects>>;
