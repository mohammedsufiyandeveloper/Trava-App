"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { deleteIndentSchema, type DeleteIndentInput } from "@/lib/zodSchemas";

export async function deleteIndent(input: DeleteIndentInput) {
    try {
        const { indentId, workspaceId } = deleteIndentSchema.parse(input);

        // Fetch the indent to check existence and get details for permission/cleanup
        const indent = await db.indentDetails.findUnique({
            where: { id: indentId },
            select: {
                id: true,
                projectId: true,
                taskId: true,
                requestedBy: true,
            },
        });

        if (!indent) {
            return { success: false, error: "Indent not found" };
        }

        // Check permissions
        const permissions = await getUserPermissions(workspaceId, indent.projectId);

        if (!permissions.workspaceMember) {
            return { success: false, error: "Unauthorized" };
        }

        const canDelete =
            permissions.isWorkspaceAdmin ||
            permissions.isProjectLead ||
            permissions.workspaceMember.id === indent.requestedBy;

        if (!canDelete) {
            return { success: false, error: "You do not have permission to delete this indent" };
        }

        // Delete the indent
        // Note: Assuming cascade delete is set up in Prisma for items. 
        // If not, we might need to delete items first. 
        // Usually relational DBs handle this via foreign keys or Prisma cascades.
        await db.indentDetails.delete({
            where: { id: indentId },
        });

        // Cleanup: If this indent was linked to a task, check if we need to reset the indentCreated flag
        if (indent.taskId) {
            const remainingIndentsForTask = await db.indentDetails.count({
                where: {
                    taskId: indent.taskId,
                },
            });

            if (remainingIndentsForTask === 0) {
                await db.procurementTask.updateMany({
                    where: { taskId: indent.taskId },
                    data: { indentCreated: false },
                });
            }
        }

        revalidatePath(`/w/${workspaceId}/procurement`);

        return { success: true };
    } catch (error) {
        console.error("Error deleting indent:", error);
        return { success: false, error: "Failed to delete indent" };
    }
}
