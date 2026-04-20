
/**
 * Normalizes a ProjectMember object (Assignee or Reviewer) 
 * for UI consistency across Web and Mobile.
 */
export const normalizeMember = (member: any) => {
    if (!member) return member;

    // Search for user details in any possible Prisma relation path
    const wsMember = member.WorkspaceMember || member.workspaceMember;
    const user = wsMember?.user || member.user;

    return {
        ...member,
        WorkspaceMember: wsMember,
        workspaceMember: wsMember,
        // Standardize on Surname as the primary name field
        name: user?.surname || user?.name || member.name,
        surname: user?.surname,
        image: user?.image || member.image,
    };
};

/**
 * Standard mapper to ensure Prisma results are compatible with the Task UI.
 * Handles the renamed assignee relation and ensures reviewers are included.
 * Operates recursively on subTasks.
 */
export function mapTaskAssignee(task: any): any {
    if (!task) return task;

    const mapped = {
        ...task,
        // Map the long Prisma relation name and normalize it
        assignee: normalizeMember(task.ProjectMember_Task_assigneeIdToProjectMember || task.assignee),
        reviewer: normalizeMember(task.reviewer),
    };

    if (mapped.subTasks && Array.isArray(mapped.subTasks)) {
        mapped.subTasks = mapped.subTasks.map(mapTaskAssignee);
    }

    return mapped;
}
