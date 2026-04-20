"use server";

import prisma from "@/lib/db";
import { unitSchema, UnitSchemaType } from "@/lib/zodSchemas";
import { checkUnitAbbreviationExists } from "@/data/inventory/units";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";

/**
 * Create a new unit
 * Only authorized users (ADMIN/OWNER) can create units
 */
export async function createUnit(data: UnitSchemaType, workspaceId: string) {
    try {
        // Check permissions - only ADMIN/OWNER can create units
        // getWorkspacePermissions already calls requireUser() internally
        const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(workspaceId);

        if (!isWorkspaceAdmin || !workspaceMember) {
            return {
                status: "error" as const,
                message: "Only workspace admins can create units",
            };
        }

        // Validate input
        const validatedData = unitSchema.parse(data);

        // Check if abbreviation already exists
        const abbreviationExists = await checkUnitAbbreviationExists(validatedData.abbreviation, workspaceId);
        if (abbreviationExists) {
            return {
                status: "error" as const,
                message: `Unit with abbreviation "${validatedData.abbreviation}" already exists`,
            };
        }

        // Create the unit
        const unit = await prisma.unit.create({
            data: {
                name: validatedData.name,
                abbreviation: validatedData.abbreviation,
                category: validatedData.category || null,
                isDefault: false, // User-created units are never default
                isActive: validatedData.isActive !== false, // Default to true
                createdBy: workspaceMember.userId, // Track who created it (User ID)
                workspaceId: workspaceId,
            },
        });

        return {
            status: "success" as const,
            message: `Unit "${unit.name}" created successfully`,
            data: unit,
        };
    } catch (error) {
        console.error("Error creating unit:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to create unit",
        };
    }
}

/**
 * Update an existing unit
 * Only creator or ADMIN/OWNER can update
 */
export async function updateUnit(id: string, data: UnitSchemaType, workspaceId: string) {
    try {
        // Get the unit to check permissions
        const unit = await prisma.unit.findUnique({
            where: { id },
        });

        if (!unit) {
            return {
                status: "error" as const,
                message: "Unit not found",
            };
        }

        // Check if unit is default/seeded
        if (unit.isDefault) {
            return {
                status: "error" as const,
                message: "Cannot edit default units. These are system units.",
            };
        }

        // Check permissions
        // getWorkspacePermissions already calls requireUser() internally
        const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(workspaceId);
        const canEdit = (workspaceMember && unit.createdBy === workspaceMember.userId) || isWorkspaceAdmin;

        if (!canEdit) {
            return {
                status: "error" as const,
                message: "You don't have permission to edit this unit. Only the creator or workspace admin can edit it.",
            };
        }

        // Validate input
        const validatedData = unitSchema.parse(data);

        // Check if abbreviation already exists (excluding current unit)
        const abbreviationExists = await checkUnitAbbreviationExists(
            validatedData.abbreviation,
            workspaceId,
            id
        );
        if (abbreviationExists) {
            return {
                status: "error" as const,
                message: `Unit with abbreviation "${validatedData.abbreviation}" already exists`,
            };
        }

        // Update the unit
        const updatedUnit = await prisma.unit.update({
            where: { id },
            data: {
                name: validatedData.name,
                abbreviation: validatedData.abbreviation,
                category: validatedData.category || null,
                isActive: validatedData.isActive !== false,
            },
        });

        return {
            status: "success" as const,
            message: `Unit "${updatedUnit.name}" updated successfully`,
            data: updatedUnit,
        };
    } catch (error) {
        console.error("Error updating unit:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to update unit",
        };
    }
}

/**
 * Delete (soft delete) a unit
 * Only allows deletion if:
 * 1. Unit is not a default/seeded unit (isDefault = false)
 * 2. User is the creator OR user is admin/owner
 */
export async function deleteUnit(id: string, workspaceId: string) {
    try {
        // Get the unit to check permissions
        const unit = await prisma.unit.findUnique({
            where: { id },
        });

        if (!unit) {
            return {
                status: "error" as const,
                message: "Unit not found",
            };
        }

        // Check if unit is a default/seeded unit
        if (unit.isDefault) {
            return {
                status: "error" as const,
                message: "Cannot delete default units. These are system units and cannot be removed.",
            };
        }

        // Check if user has permission to delete
        // getWorkspacePermissions already calls requireUser() internally
        const { isWorkspaceAdmin, workspaceMember } = await getWorkspacePermissions(workspaceId);
        const canDelete = (workspaceMember && unit.createdBy === workspaceMember.userId) || isWorkspaceAdmin;

        if (!canDelete) {
            return {
                status: "error" as const,
                message: "You don't have permission to delete this unit. Only the creator or workspace admin can delete it.",
            };
        }

        // Soft delete by setting isActive to false
        await prisma.unit.update({
            where: { id },
            data: { isActive: false },
        });

        return {
            status: "success" as const,
            message: `Unit "${unit.name}" deleted successfully`,
        };
    } catch (error) {
        console.error("Error deleting unit:", error);
        return {
            status: "error" as const,
            message: error instanceof Error ? error.message : "Failed to delete unit",
        };
    }
}
