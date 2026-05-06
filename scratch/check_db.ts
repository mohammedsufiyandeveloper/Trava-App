import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const userId = "17deca7b-f98d-40dd-86f0-ca588adfc637";
    const projectId = "0acd7252-6a73-4208-849a-6608abb2458c";

    console.log("Checking User:", userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    console.log("User found:", !!user);

    console.log("Checking WorkspaceMember for User...");
    const wsMembers = await prisma.workspaceMember.findMany({
        where: { userId },
        include: { user: true }
    });
    console.log(`Found ${wsMembers.length} workspace members.`);
    wsMembers.forEach(wm => console.log(` - WM ID: ${wm.id}, Role: ${wm.workspaceRole}`));

    console.log("Checking ProjectMember for User in Project:", projectId);
    const pm = await prisma.projectMember.findFirst({
        where: {
            projectId,
            WorkspaceMember: { userId }
        },
        include: { WorkspaceMember: true }
    });
    
    if (pm) {
        console.log(`ProjectMember found: ${pm.id}, Role: ${pm.projectRole}`);
        
        console.log("Checking tasks assigned to this ProjectMember...");
        const tasks = await prisma.task.findMany({
            where: { assigneeId: pm.id },
            select: { id: true, name: true, parentTaskId: true }
        });
        console.log(`Found ${tasks.length} tasks assigned to PM ${pm.id}:`);
        tasks.forEach(t => console.log(` - [${t.parentTaskId ? "Sub" : "Parent"}] ${t.name} (ID: ${t.id})`));
    } else {
        console.log("No ProjectMember found for this user in this project.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
