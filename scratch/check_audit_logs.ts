import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true }
  });
  console.log("PROJECTS:", JSON.stringify(projects, null, 2));

  const logs = await prisma.audit_log.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log("LOGS:", JSON.stringify(logs, null, 2));

  const tasks = await prisma.task.findMany({
    select: { id: true, name: true, projectId: true }
  });
  console.log("TASKS:", JSON.stringify(tasks, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
