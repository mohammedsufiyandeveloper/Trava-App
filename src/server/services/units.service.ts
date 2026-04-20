import prisma from "@/lib/db";
import { unitSchema, UnitSchemaType } from "@/lib/zodSchemas";
import { checkUnitAbbreviationExists } from "@/data/inventory/units";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { AppError } from "@/lib/errors/app-error";

/**
 * Units Service
 * Centralized business logic for managing measurement units.
 */
export class UnitsService {
    /**
     * Create a new unit
     */
    async create(data: UnitSchemaType, workspaceId: string, userId: string) {
        // 1. Permission Check
        const { isWorkspaceAdmin } = await getWorkspacePermissions(workspaceId, userId);
        if (!isWorkspaceAdmin) {
            throw AppError.Forbidden("Only workspace admins can create units");
        }

        // 2. Validation
        const validatedData = unitSchema.parse(data);

        // 3. Business Logic
        const abbreviationExists = await checkUnitAbbreviationExists(validatedData.abbreviation, workspaceId);
        if (abbreviationExists) {
            throw AppError.Conflict(`Unit with abbreviation "${validatedData.abbreviation}" already exists`);
        }

        // 4. DB Operation
        return await prisma.unit.create({
            data: {
                name: validatedData.name,
                abbreviation: validatedData.abbreviation,
                category: validatedData.category || null,
                isDefault: false,
                isActive: validatedData.isActive !== false,
                createdBy: userId,
                workspaceId: workspaceId,
            },
        });
    }

    /**
     * Update an existing unit
     */
    async update(id: string, data: UnitSchemaType, workspaceId: string, userId: string) {
        // 1. Get Resource & Check Existence
        const unit = await prisma.unit.findUnique({ where: { id } });
        if (!unit) throw AppError.NotFound("Unit not found");

        if (unit.isDefault) {
            throw AppError.Forbidden("Cannot edit default system units");
        }

        // 2. Permission Check
        const { isWorkspaceAdmin } = await getWorkspacePermissions(workspaceId, userId);
        const canEdit = unit.createdBy === userId || isWorkspaceAdmin;
        if (!canEdit) {
            throw AppError.Forbidden("You do not have permission to edit this unit");
        }

        // 3. Validation
        const validatedData = unitSchema.parse(data);

        // 4. Business Logic (Abbreviation uniqueness)
        const abbreviationExists = await checkUnitAbbreviationExists(
            validatedData.abbreviation,
            workspaceId,
            id
        );
        if (abbreviationExists) {
            throw AppError.Conflict(`Unit with abbreviation "${validatedData.abbreviation}" already exists`);
        }

        // 5. DB Operation
        return await prisma.unit.update({
            where: { id },
            data: {
                name: validatedData.name,
                abbreviation: validatedData.abbreviation,
                category: validatedData.category || null,
                isActive: validatedData.isActive !== false,
            },
        });
    }

    /**
     * Delete (soft delete) a unit
     */
    async delete(id: string, workspaceId: string, userId: string) {
        // 1. Get Resource & Check Existence
        const unit = await prisma.unit.findUnique({ where: { id } });
        if (!unit) throw AppError.NotFound("Unit not found");

        if (unit.isDefault) {
            throw AppError.Forbidden("Cannot delete default system units");
        }

        // 2. Permission Check
        const { isWorkspaceAdmin } = await getWorkspacePermissions(workspaceId, userId);
        const canDelete = unit.createdBy === userId || isWorkspaceAdmin;
        if (!canDelete) {
            throw AppError.Forbidden("You do not have permission to delete this unit");
        }

        // 3. DB Operation (Soft Delete)
        return await prisma.unit.update({
            where: { id },
            data: { isActive: false },
        });
    }
}

// Export singleton instance
export const unitsService = new UnitsService();
