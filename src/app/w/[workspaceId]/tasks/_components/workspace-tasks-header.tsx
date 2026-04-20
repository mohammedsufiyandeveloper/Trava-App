import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { WorkspaceTasksHeaderClient } from "./workspace-tasks-header-client";

interface WorkspaceTasksHeaderProps {
    workspaceId: string;
}

/**
 * Workspace Tasks Header (Server Component)
 * 
 * Fetches only required permissions and passes to client component
 */
export async function WorkspaceTasksHeader({ workspaceId }: WorkspaceTasksHeaderProps) {
    // Only fetch permissions - other data is fetched by individual views
    const permissions = await getWorkspacePermissions(workspaceId);

    return (
        <WorkspaceTasksHeaderClient
            workspaceId={workspaceId}
            permissions={{
                isWorkspaceAdmin: permissions.isWorkspaceAdmin,
                canCreateTasks: permissions.isWorkspaceAdmin,
                canCreateSubTasks: permissions.hasAccess // Only Admins and Project Leads
            }}
        />
    );
}
