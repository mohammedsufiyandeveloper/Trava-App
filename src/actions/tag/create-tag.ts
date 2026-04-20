"use server";

import prisma from "@/lib/db";
import { invalidateWorkspaceTags } from "@/lib/cache/invalidation";
import { z } from "zod";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { tagNameExists } from "@/data/tag/get-tags";

const createTagSchema = z.object({
    name: z.string().min(1, "Tag name is required").max(50, "Tag name must be less than 50 characters"),
    requirePurchase: z.boolean().default(false),
    workspaceId: z.string(),
});

export async function createTag(data: z.infer<typeof createTagSchema>) {
    try {
        // Validate input
        const validatedData = createTagSchema.parse(data);

        const permissions = await getWorkspacePermissions(validatedData.workspaceId);
        if (!permissions.isWorkspaceAdmin) {
            return {
                success: false,
                error: "You don't have permission to create tags",
            };
        }

        // Check if tag name already exists
        const exists = await tagNameExists(validatedData.workspaceId, validatedData.name);
        if (exists) {
            return {
                success: false,
                error: "A tag with this name already exists",
            };
        }

        const tag = await prisma.tag.create({
            data: {
                name: validatedData.name,
                requirePurchase: validatedData.requirePurchase,
                workspaceId: validatedData.workspaceId,
            },
        });

        await invalidateWorkspaceTags(validatedData.workspaceId);

        return {
            success: true,
            data: tag,
        };
    } catch (error) {
        console.error("Error creating tag:", error);
        if (error instanceof z.ZodError) {
            return {
                success: false,
                error: error.issues[0].message,
            };
        }
        return {
            success: false,
            error: "Failed to create tag",
        };
    }
}
