import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: { tasks: true }
      }
    }
  });
  console.log("Projects and task counts:");
  console.log(projects);
}

main().catch(console.error).finally(() => prisma.$disconnect());
