"use server";

import prisma from "@/lib/db";
import { vendorSchema, VendorSchemaType } from "@/lib/zodSchemas";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { revalidatePath } from "next/cache";

/**
 * Create a new vendor
 * Only authorized users (ADMIN/OWNER) can create vendors
 */
export async function createVendor(data: VendorSchemaType) {
    try {
        // Check permissions
        const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(data.workspaceId);

        if (!isWorkspaceAdmin || !workspaceMember) {
            return {
                status: "error" as const,
                message: "Only workspace admins can create vendors",
            };
        }

        // Validate input
        const validatedData = vendorSchema.parse(data);

        // Create the vendor
        const vendor = await prisma.vendor.create({
            data: {
                name: validatedData.name,
                companyName: validatedData.companyName,
                contactPerson: validatedData.contactPerson,
                phoneNumber: validatedData.phoneNumber,
                email: validatedData.email,
                address: validatedData.address,
                gstNumber: validatedData.gstNumber,
                workspaceId: validatedData.workspaceId,
                isActive: validatedData.isActive !== false,
                materials: validatedData.materialIds ? {
                    connect: validatedData.materialIds.map(id => ({ id }))
                } : undefined,
            },
        });

        revalidatePath(`/w/${validatedData.workspaceId}/inventory/vendors`);

        return {
            status: "success" as const,
            message: `Vendor "${vendor.name}" created successfully`,
            data: vendor,
        };
    } catch (error) {
        console.error("Error creating vendor:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to create vendor",
        };
    }
}
