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
    // 1. Fetch Task details and its parent context (Project/Workspace)
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        workspaceId: true,
        projectId: true,
        createdById: true,
        assigneeId: true,
        reviewerId: true,
        comments: {
          select: { userId: true },
          where: { isDeleted: false },
        },
      },
    });

    if (!task) return [];

    const involvedUserIds = new Set<string>();

    // 2. Add direct participants
    // a. Commenters
    task.comments.forEach(c => involvedUserIds.add(c.userId));

    // b. Resolve Task Creator, Assignee, and Reviewer ProjectMember IDs to User IDs
    const directParticipantIds = [
      task.createdById,
      task.assigneeId,
      task.reviewerId,
    ].filter((id): id is string => !!id);

    if (directParticipantIds.length > 0) {
      const members = await prisma.projectMember.findMany({
        where: { id: { in: directParticipantIds } },
        select: { WorkspaceMember: { select: { userId: true } } },
      });
      members.forEach(m => {
        if (m.WorkspaceMember?.userId) involvedUserIds.add(m.WorkspaceMember.userId);
      });
    }

    // 3. Add Overseeing Roles based on Permissions Hierarchy
    // a. Project Managers & Leads for this project
    const overseeingProjectMembers = await prisma.projectMember.findMany({
      where: {
        projectId: task.projectId,
        projectRole: { in: ["PROJECT_MANAGER", "LEAD"] },
      },
      select: { WorkspaceMember: { select: { userId: true } } },
    });
    overseeingProjectMembers.forEach(m => {
      if (m.WorkspaceMember?.userId) involvedUserIds.add(m.WorkspaceMember.userId);
    });

    // b. Workspace Admins & Owners
    const overseeingWorkspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: task.workspaceId,
        workspaceRole: { in: ["ADMIN", "OWNER"] },
      },
      select: { userId: true },
    });
    overseeingWorkspaceMembers.forEach(m => {
      involvedUserIds.add(m.userId);
    });

    return Array.from(involvedUserIds);
  } catch (error) {
    console.error(`[GET_INVOLVED_USERS_ERROR] Failed for task ${taskId}:`, error);
    return [];
  }
}
