import dynamic from "next/dynamic";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import { getProjectMembers } from "@/data/project/get-project-members";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { getUserProjects } from "@/data/project/get-projects";
import { requireUser } from "@/lib/auth/require-user";
import { getTasks } from "@/data/task/get-tasks";
import type { TaskWithSubTasks } from "@/components/task/shared/types";

const TaskTable = dynamic(() => import("@/components/task/list/task-table"), {
    loading: () => <div className="h-[60vh] w-full flex items-center justify-center text-muted-foreground animate-pulse">Loading Tasks...</div>
});

interface WorkspaceListViewProps {
    workspaceId: string;
}

export async function WorkspaceListView({
    workspaceId,
}: WorkspaceListViewProps) {
    // Get current user
    const user = await requireUser();

    // Fetch initial tasks and metadata in parallel
    const startTime = performance.now();
    const [tagsData, projectMembers, permissions, projects, tasksData] = await Promise.all([
        getWorkspaceTags(workspaceId),
        getProjectMembers({ workspaceId }),
        getWorkspacePermissions(workspaceId, user.id),
        getUserProjects(workspaceId),
        getTasks({
            workspaceId,
            hierarchyMode: "parents",
            includeSubTasks: false,
            page: 1,
            limit: 50,
            includeFacets: true,
            view_mode: "list"
        }, user.id)
    ]);
    const duration = performance.now() - startTime;
    import("@/lib/logger").then(({ logger }) => {
        logger.serverPerf("WORKSPACE_VIEW_LOAD", duration, {
            workspaceId,
            userId: user.id
        });
    });

    const tags = tagsData.map(tag => ({
        id: tag.id,
        name: tag.name,
    }));

    const formattedMembers = projectMembers;

    const initialTasks = tasksData.tasks.map(t => ({
        ...t,
        subTasks: (t as any).subTasks
    })) as TaskWithSubTasks[];

    return (
        <TaskTable
            initialTasks={initialTasks}
            initialHasMore={tasksData.hasMore}
            initialNextCursor={tasksData.nextCursor}
            initialTotalCount={tasksData.totalCount ?? undefined}
            members={formattedMembers as any}
            workspaceId={workspaceId}
            projectId=""
            canCreateSubTask={permissions.hasAccess}
            showAdvancedFilters={true}
            tags={tags}
            projects={projects.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color || undefined,
                canManageMembers: p.canManageMembers,
                memberIds: (p as any).memberIds
            }))}
            leadProjectIds={permissions.leadProjectIds || []}
            isWorkspaceAdmin={permissions.isWorkspaceAdmin}
            level="workspace"
            userId={user.id}
            projectCounts={tasksData.facets.projects}
        />
    );
}
