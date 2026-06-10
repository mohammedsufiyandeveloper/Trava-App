const notFound = (..._args: any[]): never => { throw new Error('notFound not available in API server'); }; // next/navigation no-op
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags } from "@/data/cache-tags";
import { cached } from "@/lib/cache/runtime-cache";

export type WorkspaceMemberRow = {
  id: string;
  workspaceId: string;
  userId: string;
  workspaceRole: string;
  createdAt?: Date;
  user?: {
    id: string;
    name?: string | null;
    surname?: string | null;
    email: string;
    image?: string | null;
    contactNumber?: string | null;
    phoneNumber?: string | null;
  };
};

export type WorkspaceMembersResult = {
  workspaceMembers: WorkspaceMemberRow[];
};

export const getWorkspaceMembers = async (
  workspaceId: string,
  role?: string
): Promise<WorkspaceMembersResult> => {
  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }

  const user = await requireUser();
  if (!user?.id) {
    return notFound();
  }

  const result = await cached(
    `workspace-members-${workspaceId}-${role || "all"}`,
    async () => _fetchWorkspaceMembersInternal(workspaceId, role),
    {
      tags: CacheTags.workspaceMembers(workspaceId),
      ttlSeconds: 60,
    }
  );

  const isUserMember = result.workspaceMembers.some((m) => m.userId === user.id);
  if (!isUserMember) {
    // Verify user is member of workspace regardless of role filter
    const fullList = await cached(
        `workspace-members-${workspaceId}-all`,
        async () => _fetchWorkspaceMembersInternal(workspaceId),
        {
          tags: CacheTags.workspaceMembers(workspaceId),
          ttlSeconds: 60,
        }
    );
    if (!fullList.workspaceMembers.some(m => m.userId === user.id)) {
        return notFound();
    }
  }

  return result;
};

async function _fetchWorkspaceMembersInternal(workspaceId: string, role?: string): Promise<WorkspaceMembersResult> {
  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: { 
      workspaceId,
      workspaceRole: role ? (role as any) : undefined 
    },
    select: {
      id: true,
      workspaceId: true,
      userId: true,
      workspaceRole: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          surname: true,
          phoneNumber: true,
          email: true,
          image: true,
        },
      },
    },
  });

  const members = workspaceMembers.map((m) => ({
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    workspaceRole: m.workspaceRole,
    createdAt: m.createdAt,
    user: m.user ?? undefined,
  }));

  return { workspaceMembers: members };
}

/**
 * Export types for callers
 */
export type WorkspaceMembersType = WorkspaceMemberRow[];
