import prisma from "../src/lib/db";

async function main() {
    const project = await prisma.project.findFirst({
        where: { name: { contains: "Office Renovation", mode: "insensitive" } },
        include: {
            projectMembers: {
                include: {
                    WorkspaceMember: {
                        include: {
                            user: true
                        }
                    }
                }
            }
        }
    });

    if (!project) {
        console.log("Project not found!");
        return;
    }

    console.log(`=== Project: ${project.name} (ID: ${project.id}) ===`);
    project.projectMembers.forEach(m => {
        const user = m.WorkspaceMember.user;
        console.log(`- Member Name: ${user.name} ${user.surname || ""}, Project Role: ${m.projectRole}, hasAccess: ${m.hasAccess}, ID: ${m.id}`);
    });
}

main().catch(console.error);
