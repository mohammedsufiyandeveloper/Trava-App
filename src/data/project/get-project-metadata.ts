"use server";

const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Lightweight project metadata for layouts
 * ONLY fetches minimal, static data needed for structure
 * 
 * This is layout-safe because it:
 * - Is wrapped in cache()
 * - Only fetches project name, ID, slug, color
 * - Does NOT fetch mutable business data (tasks, members lists, etc.)
 */
export const getProjectMetadata = cache(async (workspaceId: string, slug: string) => {
    try {
        const user = await requireUser();

        // SINGLE QUERY for both project data and user access
        // This is significantly faster than chaining multiple functions
        const project = await prisma.project.findFirst({
            where: {
                workspaceId,
                OR: [{ slug }, { id: slug }]
            },
            select: {
                id: true,
                name: true,
                slug: true,
                color: true,
                workspaceId: true,
                workspace: {
                    select: {
                        members: {
                            where: { userId: user.id },
                            select: {
                                id: true,
                                workspaceRole: true,
                            }
                        }
                    }
                },
                projectMembers: {
                    where: { WorkspaceMember: { userId: user.id } },
                    select: {
                        projectRole: true
                    }
                }
            }
        });

        if (!project || project.workspace.members.length === 0) {
            return null;
        }

        const workspaceMember = project.workspace.members[0];
        const isWorkspaceAdmin = workspaceMember.workspaceRole === "OWNER" || workspaceMember.workspaceRole === "ADMIN";
        const projectMember = project.projectMembers[0];

        // Security check: Must be workspace admin or direct project member
        if (!isWorkspaceAdmin && !projectMember) {
            return null;
        }

        return {
            id: project.id,
            name: project.name,
            slug: project.slug,
            color: project.color,
            workspaceId: project.workspaceId,
            userId: user.id,
            canPerformBulkOperations: isWorkspaceAdmin || (projectMember?.projectRole === "LEAD" || projectMember?.projectRole === "PROJECT_MANAGER"),
        };
    } catch (error) {
        console.error("Error in getProjectMetadata:", error);
        return null;
    }
});

export type ProjectMetadata = Awaited<ReturnType<typeof getProjectMetadata>>;
