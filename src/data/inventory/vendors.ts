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
