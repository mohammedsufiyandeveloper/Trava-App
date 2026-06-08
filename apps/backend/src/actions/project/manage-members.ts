"use server";

import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { ProjectRole } from"@prisma/client";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateWorkspaceProjects, invalidateProjectMembers, invalidateUserPermissions } from "@/lib/cache/invalidation";

/**
 * Add members to an existing project
 * Only workspace admins and project managers can add members
 */
export async function addProjectMembers(
    projectId: string,
    memberUserIds: string[]
): Promise<ApiResponse> {
    const user = await requireUser();

    try {
        // Validate input
        if (!projectId) {
            return {
                status: "error",
                message: "Project ID is required.",
            };
        }

        if (!memberUserIds || memberUserIds.length === 0) {
            return {
                status: "error",
                message: "At least one member must be selected.",
            };
        }

        // Get project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                workspace: {
                    include: {
                        members: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
                projectMembers: {
                    include: {
                        WorkspaceMember: {
                            include: {
                                user: true,
                            }
                        }
                    },
                },
            },
        });

        if (!project) {
            return {
                status: "error",
                message: "Project not found.",
            };
        }

        // Check permissions using centralized function
        const permissions = await getUserPermissions(project.workspaceId, projectId);

        if (!permissions.WorkspaceMemberId) {
            return {
                status: "error",
                message: "You are not a member of this workspace.",
            };
        }

        // Only workspace admins (OWNER/ADMIN) and project managers can add members
        if (!permissions.isWorkspaceAdmin && !permissions.isProjectManager) {
            return {
                status: "error",
                message: "Only workspace owners/admins and project managers can add members.",
            };
        }

        // Build workspace member map
        const workspaceMemberMap = new Map<string, string>();
        for (const wm of project.workspace.members) {
            if (wm?.userId && wm?.id) {
                workspaceMemberMap.set(String(wm.userId), String(wm.id));
            }
        }

        // Get existing project member user IDs
        const existingMemberUserIds = new Set(
            project.projectMembers.map((pm) => (pm as any).WorkspaceMember.userId)
        );

        // Filter out members who are already in the project
        const newMemberUserIds = memberUserIds.filter(
            (userId) => !existingMemberUserIds.has(userId)
        );

        if (newMemberUserIds.length === 0) {
            return {
                status: "error",
                message: "All selected members are already in the project.",
            };
        }

        // Prepare new members data
        const newMembers = newMemberUserIds
            .map((userId) => {
                const wmId = workspaceMemberMap.get(String(userId));
                if (!wmId) return null;

                return {
                    projectId: projectId,
                    workspaceMemberId: wmId,
                    hasAccess: true,
                    projectRole: "MEMBER" as ProjectRole,
                };
            })
            .filter(Boolean) as Array<{
                projectId: string;
                workspaceMemberId: string;
                hasAccess: boolean;
                projectRole: ProjectRole;
            }>;

        if (newMembers.length === 0) {
            return {
                status: "error",
                message: "Selected users are not members of this workspace.",
            };
        }

        // Add new members
        await prisma.projectMember.createMany({
            data: newMembers,
        });

        // Invalidate caches in parallel (don't await array map to improve latency return)
        Promise.all([
            invalidateWorkspaceProjects(project.workspaceId),
            invalidateProjectMembers(projectId),
            ...newMemberUserIds.map((userId) =>
                invalidateUserPermissions(userId, project.workspaceId, projectId)
            )
        ]).catch(console.error);

        return {
            status: "success",
            message: `Successfully added ${newMembers.length} member(s) to the project.`,
        };
    } catch (err) {
        console.error("Error adding project members:", err);
        return {
            status: "error",
            message: "An unexpected error occurred while adding members. Please try again later.",
        };
    }
}

/**
 * Remove members from a project
 * Only workspace admins and project managers can remove members
 * Cannot remove the last project manager
 */
