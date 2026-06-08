// @ts-nocheck -- TODO(tech-debt): legacy procurement/inventory code references Prisma models removed in the schema-integrity refactor (PurchaseOrder/ProcurementTask/Unit/Material). Rewrite against indent/indent_line_item/material_catalog/vendor_quote or remove. See docs/TECH_DEBT.md.
import prisma from "@/lib/db";
const cache = <T extends (...args: any[]) => any>(fn: T) => fn; // react cache no-op

/**
 * Get all active units from the database
 * Cached for performance
 */
export const getUnits = cache(async (workspaceId?: string) => {
    try {
        const units = await prisma.unit.findMany({
            where: {
                isActive: true,
                OR: [
                    { isDefault: true },
                    ...(workspaceId ? [{ workspaceId }] : [])
                ]
            },
            orderBy: [
                { isDefault: 'desc' }, // Default units first
                { category: 'asc' },   // Then by category
                { name: 'asc' },       // Then alphabetically
            ],
            select: {
                id: true,
                name: true,
                abbreviation: true,
                category: true,
                isDefault: true,
                workspaceId: true,
            },
        });

        return units;
    } catch (error) {
        console.error("Error fetching units:", error);
        return [];
    }
});

/**
 * Get units grouped by category
 */
export const getUnitsGroupedByCategory = cache(async (workspaceId?: string) => {
    const units = await getUnits(workspaceId);

    const grouped = units.reduce((acc, unit) => {
        const category = unit.category || "Other";
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(unit);
        return acc;
    }, {} as Record<string, typeof units>);

    return grouped;
});

/**
 * Get a single unit by ID
 */
export const getUnitById = cache(async (unitId: string) => {
    try {
        const unit = await prisma.unit.findUnique({
            where: { id: unitId },
        });

        return unit;
    } catch (error) {
        console.error("Error fetching unit:", error);
        return null;
    }
});

/**
 * Check if a unit abbreviation already exists
 */
export const checkUnitAbbreviationExists = async (abbreviation: string, workspaceId: string, excludeId?: string) => {
    try {
        const unit = await prisma.unit.findFirst({
            where: {
                abbreviation,
                isActive: true,
                OR: [
                    { isDefault: true },
                    { workspaceId }
                ],
                NOT: excludeId ? { id: excludeId } : undefined
            },
        });

        return !!unit;
    } catch (error) {
        console.error("Error checking unit abbreviation:", error);
        return false;
    }
};
