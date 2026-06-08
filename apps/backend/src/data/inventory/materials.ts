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
