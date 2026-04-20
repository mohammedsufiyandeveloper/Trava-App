"use server";

import prisma from "@/lib/db";

import { z } from "zod";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { invalidateWorkspaceTags } from "@/lib/cache/invalidation";

const deleteTagSchema = z.object({
    tagId: z.string(),
    workspaceId: z.string(),
});

export async function deleteTag(data: z.infer<typeof deleteTagSchema>) {
    try {
        // Validate input
        const validatedData = deleteTagSchema.parse(data);

        const permissions = await getWorkspacePermissions(validatedData.workspaceId);
        if (!permissions.isWorkspaceAdmin) {
            return {
                success: false,
                error: "You don't have permission to delete tags",
            };
        }

        await prisma.tag.delete({
            where: {
                id: validatedData.tagId,
            },
        });

        await invalidateWorkspaceTags(validatedData.workspaceId);

        return {
            success: true,
        };
    } catch (error) {
        console.error("Error deleting tag:", error);
        if (error instanceof z.ZodError) {
            return {
                success: false,
                error: error.issues[0].message,
            };
        }
        return {
            success: false,
            error: "Failed to delete tag",
        };
    }
}
