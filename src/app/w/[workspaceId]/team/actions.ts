"use server";

import { InviteUserSchemaType } from "@/lib/zodSchemas";
import { ApiResponse } from "@/lib/types";
import { requireUser } from "@/lib/auth/require-user";
import { inviteMemberAction } from "@/actions/team/invite-member";
import { deleteMemberAction } from "@/actions/team/delete-member";

/**
 * Invite a user via Server Action (Web UI)
 */
export async function inviteUserToWorkspace(
    values: InviteUserSchemaType
): Promise<ApiResponse> {
    return inviteMemberAction(values);
}

/**
 * Delete a workspace member via Server Action (Web UI)
 */
export async function deleteWorkspaceMember(
    workspaceMemberId: string,
    workspaceId: string
): Promise<ApiResponse> {
    const user = await requireUser();
    return deleteMemberAction(workspaceMemberId, workspaceId, user.id);
}
