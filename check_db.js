
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const task = await prisma.task.findFirst({
            where: { reviewerId: { not: null } },
            include: {
                reviewer: { 
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

        if (!task) {
            console.log("No task with reviewer found in DB.");
            return;
        }

        console.log("Task ID:", task.id);
        console.log("Reviewer Object Structure Keys:", Object.keys(task.reviewer || {}));
        if (task.reviewer) {
            console.log("WorkspaceMember Keys:", Object.keys(task.reviewer.WorkspaceMember || {}));
            if (task.reviewer.WorkspaceMember) {
                console.log("User Data:", JSON.stringify(task.reviewer.WorkspaceMember.user, null, 2));
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
