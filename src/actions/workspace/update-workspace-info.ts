"use server";

import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { updateWorkspaceInfoSchema, UpdateWorkspaceInfoType } from "@/lib/zodSchemas";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { invalidateWorkspace } from "@/lib/cache/invalidation";

export async function updateWorkspaceInfo(values: UpdateWorkspaceInfoType): Promise<ApiResponse> {
    const user = await requireUser();

    try {
        const validation = updateWorkspaceInfoSchema.safeParse(values);
        if (!validation.success) {
            return {
                status: "error",
                message: "Invalid form data"
            };
        }

        const { workspaceId, ...data } = validation.data;

        // Check permissions
        const { isWorkspaceAdmin } = await getWorkspacePermissions(workspaceId);
        if (!isWorkspaceAdmin) {
            return {
                status: "error",
                message: "Unauthorized: You do not have permission to update this workspace",
            };
        }

        await prisma.workspace.update({
            where: { id: workspaceId },
            data: data,
        });

        // Revalidate cache
        await invalidateWorkspace(workspaceId);

        return {
            status: "success",
            message: "Workspace details updated successfully",
        };

    } catch (error) {
        console.error("Error updating workspace info:", error);
        return {
            status: "error",
            message: "Failed to update workspace info",
        };
    }
}
