// @ts-nocheck -- TODO(tech-debt): legacy procurement/inventory code references Prisma models removed in the schema-integrity refactor (PurchaseOrder/ProcurementTask/Unit/Material). Rewrite against indent/indent_line_item/material_catalog/vendor_quote or remove. See docs/TECH_DEBT.md.
import prisma from "@/lib/db";

export async function getMaterials(workspaceId: string) {
    try {
        const materials = await prisma.material.findMany({
            where: {
                workspaceId: workspaceId,
                isActive: true,
            },
            include: {
                defaultUnit: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return materials;
    } catch (error) {
        console.error("Error fetching materials:", error);
        return [];
    }
}

export type MaterialRow = Awaited<ReturnType<typeof getMaterials>>[number];