export async function removeProjectMembers(
    projectId: string,
    memberUserIds: string[]
): Promise<ApiResponse> {
    const user = await requireUser();

    try {
        // Validate input
        if (!projectId) {
            return {
                status: "error",
                message: "Project ID is required.",
            };
        }

        if (!memberUserIds || memberUserIds.length === 0) {
            return {
                status: "error",
                message: "At least one member must be selected.",
            };
        }

        // Get project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                workspace: {
                    include: {
                        members: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
                projectMembers: {
                    include: {
                        WorkspaceMember: {
                            include: {
                                user: true,
                            }
                        }
                    },
                },
            },
        });

        if (!project) {
            return {
                status: "error",
                message: "Project not found.",
            };
        }

        // Check permissions using centralized function
        const permissions = await getUserPermissions(project.workspaceId, projectId);

        if (!permissions.WorkspaceMemberId) {
            return {
                status: "error",
                message: "You are not a member of this workspace.",
            };
        }

        // Only workspace admins and project managers can remove members
        if (!permissions.isWorkspaceAdmin && !permissions.isProjectManager) {
            return {
                status: "error",
                message: "Only workspace admins and project managers can remove members.",
            };
        }

        // Get user IDs to remove
        const userIdsToRemove = project.projectMembers
            .filter((pm) => memberUserIds.includes((pm as any).WorkspaceMember.userId))
            .map((pm) => (pm as any).WorkspaceMember.userId);

        if (userIdsToRemove.length === 0) {
            return {
                status: "error",
                message: "Selected members are not in this project.",
            };
        }

        // Check if we're removing all project managers
        const currentManagers = project.projectMembers.filter(
            (pm) => pm.projectRole === "PROJECT_MANAGER"
        );
        const remainingManagers = currentManagers.filter(
            (pm) => !userIdsToRemove.includes((pm as any).WorkspaceMember.userId)
        );

        if (currentManagers.length > 0 && remainingManagers.length === 0) {
            return {
                status: "error",
                message: "Cannot remove all project managers. At least one manager must remain.",
            };
        }

        // Get the specific ProjectMember IDs to remove
        const projectMemberIdsToRemove = project.projectMembers
            .filter(pm => userIdsToRemove.includes((pm as any).WorkspaceMember.userId))
            .map(pm => pm.id);

        // Remove members
        if (projectMemberIdsToRemove.length > 0) {
            await prisma.projectMember.deleteMany({
                where: {
                    id: {
                        in: projectMemberIdsToRemove,
                    },
                },
            });
        }

        // Invalidate caches in parallel (fire and forget for latency optimization, handle internal errors safely)
        Promise.all([
            invalidateWorkspaceProjects(project.workspaceId),
            invalidateProjectMembers(projectId),
            ...userIdsToRemove.map((userId) => {
                return invalidateUserPermissions(userId, project.workspaceId, projectId);
            })
        ]).catch(console.error);

        return {
            status: "success",
            message: `Successfully removed ${userIdsToRemove.length} member(s) from the project.`,
        };
    } catch (err) {
        console.error("Error removing project members:", err);
        return {
            status: "error",
            message: "An unexpected error occurred while removing members. Please try again later.",
        };
    }
}

/**
 * Update a project member's role
 * Only workspace admins and project managers can update roles
 * Cannot demote the last project manager
 */
