"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

/**
 * Approve quantity for an indent item (Step 1)
 * Only admins can approve
 */
export async function approveQuantity(itemId: string, workspaceId: string) {
    try {
        // Check if user is admin
        const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(workspaceId);

        if (!isWorkspaceAdmin || !workspaceMember) {
            return {
                success: false,
                error: "Only admins can approve quantities",
            };
        }

        // Get the item
        const item = await db.indentItem.findUnique({
            where: { id: itemId },
            include: {
                indentDetails: true,
            },
        });

        if (!item) {
            return {
                success: false,
                error: "Indent item not found",
            };
        }

        // Check if already approved
        if (item.quantityApproved) {
            return {
                success: false,
                error: "Quantity already approved",
            };
        }

        // Determine next status
        // If vendor is already present, move to VENDOR_PENDING
        // Otherwise, move to QUANTITY_APPROVED
        const nextStatus = item.vendorId ? "VENDOR_PENDING" : "QUANTITY_APPROVED";

        // Update the item
        await db.indentItem.update({
            where: { id: itemId },
            data: {
                quantityApproved: true,
                quantityApprovedBy: workspaceMember.userId,
                quantityApprovedAt: new Date(),
                status: nextStatus,
            },
        });

        revalidatePath(`/w/${workspaceId}/procurement/indent`);

        return {
            success: true,
            message: "Quantity approved successfully",
        };
    } catch (error) {
        console.error("Error approving quantity:", error);
        return {
            success: false,
            error: "Failed to approve quantity",
        };
    }
}

/**
 * Approve final (vendor + price) for an indent item (Step 2)
 * Only admins can approve
 */
export async function approveFinal(itemId: string, workspaceId: string) {
    try {
        // Check if user is admin
        const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(workspaceId);

        if (!isWorkspaceAdmin || !workspaceMember) {
            return {
                success: false,
                error: "Only admins can give final approval",
            };
        }

        // Get the item
        const item = await db.indentItem.findUnique({
            where: { id: itemId },
        });

        if (!item) {
            return {
                success: false,
                error: "Indent item not found",
            };
        }

        // Check if vendor and price are present
        if (!item.vendorId || !item.estimatedPrice) {
            return {
                success: false,
                error: "Vendor and price must be set before final approval",
            };
        }

        // Check if already approved
        if (item.finalApproved) {
            return {
                success: false,
                error: "Already approved",
            };
        }

        // Update the item
        await db.indentItem.update({
            where: { id: itemId },
            data: {
                finalApproved: true,
                finalApprovedBy: workspaceMember.userId,
                finalApprovedAt: new Date(),
                status: "APPROVED",
                // Also mark quantity as approved if not already
                quantityApproved: true,
                quantityApprovedBy: item.quantityApprovedBy || workspaceMember.userId,
                quantityApprovedAt: item.quantityApprovedAt || new Date(),
            },
        });

        revalidatePath(`/w/${workspaceId}/procurement/indent`);

        return {
            success: true,
            message: "Indent item fully approved",
        };
    } catch (error) {
        console.error("Error giving final approval:", error);
        return {
            success: false,
            error: "Failed to approve",
        };
    }
}

/**
 * Reject an indent item
 * Only admins can reject
 */
export async function rejectIndentItem(
    itemId: string,
    workspaceId: string,
    reason: string
) {
    try {
        // Check if user is admin
        const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(workspaceId);

        if (!isWorkspaceAdmin || !workspaceMember) {
            return {
                success: false,
                error: "Only admins can reject items",
            };
        }

        // Update the item
        await db.indentItem.update({
            where: { id: itemId },
            data: {
                status: "REJECTED",
                rejectionReason: reason,
            },
        });

        revalidatePath(`/w/${workspaceId}/procurement/indent`);

        return {
            success: true,
            message: "Indent item rejected",
        };
    } catch (error) {
        console.error("Error rejecting item:", error);
        return {
            success: false,
            error: "Failed to reject item",
        };
    }
}

/**
 * Update vendor and price for an indent item
 * Can be done by leads after quantity approval
 */
export async function updateVendorDetails(
    itemId: string,
    workspaceId: string,
    vendorId: string,
    estimatedPrice: number
) {
    try {
        // Check if user has access (admin or project lead)
        const { hasAccess, workspaceMember } = await getWorkspacePermissions(workspaceId);

        if (!hasAccess || !workspaceMember) {
            return {
                success: false,
                error: "You don't have permission to update vendor details",
            };
        }

        // Get the item
        const item = await db.indentItem.findUnique({
            where: { id: itemId },
        });

        if (!item) {
            return {
                success: false,
                error: "Indent item not found",
            };
        }

        // Check if quantity is approved
        if (!item.quantityApproved) {
            return {
                success: false,
                error: "Quantity must be approved before adding vendor details",
            };
        }

        // Check if already fully approved
        if (item.finalApproved) {
            return {
                success: false,
                error: "Cannot update - item is already approved",
            };
        }

        // Update the item
        await db.indentItem.update({
            where: { id: itemId },
            data: {
                vendorId,
                estimatedPrice,
                status: "VENDOR_PENDING",
            },
        });

        revalidatePath(`/w/${workspaceId}/procurement/indent`);

        return {
            success: true,
            message: "Vendor details updated successfully",
        };
    } catch (error) {
        console.error("Error updating vendor details:", error);
        return {
            success: false,
            error: "Failed to update vendor details",
        };
    }
}
