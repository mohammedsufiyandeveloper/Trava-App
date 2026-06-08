// @ts-nocheck -- TODO(tech-debt): legacy procurement/inventory code references Prisma models removed in the schema-integrity refactor (PurchaseOrder/ProcurementTask/Unit/Material). Rewrite against indent/indent_line_item/material_catalog/vendor_quote or remove. See docs/TECH_DEBT.md.
import prisma from "@/lib/db";

export async function getVendors(workspaceId: string) {
    try {
        const vendors = await prisma.vendor.findMany({
            where: {
                workspaceId: workspaceId,
                isActive: true,
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                materials: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            }
        });

        return vendors;
    } catch (error) {
        console.error("Error fetching vendors:", error);
        return [];
    }
}

export type VendorRow = Awaited<ReturnType<typeof getVendors>>[number];
