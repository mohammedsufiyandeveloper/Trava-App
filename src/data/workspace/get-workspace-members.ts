import { cache } from "react";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { CacheTags } from "@/data/cache-tags";

export type WorkspaceMemberRow = {
  id: string;
  workspaceId: string;
  userId: string;
  workspaceRole: string;
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

export const getWorkspaceMembers = cache(async (workspaceId: string, role?: string): Promise<WorkspaceMembersResult> => {
  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }

  const user = await requireUser();
  if (!user?.id) {
    return notFound();
  }

  // Pass role to the cached function
  const result = await unstable_cache(
    async () => _fetchWorkspaceMembersInternal(workspaceId, role),
    [`workspace-members-${workspaceId}-${role || "all"}`],
    {
      tags: CacheTags.workspaceMembers(workspaceId),
      revalidate: 60,
    }
  )();

  const isUserMember = result.workspaceMembers.some((m) => m.userId === user.id);
  if (!isUserMember && !role) { 
    // Verify user is member of workspace regardless of role filter
    const fullList = await unstable_cache(
        async () => _fetchWorkspaceMembersInternal(workspaceId),
        [`workspace-members-${workspaceId}-all`],
        {
          tags: CacheTags.workspaceMembers(workspaceId),
          revalidate: 60,
        }
    )();
    if (!fullList.workspaceMembers.some(m => m.userId === user.id)) {
        return notFound();
    }
  }

  return result;
});

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
      user: {
        select: {
          id: true,
          name: true,
          surname: true,
          phoneNumber: true,
          email: true,
        },
      },
    },
  });

  const members = workspaceMembers.map((m) => ({
    id: m.id,
    workspaceId: m.workspaceId,
    userId: m.userId,
    workspaceRole: m.workspaceRole,
    user: m.user ?? undefined,
  }));

  return { workspaceMembers: members };
}

/**
 * Export types for callers
 */
export type WorkspaceMembersType = WorkspaceMemberRow[];
