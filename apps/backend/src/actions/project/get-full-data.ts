"use server";

import { getFullProjectData as getFullProjectDataInternal } from "@/data/project/get-full-project-data";

/**
 * Server action to fetch full project data.
 * Prevents 'server-only' import errors in client components.
 */
export async function getFullProjectDataAction(projectId: string) {
    try {
        const data = await getFullProjectDataInternal(projectId);
        return { success: true, data };
    } catch (error: any) {
        console.error("Error in getFullProjectDataAction:", error);
        return { success: false, error: error.message || "Failed to fetch project data" };
    }
}
