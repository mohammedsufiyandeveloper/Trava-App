import prisma from "../src/lib/db";

async function test() {
    const userId = "some-user-id"; // replace with a real ID for manual testing
    const workspacesData = await prisma.workspace.findMany({
        where: {
            members: {
                some: { userId }
            }
        },
        select: {
            id: true,
            name: true,
            members: {
                where: { userId },
                select: {
                    workspaceRole: true,
                    ProjectMember: {
                        where: {
                            projectRole: { in: ["PROJECT_MANAGER", "LEAD"] }
                        },
                        select: { id: true },
                        take: 1
                    }
                },
            },
        },
    });
    console.log(JSON.stringify(workspacesData, null, 2));
}
// test();
