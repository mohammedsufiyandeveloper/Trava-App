import { getWorkspaceTasks } from "@/data/task";
import { getSubTasksByParentIds } from "@/data/task/get-subtasks-batch";
import { transformToGanttTasks } from "@/components/task/gantt/transform-tasks";
import dynamic from "next/dynamic";

const ProjectGanttClient = dynamic(
    () => import("./project-gantt-client").then(mod => mod.ProjectGanttClient),
    { loading: () => <div className="h-[60vh] w-full flex items-center justify-center text-muted-foreground animate-pulse">Loading Gantt Chart...</div> }
);
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import prisma from "@/lib/db";
import { getProjectMembers } from "@/data/project/get-project-members";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import { MemberOption, TagOption } from "@/components/task/shared/types";

interface GanttServerWrapperProps {
    workspaceId: string;
    projectId: string;
}

/**
 * Server component that fetches Gantt data
 * Uses unified getTasks for parent tasks and then fetches subtasks
 */
export async function GanttServerWrapper({ workspaceId, projectId }: GanttServerWrapperProps) {
    // 1. Kick off all independent queries immediately!
    const userPromise = requireUser();
    const membersPromise = getProjectMembers(projectId);
    const tagsPromise = getWorkspaceTags(workspaceId);

    // 2. Wait for user safely
    const user = await userPromise;

    const [tasksData, permissions, projectMembers, tags] = await Promise.all([
        getWorkspaceTasks({
            workspaceId,
            projectId,
            hierarchyMode: "parents",
            includeSubTasks: true,
            limit: 1000,
            includeFacets: true,
            view_mode: "gantt"
        }, user.id),
        getWorkspacePermissions(workspaceId, user.id),
        membersPromise,
        tagsPromise
    ]);

    const rawTasks = tasksData.tasks;
    const allTasks: any[] = [];
    rawTasks.forEach((t: any) => {
        allTasks.push(t);
        if (t.subTasks && t.subTasks.length > 0) {
            allTasks.push(...t.subTasks);
        }
    });

    // 3. Create record for subtask data (plain object for server→client serialization)
    const subtaskDataMap: Record<string, any> = {};
    allTasks.forEach(task => {
        if (task.parentTaskId) { // If it's a subtask
            subtaskDataMap[task.id] = task;
        }
    });

    // 4. Transform roles Mapping
    const roleMap: Record<string, string> = {};
    projectMembers.forEach((pm: any) => {
        roleMap[pm.projectMemberId] = pm.projectRole;
    });

    allTasks.forEach(t => {
        if (t.assigneeId) {
            // Find the member in projectMembers to get the role
            const member = projectMembers.find((pm: any) => pm.projectMemberId === t.assigneeId);
            if (member) {
                t.projectRole = member.projectRole;
            }
        }
    });

    // 5. Transform to Gantt Structure
    const ganttTasks = transformToGanttTasks(allTasks);

    // 6. Get Project Counts
    const projectCounts = (tasksData as any)?.facets?.projects;

    const tagOptions = tags.map((t: any) => ({ id: t.id, name: t.name }));

    return (
        <ProjectGanttClient
            workspaceId={workspaceId}
            projectId={projectId}
            initialTasks={ganttTasks}
            allTasks={allTasks}
            subtaskDataMap={subtaskDataMap}
            members={projectMembers}
            tags={tagOptions}
            projectCounts={projectCounts}
            currentUser={{ id: user.id }}
            permissions={{
                isWorkspaceAdmin: permissions.isWorkspaceAdmin,
                leadProjectIds: permissions.leadProjectIds || [],
                managedProjectIds: permissions.managedProjectIds || []
            }}
        />
    );
}
