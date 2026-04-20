"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { cache } from "react";
import { unstable_cache } from "next/cache";

/**
 * Lightweight check for the daily report status.
 * Used for the FAB badge. Returns minimal data for speed.
 */
async function _getDailyReportStatusInternal(workspaceId: string, userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const report = await prisma.dailyReport.findUnique({
        where: {
            workspaceId_userId_date: {
                workspaceId,
                userId,
                date: startOfDay,
            },
        },
        select: { status: true },
    });

    return { status: report?.status || "NOT_SUBMITTED" };
}

export const getDailyReportStatus = cache(async (workspaceId: string) => {
    const user = await requireUser();
    if (!user) return { status: "NOT_SUBMITTED" };

    return await unstable_cache(
        () => _getDailyReportStatusInternal(workspaceId, user.id),
        [`daily-report-status-${workspaceId}-${user.id}`],
        {
            tags: [`daily-report-${user.id}`],
            revalidate: 60, // 1 minute
        }
    )();
});
