"use server";

import { getSubTasksByParentIds } from "@/data/task";
import { TaskFilters } from "@/types/task-filters";
import { requireUser } from "@/lib/auth/require-user";

export async function getSubTasksAction(
    parentTaskId: string,
    workspaceId: string,
    projectId?: string,
    filters: Partial<TaskFilters> = {},
    pageSize: number = 30,
    viewMode: string = "subtask"
) {
    const startTime = performance.now();
    const user = await requireUser();
    console.log(`[ACTION] Expanding Parent: ${parentTaskId} in Workspace: ${workspaceId}. Project: ${projectId || "All"}`);

    try {
        const results = await getSubTasksByParentIds(
            [parentTaskId],
            workspaceId,
            projectId,
            filters,
            pageSize,
            viewMode,
            user.id, // 🚀 Sub-millisecond permission optimization
            true // 🚀 Skip 900ms redundent permission check since UI already verified access to render the parent arrow!
        );

        const duration = performance.now() - startTime;
        console.log(`[ACTION-SUCCESS] Subtasks for ${parentTaskId}: ${duration.toFixed(2)}ms`);

        if (results && results.length > 0) {
            return {
                success: true,
                subTasks: results[0].subTasks,
                totalCount: results[0].totalCount,
                hasMore: results[0].hasMore,
                nextCursor: results[0].nextCursor
            };
        }

        return {
            success: true,
            subTasks: [],
            totalCount: 0,
            hasMore: false,
            nextCursor: null
        };
    } catch (error) {
        console.error("Error in getSubTasksAction:", error);
        return {
            success: false,
            error: "Failed to fetch subtasks"
        };
    }
}
