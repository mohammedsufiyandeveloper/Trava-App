import { getTasks } from "@/data/task/get-tasks";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import { getUserProjects } from "@/data/project/get-projects";
import dynamic from "next/dynamic";
import { getProjectMembers } from "@/data/project/get-project-members";
import { transformToGanttTasks } from "@/components/task/gantt/transform-tasks";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";

const WorkspaceGanttClient = dynamic(
    () => import("./workspace-gantt-client").then(mod => mod.WorkspaceGanttClient),
    { loading: () => <div className="h-[60vh] w-full flex items-center justify-center text-muted-foreground animate-pulse">Loading Gantt Chart...</div> }
);

interface WorkspaceGanttViewProps {
    workspaceId: string;
}

export async function WorkspaceGanttView({ workspaceId }: WorkspaceGanttViewProps) {
    const userPromise = requireUser();
    const projectsPromise = getUserProjects(workspaceId);
    const membersPromise = getProjectMembers({ workspaceId });
    const tagsPromise = getWorkspaceTags(workspaceId);

    const user = await userPromise;

    const [tasksData, projects, projectMembers, tags, permissions] = await Promise.all([
        getTasks({
            workspaceId,
            hierarchyMode: "parents",
            includeSubTasks: true,
            limit: 1000,
            includeFacets: true,
            view_mode: "gantt"
        }, user.id),
        projectsPromise,
        membersPromise,
        tagsPromise,
        getWorkspacePermissions(workspaceId, user.id),
    ]);

    const rawTasks = tasksData.tasks;
    // console.log("🟦 [GANTT SERVER] rawTasks count:", rawTasks.length);
    // if (rawTasks.length > 0) {
    //     console.log("🟦 [GANTT SERVER] SAMPLE TASK (First):", JSON.stringify(rawTasks[0], (key, value) => key === 'subTasks' ? (value?.length || 0) : value, 2));
    // }
    const allTasks: any[] = [];
    rawTasks.forEach((t: any) => {
        allTasks.push(t);
        if (t.subTasks && t.subTasks.length > 0) {
            // console.log(`   ✅ Task "${t.name}" (${t.id}) has ${t.subTasks.length} subTasks`);
            allTasks.push(...t.subTasks);
        }
    });
    // console.log("🟦 [GANTT SERVER] allTasks total count:", allTasks.length);

    // Build map of project -> userIds and project-user role map
    const projectUserMap: Record<string, string[]> = {};
    const roleMap: Record<string, string> = {};

    // We no longer have pmMatches separately, we use projectMembers
    // Wait, getProjectMembers returns unique members by userId for the workspace.
    // To get per-project user lists, we need the original projectMember records.
    // BUT we already have projectMembers which is unique by user.
    // Actually, I should check if getProjectMembers returns project context.
    // Looking at get-project-members.ts, it returns unique members by userId.

    // I need to reconsider: if I need per-project user lists (projectUserMap), 
    // I might still need a query that returns the many-to-many project connections.
    // However, for the roleMap (projectId-assigneeId), we need to know the specific ProjectMember record.

    // Let's refine getProjectMembers to return what we need or fetch once efficiently.
    // Actually, I'll fetch the project-member relations once and use them for both.

    const projectMemberRelations = await prisma.projectMember.findMany({
        where: { project: { workspaceId } },
        select: {
            id: true,
            projectId: true,
            projectRole: true,
            WorkspaceMember: { select: { userId: true } }
        }
    });

    projectMemberRelations.forEach(pm => {
        const userId = pm.WorkspaceMember.userId;
        if (!projectUserMap[pm.projectId]) projectUserMap[pm.projectId] = [];
        projectUserMap[pm.projectId].push(userId);
        roleMap[`${pm.projectId}-${pm.id}`] = pm.projectRole;
    });

    // Enrich tasks with assignee roles for permission checks
    allTasks.forEach(t => {
        if (t.assigneeId && t.projectId) {
            t.projectRole = roleMap[`${t.projectId}-${t.assigneeId}`];
        }
    });

    const projectOptions = projects.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        color: p.color || undefined,
        memberIds: projectUserMap[p.id] || []
    }));

    const ganttTasks = transformToGanttTasks(allTasks);

    return (
        <WorkspaceGanttClient
            workspaceId={workspaceId}
            initialTasks={ganttTasks}
            allTasks={allTasks}
            subtaskDataMap={{}}
            projects={projectOptions}
            members={projectMembers as any}
            tags={tags.map(t => ({ id: t.id, name: t.name }))}
            projectCounts={(tasksData as any)?.facets?.projects}
            currentUser={{ id: user.id }}
            permissions={{
                isWorkspaceAdmin: permissions.isWorkspaceAdmin,
                leadProjectIds: permissions.leadProjectIds || [],
                managedProjectIds: permissions.managedProjectIds || []
            }}
        />
    );
}
