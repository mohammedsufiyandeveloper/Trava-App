import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { InviteUserForm } from "./create-user";

interface AdminActionsProps {
    workspaceId: string;
}

/**
 * AdminActions — Fetches permissions and renders the invite form if admin.
 * This is meant to be wrapped in a Suspense boundary in the page shell.
 */
export async function AdminActions({ workspaceId }: AdminActionsProps) {
    const permissions = await getWorkspacePermissions(workspaceId);
    
    // Only admins can see/use the invite form
    if (!permissions.isWorkspaceAdmin) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <InviteUserForm workspaceId={workspaceId} isAdmin={true} />
        </div>
    );
}
