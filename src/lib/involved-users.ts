import prisma from "./db";

/**
 * Fetches all unique User IDs involved in a task.
 * Involved users include:
 * - Task Creator
 * - Task Assignee
 * - Task Reviewer
 * - All unique commenters on the task
 * 
 * @param taskId - ID of the task or subtask
 * @returns Array of unique User IDs
 */
export async function getTaskInvolvedUserIds(taskId: string): Promise<string[]> {
  try {
    // 1. Fetch Task details including participants
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        createdById: true,
        assigneeId: true,
        reviewerId: true,
        // Also get commenters directly
        comments: {
          select: {
            userId: true,
          },
          where: {
            isDeleted: false,
          },
        },
      },
    });

    if (!task) return [];

    const involvedUserIds = new Set<string>();

    // 2. Add individual commenters
    task.comments.forEach(c => involvedUserIds.add(c.userId));

    // 3. Resolve ProjectMember IDs to User IDs
    // We need to fetch the User IDs for creator, assignee, and reviewer
    const projectMemberIds = [
      task.createdById,
      task.assigneeId,
      task.reviewerId,
    ].filter((id): id is string => !!id);

    if (projectMemberIds.length > 0) {
      const members = await prisma.projectMember.findMany({
        where: { id: { in: projectMemberIds } },
        select: {
          WorkspaceMember: {
            select: {
              userId: true,
            },
          },
        },
      });

      members.forEach(m => {
        if ((m as any).WorkspaceMember?.userId) {
          involvedUserIds.add((m as any).WorkspaceMember.userId);
        }
      });
    }

    return Array.from(involvedUserIds);
  } catch (error) {
    console.error(`[GET_INVOLVED_USERS_ERROR] Failed for task ${taskId}:`, error);
    return [];
  }
}
