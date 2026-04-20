import prisma from "@/lib/db";

/**
 * Syncs a task to the Procurement Routing Table based on its tag.
 * 
 * Flow:
 * 1. Checks if the task has a tag.
 * 2. If the tag has `requirePurchase: true`, ensures the task exists in `ProcurementTask`.
 * 3. If the tag does NOT have `requirePurchase: true` (or no tag), removes the task from `ProcurementTask`.
 * 
 * @param taskId - The ID of the task to sync
 */
export async function syncTaskToProcurement(taskId: string) {
    try {
        // 1. Fetch Task with Tag and Project/Workspace context
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: {
                id: true,
                projectId: true,
                project: {
                    select: { workspaceId: true }
                },
                tag: {
                    select: { requirePurchase: true }
                }
            }
        });

        if (!task) return;

        const shouldBeInProcurement = task.tag?.requirePurchase === true;

        if (shouldBeInProcurement) {
            // Upsert: Create if not exists, do nothing if exists (or update if we had fields to update)
            await prisma.procurementTask.upsert({
                where: { taskId: task.id },
                create: {
                    taskId: task.id,
                    projectId: task.projectId,
                    workspaceId: task.project.workspaceId
                },
                update: {
                    // If the task moved projects (rare), we update the references
                    projectId: task.projectId,
                    workspaceId: task.project.workspaceId
                }
            });
        } else {
            // Remove from procurement if it no longer meets criteria
            // We use deleteMany to avoid error if record doesn't exist
            await prisma.procurementTask.deleteMany({
                where: { taskId: task.id }
            });
        }

    } catch (error) {
        console.error(`[ProcurementSync] Failed to sync task ${taskId}:`, error);
        // We swallow the error here to prevent blocking the main task flow, 
        // but in a production system you might want to queue a retry.
    }
}

/**
 * Fetches all procurement tasks for a specific workspace.
 * Returns the join with the Task details.
 */
export async function getWorkspaceProcurementTasks(workspaceId: string) {
    return prisma.procurementTask.findMany({
        where: { workspaceId },
        include: {
            task: {
                select: {
                    id: true,
                    name: true,
                    status: true,
                    tag: true,
                    ProjectMember_Task_assigneeIdToProjectMember: {
                        select: {
                            id: true,
                            WorkspaceMember: { select: { user: { select: { surname: true } } } }
                        }
                    }
                }
            },
            project: {
                select: {
                    name: true,
                    slug: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
}
