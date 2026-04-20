import { GanttSubtask, GanttTask } from "@/components/task/gantt/types";

/**
 * Transform flat tasks list into Gantt structure
 * Handles Project -> Task -> Subtask hierarchy and date normalization
 */
export function transformToGanttTasks(allTasks: any[]): GanttTask[] {
    // console.log("🟦 [GANTT TRANSFORM] Input allTasks count:", allTasks.length);
    const allIds = new Set(allTasks.map(t => t.id));

    // 1. Separate parent tasks and subtasks
    // A task is a "parent" if it has no parentTaskId OR if its parentTaskId is not in the current set
    const parentTasks = allTasks.filter(task => !task.parentTaskId || !allIds.has(task.parentTaskId));
    // console.log("🟦 [GANTT TRANSFORM] parentTasks (roots) count:", parentTasks.length);
    const subtasksMap = new Map<string, any[]>();

    allTasks.forEach(task => {
        if (task.parentTaskId && allIds.has(task.parentTaskId)) {
            if (!subtasksMap.has(task.parentTaskId)) {
                subtasksMap.set(task.parentTaskId, []);
            }
            subtasksMap.get(task.parentTaskId)!.push(task);
        }
    });



    // 2. Helper to format dates consistently (YYYY-MM-DD local)
    const formatLocalDate = (date: Date | null): string => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 3. Transform data to GanttTask format
    return parentTasks
        .sort((a, b) => (a.position ?? 1000) - (b.position ?? 1000))
        .map((parentTask) => {
            const taskSubtasks = subtasksMap.get(parentTask.id) || [];

            // Transform subtasks with date fallback logic
            const rawSubtasks: GanttSubtask[] = taskSubtasks
                .sort((a, b) => (a.position ?? 1000) - (b.position ?? 1000))
                .map((subtask) => {
                    // Date Strategy: Use startDate + days, or just dueDate, or fallback to today
                    let start: Date | null = subtask.startDate ? new Date(subtask.startDate) : null;
                    let end: Date | null = subtask.dueDate ? new Date(subtask.dueDate) : null;

                    // Fallback: If no end but has start + days
                    if (!end && start && subtask.days) {
                        end = new Date(start.getTime() + (subtask.days - 1) * 24 * 60 * 60 * 1000);
                    }

                    // Fallback: If no start but has end
                    if (!start && end) {
                        start = new Date(end); // 1-day milestone
                    }

                    return {
                        id: subtask.id,
                        name: subtask.name,
                        taskSlug: subtask.taskSlug,
                        start: formatLocalDate(start),
                        end: formatLocalDate(end),
                        status: subtask.status || 'TO_DO',
                        projectId: subtask.projectId,
                        parentTaskId: subtask.parentTaskId,
                        description: subtask.description,
                        tagId: subtask.tagId,
                        days: subtask.days,

                        assigneeId: subtask.assigneeId,
                        assignee: subtask.assignee ? {
                            id: subtask.assignee.workspaceMember?.userId, // This is userId
                            name: subtask.assignee.workspaceMember?.user?.surname || subtask.assignee.workspaceMember?.user?.name || "Unknown",
                            image: subtask.assignee.workspaceMember?.user?.image,
                        } : undefined,
                        assigneeRole: subtask.projectRole || (subtask.assignee as any)?.projectRole,
                        createdById: subtask.createdById,
                        position: subtask.position || 0,
                        dependsOnIds: (subtask.Task_TaskDependency_A?.map((d: any) => d.id) || []),
                    };
                });



            return {
                id: parentTask.id,
                name: parentTask.name,
                taskSlug: parentTask.taskSlug,
                projectId: parentTask.projectId || parentTask.project?.id,
                projectName: parentTask.projectName || parentTask.project?.name,
                projectColor: parentTask.projectColor || parentTask.project?.color,
                start: parentTask.startDate ? formatLocalDate(new Date(parentTask.startDate)) : undefined,
                end: parentTask.dueDate ? formatLocalDate(new Date(parentTask.dueDate)) : undefined,
                subtasks: rawSubtasks,
                assigneeId: parentTask.assigneeId,
                status: parentTask.status || "TO_DO",
                createdById: parentTask.createdById,
                parentTaskId: parentTask.parentTaskId || null,
                assignee: parentTask.assignee ? {
                    id: parentTask.assignee.workspaceMember?.userId,
                    name: parentTask.assignee.workspaceMember?.user?.surname || parentTask.assignee.workspaceMember?.user?.name || "Unknown",
                    image: parentTask.assignee.workspaceMember?.user?.image,
                } : undefined,
            };
        });
}
