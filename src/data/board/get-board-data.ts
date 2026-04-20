import { cache } from "react";
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

/**
 * Fetches all board data for a workspace.
 * Grouping is handled automatically: 
 * - Admins see all members and their notes.
 * - Members see only their own notes.
 */
export const getBoardData = cache(async (workspaceId: string) => {
    const user = await requireUser();
    const perms = await getWorkspacePermissions(workspaceId, user.id);

    if (!perms.hasAccess) {
        return {
            members: [],
            isOwner: false,
            currentMemberId: null
        };
    }

    // Fetch members and their board items
    // If admin, fetch all workspace members
    // If regular member, fetch only themselves
    const rawMembers = await prisma.workspaceMember.findMany({
        where: {
            workspaceId,
            ...(perms.isWorkspaceAdmin ? {} : { userId: user.id })
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    surname: true,
                    image: true,
                    email: true,
                }
            },
            board_items_board_items_memberIdToWorkspaceMember: {
                include: {
                    WorkspaceMember_board_items_assignedByIdToWorkspaceMember: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    surname: true,
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    createdAt: "desc"
                }
            }
        },
        orderBy: {
            user: {
                name: "asc"
            }
        }
    });

    const members = rawMembers.map((member) => ({
        ...member,
        boardItems: member.board_items_board_items_memberIdToWorkspaceMember.map(item => ({
            ...item,
            assignedBy: item.WorkspaceMember_board_items_assignedByIdToWorkspaceMember
        }))
    }));

    return {
        members,
        isOwner: perms.isWorkspaceAdmin,
        currentMemberId: perms.workspaceMemberId
    };
});

export type BoardData = Awaited<ReturnType<typeof getBoardData>>;
