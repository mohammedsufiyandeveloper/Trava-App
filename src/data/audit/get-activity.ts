import prisma from "@/lib/db";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

/**
 * Fetch activity logs for a specific workspace.
 * Only accessible to admins.
 */
export async function getWorkspaceActivity(workspaceId: string) {
    const permissions = await getWorkspacePermissions(workspaceId);

    if (!permissions.isWorkspaceAdmin) {
        throw new Error("Unauthorized: Only admins can view activity logs.");
    }

    return await prisma.audit_log.findMany({
        where: { workspaceId },
        include: {
            user: {
                select: {
                    name: true,
                    email: true,
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        },
        take: 100
    });
}
