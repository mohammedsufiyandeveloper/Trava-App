"use server";

import prisma from "@/lib/db";
import { materialSchema, MaterialSchemaType } from "@/lib/zodSchemas";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { revalidatePath } from "next/cache";

/**
 * Create a new material
 * Only authorized users (ADMIN/OWNER) can create materials
 */
export async function createMaterial(data: MaterialSchemaType) {
    try {
        // Check permissions - only ADMIN/OWNER can create materials
        const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(data.workspaceId);

        if (!isWorkspaceAdmin || !workspaceMember) {
            return {
                status: "error" as const,
                message: "Only workspace admins can create materials",
            };
        }

        // Validate input
        const validatedData = materialSchema.parse(data);

        // Create the material
        const material = await prisma.material.create({
            data: {
                name: validatedData.name,
                specifications: validatedData.specifications || null,
                defaultUnitId: validatedData.defaultUnitId,
                workspaceId: validatedData.workspaceId,
                isActive: validatedData.isActive !== false,
            },
        });

        revalidatePath(`/w/${validatedData.workspaceId}/inventory`);

        return {
            status: "success" as const,
            message: `Material "${material.name}" created successfully`,
            data: material,
        };
    } catch (error) {
        console.error("Error creating material:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to create material",
        };
    }
}
