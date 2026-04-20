import { cache } from "react";
import { getWorkspaces } from "./get-workspaces";
import { getWorkspaceMetadata } from "./get-workspace-metadata";
import { getDailyReportStatus } from "@/data/daily-report/get-daily-report-status";
import { requireUser } from "@/lib/auth/require-user";

/**
 * UNIFIED LAYOUT DATA FETCH
 * 
 * Fetches Auth, Workspaces, Metadata, and Report Status in parallel.
 * This eliminates the sequential waterfall in the root layout.
 */
export const getWorkspaceLayoutData = cache(async (workspaceId: string) => {
    const user = await requireUser();
    
    // Kick off all data requirements in parallel
    const [workspaces, metadata, reportStatus] = await Promise.all([
        getWorkspaces(user.id),
        getWorkspaceMetadata(workspaceId, user.id),
        getDailyReportStatus(workspaceId)
    ]);

    return {
        user,
        workspaces,
        metadata,
        reportStatus
    };
});
