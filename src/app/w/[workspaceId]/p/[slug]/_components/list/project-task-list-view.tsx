import dynamic from "next/dynamic";
import { getTasks } from "@/data/task/get-tasks";
import type { ProjectMembersType } from "@/data/project/get-project-members";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import type { UserPermissionsType } from "@/data/user/get-user-permissions";
import type { TaskWithSubTasks } from "@/components/task/shared/types";

const TaskTable = dynamic(() => import("@/components/task/list/task-table"), {
    loading: () => <div className="h-[60vh] w-full flex items-center justify-center text-muted-foreground animate-pulse">Loading Tasks...</div>
});

interface ProjectTaskListViewProps {
    workspaceId: string;
    projectId: string;
    members: ProjectMembersType;
    canCreateSubTask: boolean;
    permissions: UserPermissionsType;
    userId: string;
}

/**
 * Server component that fetches initial task data and passes it to the client TaskTable component
 * Uses unified getTasks() function
 */
export async function ProjectTaskListView({
    workspaceId,
    projectId,
    members,
    canCreateSubTask,
    permissions,
    userId,
}: ProjectTaskListViewProps) {
    // Fetch parent tasks (List View mode) using unified function
    const { tasks, hasMore, nextCursor } = await getTasks({
        workspaceId,
        projectId,
        hierarchyMode: "parents",
        limit: 50,
        view_mode: "list"
    }, userId);

    // Transform to TaskWithSubTasks structure
    const parentTasks = tasks.map(task => ({
        ...task,
        subTasks: (task as any).subTasks,
        // _count is already included in getTasks result
    })) as TaskWithSubTasks[];

    // Fetch workspace tags for subtask creation/editing
    const tagsData = await getWorkspaceTags(workspaceId);

    // Map tags to only include necessary fields (id, name)
    const tags = tagsData.map(tag => ({
        id: tag.id,
        name: tag.name,
    }));

    return (
        <TaskTable
            initialTasks={parentTasks}
            initialHasMore={hasMore}
            initialNextCursor={nextCursor}
            members={members}
            workspaceId={workspaceId}
            projectId={projectId}
            canCreateSubTask={canCreateSubTask}
            permissions={permissions}
            userId={userId}
            tags={tags}
        />
    );
}
