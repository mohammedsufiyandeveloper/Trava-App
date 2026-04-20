"use server";

import { requireUser } from "@/lib/auth/require-user";
import { getTaskComments } from "@/data/comments";

interface FetchCommentsResult {
    success: boolean;
    error?: string;
    comments?: any[];
    currentUserId?: string;
}

/**
 * Server action to fetch all comments for a task
 * This is a wrapper around the data layer function for client components
 * 
 * @param taskId - ID of the task to fetch comments for
 */
export async function fetchCommentsAction(
    taskId: string
): Promise<FetchCommentsResult> {
    try {
        // 1. Authenticate user
        const user = await requireUser();

        // 2. Use centralized data fetching with caching
        const comments = await getTaskComments(taskId);

        return {
            success: true,
            comments,
            currentUserId: user.id
        };
    } catch (error) {
        console.error("Error fetching comments:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch comments",
        };
    }
}
