"use server";

import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { requireUser } from "@/lib/auth/require-user";
import { revalidateTag } from "next/cache";
import { CacheTags } from "@/data/cache-tags";

/**
 * Deletes a workspace and all its members.
 * Requires the performing user to be the OWNER of the workspace.
 */
export async function deleteWorkSpace(workspaceId: string): Promise<ApiResponse> {
  const user = await requireUser();

  try {
    // 1. Verify ownership
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      return {
        status: "error",
        message: "Workspace not found",
      };
    }

    if (workspace.ownerId !== user.id) {
      return {
        status: "error",
        message: "Only the owner can delete a workspace",
      };
    }

    // 2. Perform deletion (cascaded deletion should handle members if configured, 
    // but we'll be explicit if needed or rely on Prisma relation logic)
    // In our schema, we should ensure members are deleted.
    await prisma.workspace.delete({
      where: { id: workspaceId },
    });

    // 3. Invalidate caches
    // Invalidate the user's workspace list
    (revalidateTag as any)(CacheTags.userWorkspaces(user.id)[0], 'layout');
    (revalidateTag as any)("workspaces", 'layout');
    // Invalidate the specific workspace data
    (revalidateTag as any)(CacheTags.workspace(workspaceId)[0], 'layout');

    return {
      status: "success",
      message: "Workspace deleted successfully",
    };
  } catch (error) {
    console.error("[Delete Workspace] Failed:", error);
    return {
      status: "error",
      message: "Failed to delete workspace. Please try again.",
    };
  }
}
