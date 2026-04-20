import { getUserProjects } from "@/data/project/get-projects";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { NavProjects } from "./nav-projects";
import { requireUser } from "@/lib/auth/require-user";

interface NavProjectsAsyncProps {
    workspaceId: string;
}

export async function NavProjectsAsync({ workspaceId }: NavProjectsAsyncProps) {
    // 1. Await User Validation (Fast, 5-10ms)
    const user = await requireUser();

    // 2. Fetch parallel data directly (Suspense handles resolving UI)
    const [projectsData, permissionsData] = await Promise.all([
        getUserProjects(workspaceId),
        getWorkspacePermissions(workspaceId),
    ]);

    if (!projectsData) {
        return null;
    }

    return (
        <NavProjects
            projects={projectsData}
            workspaceId={workspaceId}
            isAdmin={permissionsData.isWorkspaceAdmin}
            canCreateProject={permissionsData.canCreateProject}
            userRole={permissionsData.workspaceMember?.workspaceRole}
            currentUserId={user.id}
        />
    );
}
