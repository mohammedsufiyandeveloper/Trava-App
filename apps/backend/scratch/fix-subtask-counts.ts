
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSubtaskCounts() {
  console.log('Starting subtask count repair...');

  // 1. Fetch all parent tasks
  const parentTasks = await prisma.task.findMany({
    where: { isParent: true },
    select: { id: true, name: true }
  });

  console.log(`Found ${parentTasks.length} parent tasks to check.`);

  for (const parent of parentTasks) {
    // 2. Count actual subtasks in DB
    const actualCount = await prisma.task.count({
      where: { parentTaskId: parent.id }
    });

    const completedCount = await prisma.task.count({
        where: { 
            parentTaskId: parent.id,
            status: 'COMPLETED'
        }
    });

    // 3. Update the parent task with the correct counts
    await prisma.task.update({
      where: { id: parent.id },
      data: { 
        subtaskCount: actualCount,
        completedSubtaskCount: completedCount
      }
    });

    console.log(`Updated "${parent.name}": subtaskCount = ${actualCount}, completedCount = ${completedCount}`);
  }

  console.log('Subtask count repair complete!');
}

fixSubtaskCounts()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
