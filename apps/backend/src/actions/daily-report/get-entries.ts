"use server";

import prisma from "@/lib/db";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

export async function getReportEntries(workspaceId: string, reportId: string) {
    const { isWorkspaceAdmin } = await getWorkspacePermissions(workspaceId);

    if (!isWorkspaceAdmin) {
        throw new Error("Unauthorized to view reports");
    }

    const entries = await prisma.dailyReportEntry.findMany({
        where: { reportId },
        include: {
            task: {
                select: {
                    id: true,
                    name: true,
                    status: true,
                    taskSlug: true,
                }
            }
        },
        orderBy: {
            type: "asc" // TASK first
        }
    });

    return entries;
}
