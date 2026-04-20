"use server";

import { getTasks, GetTasksOptions } from "@/data/task/get-tasks";
import { revalidateTag } from "next/cache";
import { CacheTags } from "@/data/cache-tags";

export async function loadTasksAction(opts: GetTasksOptions) {
    try {
        const result = await getTasks(opts);

        const tasksByProject: Record<string, any[]> = {};
        const tasksByStatus: Record<string, any[]> = {};

        // Use a Map for strict deduplication by ID
        const taskMap = new Map<string, typeof result.tasks[0]>();

        result.tasks.forEach(task => {
            if (!taskMap.has(task.id)) {
                taskMap.set(task.id, task);
            }
        });

        const uniqueTasks = Array.from(taskMap.values());

        uniqueTasks.forEach(task => {
            const pid = task.projectId || "unknown";
            if (!tasksByProject[pid]) tasksByProject[pid] = [];
            tasksByProject[pid].push(task);

            const status = task.status || "UNKNOWN";
            if (!tasksByStatus[status]) tasksByStatus[status] = [];
            tasksByStatus[status].push(task);
        });

        return {
            success: true as const,
            data: {
                ...result,
                tasks: uniqueTasks,
                tasksByProject,
                tasksByStatus,
            },
        };
    } catch (error) {
        console.error("Error in loadTasksAction:", error);
        return {
            success: false as const,
            error: "Failed to load tasks",
        };
    }
}

/**
 * Force a revalidation of task data for a project or workspace
 */
export async function revalidateTasksAction(workspaceId: string, projectId?: string, userId?: string) {
    try {
        if (projectId) {
            CacheTags.projectTasks(projectId, userId).forEach(tag => (revalidateTag as any)(tag, "layout"));
        } else {
            CacheTags.workspaceTasks(workspaceId, userId).forEach(tag => (revalidateTag as any)(tag, "layout"));
        }
        return { success: true as const };
    } catch (error) {
        console.error("Error revalidating tasks:", error);
        return { success: false as const };
    }
}

export type LoadTasksResponse = Awaited<ReturnType<typeof loadTasksAction>>;
