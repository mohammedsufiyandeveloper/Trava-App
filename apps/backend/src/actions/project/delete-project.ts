"use server";

import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { getUserPermissions } from "@/data/user/get-user-permissions";

export async function deleteProject(projectId: string): Promise<ApiResponse> {
    const user = await requireUser();

    try {
        // 1. Get the project and verify it exists
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                workspace: true, // Needed for ownerId check and cache invalidation
            },
        });

        if (!project) {
            return {
                status: "error",
                message: "Project not found.",
            };
        }

        // 2. Check permissions using centralized helper
        const permissions = await getUserPermissions(project.workspaceId, projectId);

        // Explicitly allow if user is the direct owner of the workspace (safeguard against missing member records)
        const isOwner = project.workspace.ownerId === user.id;

        if (!permissions.isWorkspaceAdmin && !isOwner) {
            return {
                status: "error",
                message: "Only workspace owners and admins can delete projects.",
            };
        }

        // 3. Delete the project (cascades to tasks, project members, etc.)
        await prisma.project.delete({
            where: { id: projectId },
        });

        // 4. Invalidate project cache
        const { invalidateWorkspaceProjects, invalidateProjectTasks } = await import(
            "@/lib/cache/invalidation"
        );
        await invalidateWorkspaceProjects(project.workspaceId);
        await invalidateProjectTasks(projectId);

        return {
            status: "success",
            message: "Project deleted successfully.",
        };
    } catch (err) {
        console.error("Error deleting project:", err);
        return {
            status: "error",
            message: "An unexpected error occurred while deleting the project. Please try again later.",
        };
    }
}
