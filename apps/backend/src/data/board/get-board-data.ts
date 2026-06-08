const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op
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
            member_todos: {
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
        boardItems: member.member_todos.map((todo) => ({
            id: todo.id,
            workspaceId,
            memberId: todo.memberId,
            assignedById: todo.memberId,
            note: todo.text,
            status: todo.completed ? ("DONE" as const) : ("NOT_DONE" as const),
            createdAt: todo.createdAt,
            updatedAt: todo.updatedAt,
            assignedBy: {
                id: member.id,
                workspaceRole: member.workspaceRole,
                user: {
                    id: member.user?.id || "",
                    name: member.user?.name || "",
                    surname: member.user?.surname || "",
                }
            }
        }))
    }));

    return {
        members,
        isOwner: perms.isWorkspaceAdmin,
        currentMemberId: perms.WorkspaceMemberId
    };
});

export type BoardData = Awaited<ReturnType<typeof getBoardData>>;
