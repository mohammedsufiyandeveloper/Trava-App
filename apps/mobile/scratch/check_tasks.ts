
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectName = "Dhruva";
  const project = await prisma.project.findFirst({
    where: { name: { contains: projectName, mode: 'insensitive' } }
  });

  if (!project) {
    console.error(`Project "${projectName}" not found`);
    return;
  }

  console.log(`Checking tasks for Project: ${project.name} (${project.id})`);

  const tasks = await prisma.task.findMany({
    where: { projectId: project.id },
    select: {
      id: true,
      name: true,
      parentTaskId: true,
      isParent: true,
      status: true
    }
  });

  console.log(`Total tasks found: ${tasks.length}`);
  
  const parents = tasks.filter(t => t.parentTaskId === null);
  const subtasks = tasks.filter(t => t.parentTaskId !== null);

  console.log(`\nParents (${parents.length}):`);
  parents.slice(0, 10).forEach(p => console.log(` - [${p.id}] ${p.name} (isParent: ${p.isParent})`));
  if (parents.length > 10) console.log("   ...");

  console.log(`\nSubtasks (${subtasks.length}):`);
  subtasks.slice(0, 20).forEach(s => {
    const parent = parents.find(p => p.id === s.parentTaskId);
    console.log(` - [${s.id}] ${s.name} (Parent: ${parent ? parent.name : s.parentTaskId})`);
  });
  if (subtasks.length > 20) console.log("   ...");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
