"use server";

import { requireUser } from "@/lib/auth/require-user";
import { getActivities } from "@/data/comments/get-comments";

interface FetchActivitiesResult {
    success: boolean;
    error?: string;
    activities?: any[];
}

/**
 * Server action to fetch activities for a subtask
 * This is a wrapper around the data layer function for client components
 * 
 * @param subTaskId - ID of the subtask to fetch activities for
 */
export async function fetchActivitiesAction(
    subTaskId: string
): Promise<FetchActivitiesResult> {
    try {
        // 1. Authenticate user
        const user = await requireUser();

        // 2. Use centralized data fetching with caching
        const activities = await getActivities(subTaskId);

        return {
            success: true,
            activities,
        };
    } catch (error) {
        console.error("Error fetching activities:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch activities",
        };
    }
}
