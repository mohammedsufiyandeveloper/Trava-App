import { getTasks } from "@/data/task/get-tasks";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import { getUserProjects } from "@/data/project/get-projects";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { requireUser } from "@/lib/auth/require-user";
import dynamic from "next/dynamic";
import { getProjectMembers } from "@/data/project/get-project-members";
import { getWorkspaceProjectMembersMap, getWorkspaceProjectManagersMap } from "@/data/workspace/get-workspace-kanban-data";

const KanbanBoard = dynamic(
    () => import("@/components/task/kanban/kanban-board").then(mod => mod.KanbanBoard),
    { loading: () => <div className="h-[60vh] w-full flex items-center justify-center text-muted-foreground animate-pulse">Loading Board...</div> }
);

interface WorkspaceKanbanViewProps {
    workspaceId: string;
}

export default async function WorkspaceKanbanView({ workspaceId }: WorkspaceKanbanViewProps) {
    const userPromise = requireUser();
    const membersPromise = getProjectMembers({ workspaceId });
    const projectsPromise = getUserProjects(workspaceId);
    const tagsPromise = getWorkspaceTags(workspaceId);
    const pmMatchesPromise = getWorkspaceProjectMembersMap(workspaceId);
    const projectManagersPromise = getWorkspaceProjectManagersMap(workspaceId);

    // 2. Wait for user safely before launching the dependent queries
    const user = await userPromise;

    const COLUMNS = ["TO_DO", "IN_PROGRESS", "REVIEW", "COMPLETED", "HOLD", "CANCELLED"] as const;

    // 3. Launch the final large queries
    const [
        statusResponses,
        permissions,
        projectMembers,
        projects,
        projectUserMap,
        tags,
        pmMap,
    ] = await Promise.all([
        Promise.all(COLUMNS.map(status =>
            getTasks({
                workspaceId,
                status: [status],
                excludeParents: true,
                limit: 30, // Increased to 30 to better fill initial screen and prevent eager paging
                sorts: [{ field: "createdAt", direction: "desc" }],
                view_mode: "kanban",
                includeFacets: true
            }, user.id)
        )),
        getWorkspacePermissions(workspaceId, user.id),
        membersPromise,
        projectsPromise,
        pmMatchesPromise,
        tagsPromise,
        projectManagersPromise,
    ]);

    const initialData: Record<string, any> = {};

    COLUMNS.forEach((status, index) => {
        const response = statusResponses[index];
        const tasks = response.tasks;
        const totalInDb = (response.facets as any)?.statusCounts?.[status] || tasks.length;

        initialData[status] = {
            subTasks: tasks,
            totalCount: totalInDb,
            hasMore: totalInDb > tasks.length,
            nextCursor: totalInDb > tasks.length && tasks.length > 0
                ? { id: tasks[tasks.length - 1].id, createdAt: tasks[tasks.length - 1].createdAt }
                : null,
            currentPage: 1
        };
    });

    // Convert projects to ProjectOption format for filters
    const projectOptions = projects.map(project => ({
        id: project.id,
        name: project.name,
        slug: project.slug,
        color: project.color,
        memberIds: projectUserMap[project.id] || []
    }));


    return (
        <KanbanBoard
            initialData={initialData}
            projectMembers={projectMembers as any}
            workspaceId={workspaceId}
            projectId="" // Empty for workspace-level
            projects={projectOptions}
            level="workspace"
            tags={tags.map(tag => ({ id: tag.id, name: tag.name }))}
            projectManagers={pmMap}
            permissions={permissions}
            userId={user.id}
        />
    );
}
