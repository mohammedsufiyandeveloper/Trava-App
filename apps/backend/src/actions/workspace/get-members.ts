"use server";

import { getWorkspaceMembers as getMembersData } from "@/data/workspace/get-workspace-members";

/**
 * Server action to fetch workspace members.
 * This provides a bridge for client components to access member data
 * without violating 'server-only' restrictions.
 */
export async function getWorkspaceMembersAction(workspaceId: string) {
    try {
        const data = await getMembersData(workspaceId);
        return { success: true, data };
    } catch (error: any) {
        console.error("Error in getWorkspaceMembersAction:", error);
        return { success: false, error: error.message || "Failed to fetch members" };
    }
}
