// @deprecated — Use `getWorkspacePermissions` from "@/data/user/get-user-permissions" instead.
// This file is kept only for backward compatibility and will be removed in a future cleanup.
import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * @deprecated Use `getWorkspacePermissions(workspaceId).then(p => p.isWorkspaceAdmin)` instead.
 *
 * Ensures the authenticated user is an ADMIN in the given workspace.
 * Throws ForbiddenError if not admin or not a member.
 */
export const requireAdmin = cache(async (workspaceId: string) => {
  if (!workspaceId) {
    throw new ForbiddenError("workspaceId is required");
  }

  const sessionUser = await requireUser();
  const permissions = await getWorkspacePermissions(workspaceId, sessionUser.id);

  if (!permissions.isWorkspaceAdmin) {
    throw new ForbiddenError("You must be an admin to perform this action");
  }

  return { sessionUser };
});

/**
 * @deprecated Use `getWorkspacePermissions(workspaceId).then(p => p.isWorkspaceAdmin)` instead.
 *
 * Check if the current user is an admin of the workspace.
 * Returns boolean instead of throwing errors.
 */
export const isAdminServer = cache(async (workspaceId: string): Promise<boolean> => {
  if (!workspaceId) return false;

  try {
    const sessionUser = await requireUser();
    const permissions = await getWorkspacePermissions(workspaceId, sessionUser.id);
    return permissions.isWorkspaceAdmin;
  } catch {
    return false;
  }
});
