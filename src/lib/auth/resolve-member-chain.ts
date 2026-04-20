/**
 * resolve-member-chain.ts
 * 
 * Generic utility to resolve the full membership chain:
 *   User → WorkspaceMember → ProjectMember
 * 
 * Use this in ANY project-scoped server action to get the 
 * correct ProjectMember.id for database writes.
 * 
 * Example:
 *   const chain = await resolveMemberChain(workspaceId, projectId);
 *   if (!chain) return { status: "error", message: "Not a project member" };
 *   // Use chain.projectMemberId for task createdById, assigneeId, reviewerId
 */

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

export interface MemberChain {
    /** The authenticated User.id */
    userId: string;
    /** WorkspaceMember.id for this user in this workspace */
    workspaceMemberId: string;
    /** ProjectMember.id for this user in this project */
    projectMemberId: string;
    /** The user's role within the project */
    projectRole: string;
    /** The user's role within the workspace */
    workspaceRole: string;
}

/**
 * Resolves the full membership chain for the current authenticated user.
 * Returns null if the user is not a member of the project.
 * 
 * @param workspaceId - The workspace ID
 * @param projectId - The project ID
 * @param providedUserId - Optional: skip requireUser() if userId already known
 */
export async function resolveMemberChain(
    workspaceId: string,
    projectId: string,
    providedUserId?: string
): Promise<MemberChain | null> {
    const userId = providedUserId || (await requireUser()).id;

    const projectMember = await prisma.projectMember.findFirst({
        where: {
            projectId,
            WorkspaceMember: {
                userId,
                workspaceId,
            },
        },
        include: {
            WorkspaceMember: {
                select: {
                    id: true,
                    workspaceRole: true,
                },
            },
        },
    });

    if (!projectMember) return null;

    return {
        userId,
        workspaceMemberId: projectMember.workspaceMemberId,
        projectMemberId: projectMember.id,
        projectRole: projectMember.projectRole,
        workspaceRole: (projectMember as any).WorkspaceMember.workspaceRole,
    };
}

/**
 * Resolves a target user's ProjectMember.id within a project.
 * Useful when assigning a task to another user.
 * 
 * @param targetUserId - The User.id being looked up
 * @param projectId - The project context
 * @param workspaceId - The workspace context
 */
export async function resolveProjectMemberId(
    targetUserId: string,
    projectId: string,
    workspaceId: string
): Promise<string | null> {
    const pm = await prisma.projectMember.findFirst({
        where: {
            projectId,
            WorkspaceMember: {
                userId: targetUserId,
                workspaceId,
            },
        },
        select: { id: true },
    });
    return pm?.id ?? null;
}

/**
 * Batch-resolves multiple User.id values to their ProjectMember.id values
 * for a given project. Returns a Map<userId, projectMemberId>.
 * 
 * @param userIds - Array of User.id values to resolve
 * @param projectId - The project context
 * @param workspaceId - The workspace context
 */
export async function resolveProjectMemberIds(
    userIds: string[],
    projectId: string,
    workspaceId: string
): Promise<Map<string, string>> {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return new Map();

    const members = await prisma.projectMember.findMany({
        where: {
            projectId,
            WorkspaceMember: {
                userId: { in: unique },
                workspaceId,
            },
        },
        select: {
            id: true,
            WorkspaceMember: {
                select: { userId: true },
            },
        },
    });

    return new Map(members.map(m => [(m as any).WorkspaceMember.userId, m.id]));
}