export async function updateProjectMemberRole(
    projectId: string,
    memberUserId: string,
    newRole: ProjectRole
): Promise<ApiResponse> {
    const user = await requireUser();

    try {
        // Validate input
        if (!projectId) {
            return {
                status: "error",
                message: "Project ID is required.",
            };
        }

        if (!memberUserId) {
            return {
                status: "error",
                message: "Member ID is required.",
            };
        }

        if (!newRole || !["PROJECT_MANAGER", "LEAD", "MEMBER", "VIEWER"].includes(newRole)) {
            return {
                status: "error",
                message: "Invalid role. Must be PROJECT_MANAGER, LEAD, MEMBER, or VIEWER.",
            };
        }

        // Get project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                workspace: {
                    include: {
                        members: true,
                    },
                },
                projectMembers: {
                    include: {
                        WorkspaceMember: {
                            include: {
                                user: true,
                            }
                        }
                    },
                },
            },
        });

        if (!project) {
            return {
                status: "error",
                message: "Project not found.",
            };
        }

        // Check permissions using centralized function
        const permissions = await getUserPermissions(project.workspaceId, projectId);

        if (!permissions.WorkspaceMemberId) {
            return {
                status: "error",
                message: "You are not a member of this workspace.",
            };
        }

        // Only workspace admins and project managers can update member roles
        if (!permissions.isWorkspaceAdmin && !permissions.isProjectManager) {
            return {
                status: "error",
                message: "Only workspace admins and project managers can update member roles.",
            };
        }

        // Find the member to update
        const targetMember = project.projectMembers.find(
            (pm) => pm.WorkspaceMember.userId === memberUserId
        );

        if (!targetMember) {
            return {
                status: "error",
                message: "Member not found in this project.",
            };
        }

        // Check if we're demoting the last project manager
        if (targetMember.projectRole === "PROJECT_MANAGER" && newRole !== "PROJECT_MANAGER") {
            const currentManagers = project.projectMembers.filter(
                (pm) => pm.projectRole === "PROJECT_MANAGER"
            );

            if (currentManagers.length === 1) {
                return {
                    status: "error",
                    message: "Cannot demote the last project manager. Assign the Manager role to someone else to step down.",
                };
            }
        }

        // If promoting someone to project manager, demote any existing project managers
        if (newRole === "PROJECT_MANAGER" && targetMember.projectRole !== "PROJECT_MANAGER") {
            await prisma.projectMember.updateMany({
                where: {
                    projectId: projectId,
                    projectRole: "PROJECT_MANAGER"
                },
                data: {
                    projectRole: "MEMBER",
                },
            });
        }

        // Update the target member's role
        await prisma.projectMember.update({
            where: { id: targetMember.id },
            data: {
                projectRole: newRole,
            },
        });

        // Invalidate caches in parallel block
        Promise.all([
            invalidateWorkspaceProjects(project.workspaceId),
            invalidateProjectMembers(projectId),
            invalidateUserPermissions(memberUserId, project.workspaceId, projectId)
        ]).catch(console.error);

        const memberName = (targetMember as any).WorkspaceMember.user?.surname || "Member";
        return {
            status: "success",
            message: `Successfully updated ${memberName}'s role to ${newRole}.`,
        };
    } catch (err) {
        console.error("Error updating project member role:", err);
        return {
            status: "error",
            message: "An unexpected error occurred while updating the member role. Please try again later.",
        };
    }
}

/**
 * Toggle member access (enable/disable)
 * Only workspace admins and project managers can toggle access
 */
export async function toggleProjectMemberAccess(
    projectId: string,
    memberUserId: string
): Promise<ApiResponse> {
    const user = await requireUser();

    try {
        // Validate input
        if (!projectId) {
            return {
                status: "error",
                message: "Project ID is required.",
            };
        }

        if (!memberUserId) {
            return {
                status: "error",
                message: "Member ID is required.",
            };
        }

        // Get project
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                workspace: {
                    include: {
                        members: true,
                    },
                },
                projectMembers: {
                    include: {
                        WorkspaceMember: {
                            include: {
                                user: true,
                            }
                        }
                    },
                },
            },
        });

        if (!project) {
            return {
                status: "error",
                message: "Project not found.",
            };
        }

        // Check permissions using centralized function
        const permissions = await getUserPermissions(project.workspaceId, projectId);

        if (!permissions.WorkspaceMemberId) {
            return {
                status: "error",
                message: "You are not a member of this workspace.",
            };
        }

        // Only workspace admins and project managers can toggle member access
        if (!permissions.isWorkspaceAdmin && !permissions.isProjectManager) {
            return {
                status: "error",
                message: "Only workspace admins and project managers can toggle member access.",
            };
        }

        // Find the member to update
        const targetMember = project.projectMembers.find(
            (pm) => (pm as any).WorkspaceMember.userId === memberUserId
        );

        if (!targetMember) {
            return {
                status: "error",
                message: "Member not found in this project.",
            };
        }

        // Toggle access
        const newAccessState = !targetMember.hasAccess;

        await prisma.projectMember.update({
            where: { id: targetMember.id },
            data: {
                hasAccess: newAccessState,
            },
        });

        // Invalidate caches in parallel (fire and forget cache dump)
        Promise.all([
            invalidateWorkspaceProjects(project.workspaceId),
            invalidateProjectMembers(projectId),
            invalidateUserPermissions(memberUserId, project.workspaceId, projectId)
        ]).catch(console.error);

        return {
            status: "success",
            message: `Successfully ${newAccessState ? "enabled" : "disabled"} access for the member.`,
        };
    } catch (err) {
        console.error("Error toggling project member access:", err);
        return {
            status: "error",
            message: "An unexpected error occurred while toggling member access. Please try again later.",
        };
    }
}
