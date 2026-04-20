"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { editIndentSchema, type EditIndentInput } from "@/lib/zodSchemas";

export async function editIndent(input: EditIndentInput) {
    try {
        const validatedData = editIndentSchema.parse(input);
        const { indentId, workspaceId } = validatedData;

        // Fetch existing indent
        const existingIndent = await db.indentDetails.findUnique({
            where: { id: indentId },
            include: { items: true }
        });

        if (!existingIndent) {
            return { success: false, error: "Indent not found" };
        }

        // Check Permissions
        const permissions = await getUserPermissions(workspaceId, existingIndent.projectId);

        if (!permissions.workspaceMember) {
            return { success: false, error: "Unauthorized" };
        }

        const canEdit =
            permissions.isWorkspaceAdmin ||
            permissions.isProjectLead ||
            (permissions.workspaceMember.userId === existingIndent.requestedBy && existingIndent.items.every(i => i.status === "PENDING"));

        if (!canEdit) {
            return { success: false, error: "You do not have permission to edit this indent" };
        }

        const workspaceMember = permissions.workspaceMember;
        const isAdmin = permissions.isWorkspaceAdmin;

        // Update Indent using Transaction
        await db.$transaction(async (tx) => {
            // 1. Update basic details
            await tx.indentDetails.update({
                where: { id: indentId },
                data: {
                    name: validatedData.name,
                    projectId: validatedData.projectId,
                    taskId: validatedData.taskId || null,
                    description: validatedData.description || null,
                    expectedDelivery: validatedData.expectedDelivery || null,
                    requiresVendor: validatedData.requiresVendor ?? true,
                    assignedTo: validatedData.assignedTo,

                },
            });

            // 2. Handle Items: Delete all and Recreate
            // This is the safest way to ensure the current state matches the request exactly.
            // Any previous approvals are effectively voided because the request has changed.
            await tx.indentItem.deleteMany({
                where: { indentDetailsId: indentId },
            });

            if (validatedData.materials && validatedData.materials.length > 0) {
                const itemsData = validatedData.materials.map((item) => {
                    const hasVendor = !!item.vendorId;
                    const hasPrice = !!item.estimatedPrice;

                    // Determine status (Same logic as create)
                    let status: "PENDING" | "QUANTITY_APPROVED" | "VENDOR_PENDING" | "APPROVED" = "PENDING";
                    let quantityApproved = false;
                    let quantityApprovedBy: string | null = null;
                    let quantityApprovedAt: Date | null = null;
                    let finalApproved = false;
                    let finalApprovedBy: string | null = null;
                    let finalApprovedAt: Date | null = null;

                    if (isAdmin) {
                        const now = new Date();
                        // If Indent is being APPROVED, approve all items
                        if (item.itemStatus) {
                            // Respect Explicit Status (Edit Mode)
                            if (item.itemStatus === "APPROVED") {
                                quantityApproved = true;
                                quantityApprovedBy = workspaceMember.userId;
                                quantityApprovedAt = now;

                                if (hasVendor && hasPrice) {
                                    status = "APPROVED";
                                    finalApproved = true;
                                    finalApprovedBy = workspaceMember.userId;
                                    finalApprovedAt = now;
                                } else {
                                    status = "QUANTITY_APPROVED";
                                }
                            } else if (item.itemStatus === "QUANTITY_APPROVED" || item.itemStatus === "VENDOR_PENDING") {
                                status = "QUANTITY_APPROVED";
                                quantityApproved = true;
                                quantityApprovedBy = workspaceMember.userId;
                                quantityApprovedAt = now;
                            }
                            // If PENDING, defaults apply (status=PENDING, approved=false)
                        } else {
                            // No explicit status (New Item added by Admin) -> Auto Approve
                            if (hasVendor && hasPrice) {
                                status = "APPROVED";
                                quantityApproved = true;
                                quantityApprovedBy = workspaceMember.userId;
                                quantityApprovedAt = now;
                                finalApproved = true;
                                finalApprovedBy = workspaceMember.userId;
                                finalApprovedAt = now;
                            } else {
                                status = "QUANTITY_APPROVED";
                                quantityApproved = true;
                                quantityApprovedBy = workspaceMember.userId;
                                quantityApprovedAt = now;
                            }
                        }
                    }

                    return {
                        indentDetailsId: indentId,
                        materialId: item.materialId,
                        quantity: item.quantity,
                        unitId: item.unitId,
                        estimatedPrice: item.estimatedPrice || null,
                        vendorId: item.vendorId || null,
                        status,
                        quantityApproved,
                        quantityApprovedBy,
                        quantityApprovedAt,
                        finalApproved,
                        finalApprovedBy,
                        finalApprovedAt,
                    };
                });



                await tx.indentItem.createMany({
                    data: itemsData,
                });
            }
        });

        // Update ProcurementTask (if needed, simplified logic: just ensure flag is true if task exists)
        if (validatedData.taskId) {
            await db.procurementTask.updateMany({
                where: { taskId: validatedData.taskId },
                data: { indentCreated: true }
            });
        }

        revalidatePath(`/w/${workspaceId}/procurement`);

        return { success: true };
    } catch (error) {
        console.error("Error editing indent:", error);
        return { success: false, error: "Failed to edit indent" };
    }
}
