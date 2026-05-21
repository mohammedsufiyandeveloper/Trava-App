import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== PROJECTS ===");
  const projects = await prisma.project.findMany({
    select: { id: true, name: true }
  });
  console.log(projects);

  console.log("\n=== TASKS IN RECENT AUDIT LOGS ===");
  const logs = await prisma.audit_log.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  for (const log of logs) {
    let taskName = "N/A";
    let projName = "N/A";
    if (log.entityId && (log.entityType === "TASK" || log.action.includes("TASK") || log.action.includes("COMMENT"))) {
      const task = await prisma.task.findUnique({
        where: { id: log.entityId },
        include: { project: true }
      });
      if (task) {
        taskName = task.name;
        projName = task.project.name;
      }
    }
    console.log(`Log ID: ${log.id} | Action: ${log.action} | entityId: ${log.entityId} | Task Name: "${taskName}" | Project: "${projName}" | CreatedAt: ${log.createdAt}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
