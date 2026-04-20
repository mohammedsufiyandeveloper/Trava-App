"use server";

import prisma from "@/lib/db";

import { z } from "zod";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { tagNameExists } from "@/data/tag/get-tags";
import { invalidateWorkspaceTags } from "@/lib/cache/invalidation";

const updateTagSchema = z.object({
    tagId: z.string(),
    name: z.string().min(1, "Tag name is required").max(50, "Tag name must be less than 50 characters"),
    requirePurchase: z.boolean().default(false),
    workspaceId: z.string(),
});

export async function updateTag(data: z.infer<typeof updateTagSchema>) {
    try {
        // Validate input
        const validatedData = updateTagSchema.parse(data);

        const permissions = await getWorkspacePermissions(validatedData.workspaceId);
        if (!permissions.isWorkspaceAdmin) {
            return {
                success: false,
                error: "You don't have permission to update tags",
            };
        }

        // Check if tag name already exists (excluding current tag)
        const exists = await tagNameExists(validatedData.workspaceId, validatedData.name, validatedData.tagId);
        if (exists) {
            return {
                success: false,
                error: "A tag with this name already exists",
            };
        }

        const tag = await prisma.tag.update({
            where: {
                id: validatedData.tagId,
            },
            data: {
                name: validatedData.name,
                requirePurchase: validatedData.requirePurchase,
            },
        });

        await invalidateWorkspaceTags(validatedData.workspaceId);

        return {
            success: true,
            data: tag,
        };
    } catch (error) {
        console.error("Error updating tag:", error);
        if (error instanceof z.ZodError) {
            return {
                success: false,
                error: error.issues[0].message,
            };
        }
        return {
            success: false,
            error: "Failed to update tag",
        };
    }
}
