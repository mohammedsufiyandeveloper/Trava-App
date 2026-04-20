import "server-only";

import { randomUUID } from "crypto";
import prisma from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { getTaskInvolvedUserIds } from "@/lib/involved-users";
import { recordActivity } from "@/lib/audit";
import { resolveProjectMemberId } from "@/lib/auth/resolve-member-chain";
import { parseIST } from "@/lib/utils";

export type TaskStatus = "TO_DO" | "IN_PROGRESS" | "CANCELLED" | "REVIEW" | "HOLD" | "COMPLETED";

interface CreateTaskParams {
    name: string;
    projectId: string;
    workspaceId: string;
    userId: string;
    permissions: any;
    description?: string | null;
    assigneeUserId?: string | null;
    reviewerId?: string | null;
    tagId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    days?: number | null;
    status?: TaskStatus;
}

interface CreateSubTaskParams {
    name: string;
    description?: string;
    projectId: string;
    workspaceId: string;
    parentTaskId: string;
    userId: string;
    permissions: any;
    assigneeUserId?: string | null;
    reviewerId?: string | null;
    tagId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    days?: number;
    status?: TaskStatus;
}

export class TasksService {

    /**
     * Create a base task (Parent/Identity task)
     */
    static async createTask({
        name,
        projectId,
        workspaceId,
        userId,
        permissions,
        description,
        assigneeUserId,
        reviewerId,
        tagId,
        startDate,
        dueDate,
        days,
        status = "TO_DO"
    }: CreateTaskParams) {
        const canSucceed = permissions.isWorkspaceAdmin || permissions.isWorkspaceManager || permissions.canCreateSubTask;
        if (!canSucceed) {
            throw AppError.Forbidden("You don't have permission to create tasks.");
        }

        let projectMember = permissions.projectMember;

        // Auto-join admin/manager if not in project
        if (!projectMember && (permissions.isWorkspaceAdmin || permissions.isWorkspaceManager)) {
            projectMember = await prisma.projectMember.upsert({
                where: {
                    workspaceMemberId_projectId: {
                        workspaceMemberId: permissions.WorkspaceMemberId!,
                        projectId: projectId,
                    }
                },
                update: {}, // No changes if already exists
                create: {
                    project: { connect: { id: projectId } },
                    WorkspaceMember: { connect: { id: permissions.WorkspaceMemberId! } },
                    projectRole: "PROJECT_MANAGER",
                    hasAccess: true,
                }
            });
        }

        if (!projectMember) {
            throw AppError.Forbidden("You must be a project member to create tasks.");
        }

        // Resolve IDs (consistent with subtasks)
        let assigneeId: string | null = null;
        if (assigneeUserId) {
            assigneeId = await resolveProjectMemberId(assigneeUserId, projectId, workspaceId);
        }

        let resolvedReviewerId: string | null = null;
        if (reviewerId) {
            resolvedReviewerId = await resolveProjectMemberId(reviewerId, projectId, workspaceId);
        }

        // Generate slug
        const { generateUniqueSlug } = await import("@/lib/slug-generator");
        const slug = await generateUniqueSlug(name, "task");

        const newTask = await prisma.task.create({
            data: {
                name,
                description,
                taskSlug: slug,
                status,
                projectId,
                workspaceId,
                createdById: projectMember.id,
                assigneeId,
                reviewerId: resolvedReviewerId,
                tagId: tagId || null,
                startDate: startDate ? parseIST(startDate) : null,
                dueDate: dueDate ? parseIST(dueDate) : null,
                days,
                isParent: true,
            },
            include: {
                ProjectMember_Task_assigneeIdToProjectMember: { include: { WorkspaceMember: { include: { user: { select: { id: true, surname: true } } } } } },
                _count: { select: { subTasks: true } }
            }
        });

        // Record Activity
        try {
            const project = await prisma.project.findUnique({ where: { id: projectId }, select: { slug: true } });
            await recordActivity({
                userId,
                userName: permissions.workspaceMember?.surname || permissions.workspaceMember?.name || "Someone",
                workspaceId,
                action: "TASK_CREATED",
                entityType: "TASK",
                entityId: newTask.id,
                newData: { ...newTask, projectSlug: project?.slug },
                broadcastEvent: "team_update",
                targetUserIds: await getTaskInvolvedUserIds(newTask.id),
            });
        } catch (e) {
            console.error("[SERVICE_ERROR] Task activity failed:", e);
        }

        return newTask;
    }

    /**
     * Create a subtask
     */
    static async createSubTask({
        name,
        description,
        projectId,
        workspaceId,
        parentTaskId,
        userId,
        permissions,
        assigneeUserId,
        reviewerId,
        tagId,
        startDate,
        dueDate,
        days,
        status = "TO_DO"
    }: CreateSubTaskParams) {
        const canSucceed = permissions.isWorkspaceAdmin || permissions.isWorkspaceManager || permissions.canCreateSubTask;
        if (!canSucceed) {
            throw AppError.Forbidden("You don't have permission to create subtasks.");
        }

        let projectMember = permissions.projectMember;
        // Auto-join admin/manager if not in project
        if (!projectMember && (permissions.isWorkspaceAdmin || permissions.isWorkspaceManager)) {
            projectMember = await prisma.projectMember.upsert({
                where: {
                    workspaceMemberId_projectId: {
                        workspaceMemberId: permissions.WorkspaceMemberId!,
                        projectId: projectId,
                    }
                },
                update: {}, // No changes if already exists
                create: {
                    project: { connect: { id: projectId } },
                    WorkspaceMember: { connect: { id: permissions.WorkspaceMemberId! } },
                    projectRole: "PROJECT_MANAGER",
                    hasAccess: true,
                }
            });
        }

        if (!projectMember) {
            throw AppError.Forbidden("You must be a project member to create subtasks.");
        }

        // Resolve IDs
        let assigneeId: string | null = null;
        if (assigneeUserId) {
            assigneeId = await resolveProjectMemberId(assigneeUserId, projectId, workspaceId);
        }

        let resolvedReviewerId: string | null = null;
        if (reviewerId) {
            resolvedReviewerId = await resolveProjectMemberId(reviewerId, projectId, workspaceId);
        }
        if (!resolvedReviewerId) {
            resolvedReviewerId = projectMember.id;
        }

        const parentTask = await prisma.task.findUnique({
            where: { id: parentTaskId },
            select: { taskSlug: true }
        });

        if (!parentTask) {
            throw AppError.NotFound("Parent task not found.");
        }

        const { generateUniqueSlug } = await import("@/lib/slug-generator");
        const slug = await generateUniqueSlug(name, 'task', parentTask.taskSlug);

        const newSubTask = await prisma.$transaction(async (tx) => {
            const parent = await tx.task.findUnique({
                where: { id: parentTaskId },
                select: { subtaskCount: true }
            });

            const task = await tx.task.create({
                data: {
                    name,
                    taskSlug: slug,
                    description,
                    status,
                    projectId,
                    workspaceId,
                    parentTaskId,
                    createdById: projectMember.id,
                    assigneeId,
                    reviewerId: resolvedReviewerId!,
                    tagId: tagId || null,
                    startDate: parseIST(startDate),
                    dueDate: parseIST(dueDate),
                    days,
                    isParent: false,
                    position: parent?.subtaskCount || 0,
                },
                include: {
                    ProjectMember_Task_assigneeIdToProjectMember: { include: { WorkspaceMember: { include: { user: { select: { id: true, surname: true } } } } } },
                    tag: { select: { id: true, name: true } },
                    reviewer: { include: { WorkspaceMember: { include: { user: { select: { id: true, surname: true } } } } } }
                }
            });

            await tx.task.update({
                where: { id: parentTaskId },
                data: {
                    subtaskCount: { increment: 1 },
                    completedSubtaskCount: status === "COMPLETED" ? { increment: 1 } : undefined,
                }
            });

            return task;
        });

        // Record Activity
        try {
            const project = await prisma.project.findUnique({ where: { id: projectId }, select: { slug: true } });
            await recordActivity({
                userId,
                userName: permissions.workspaceMember?.surname || permissions.workspaceMember?.name || "Someone",
                workspaceId,
                action: "SUBTASK_CREATED",
                entityType: "SUBTASK",
                entityId: newSubTask.id,
                newData: { ...newSubTask, projectSlug: project?.slug },
                broadcastEvent: "team_update",
                targetUserIds: await getTaskInvolvedUserIds(newSubTask.id),
            });
        } catch (e) {
            console.error("[SERVICE_ERROR] Subtask activity failed:", e);
        }

        return newSubTask;
    }

    /**
     * Update a subtask status with permission validation and audit logging.
     * Centralized in the service layer for consistency between Hono and Server Actions.
     */
    static async updateSubTaskStatus({
        subTaskId,
        newStatus,
        workspaceId,
        projectId,
        userId,
        permissions,
        comment,
        attachmentData
    }: {
        subTaskId: string;
        newStatus: TaskStatus;
        workspaceId: string;
        projectId: string;
        userId: string;
        permissions: any;
        comment?: string;
        attachmentData?: any;
    }) {
        // 1. Fetch Task Data (Include updatedAt to ensure consistent return types)
        const subTask = await prisma.task.findUnique({
            where: { id: subTaskId },
            select: {
                id: true,
                status: true,
                name: true,
                createdById: true,
                assigneeId: true,
                reviewerId: true,
                parentTaskId: true,
                updatedAt: true,
            },
        });

        if (!subTask) {
            throw AppError.NotFound("Subtask not found");
        }

        // 2. Authorization Checks
        const currentProjectMemberId = permissions.projectMember?.id;
        const isWorkspaceAdmin = permissions.isWorkspaceAdmin;
        const isProjectManager = permissions.isProjectManager;
        const isProjectLead = permissions.isProjectLead;

        const isCreator = currentProjectMemberId ? subTask.createdById === currentProjectMemberId : false;
        const isAssignee = currentProjectMemberId ? subTask.assigneeId === currentProjectMemberId : false;

        if (!isWorkspaceAdmin && !isProjectManager) {
            if (isProjectLead) {
                if (!isCreator && !isAssignee) {
                    throw AppError.Forbidden("As a Project Lead, you can only update tasks you created or are assigned to.");
                }
            } else {
                if (!isCreator && !isAssignee) {
                    throw AppError.Forbidden("You can only update tasks that you created or are assigned to.");
                }
            }
        }

        // Specific Restriction: Tasks in REVIEW status
        if (subTask.status === "REVIEW") {
            if (isAssignee && !isWorkspaceAdmin && !isProjectManager) {
                throw AppError.Forbidden("As the assignee, you cannot move this task out of Review status.");
            }
        }

        // 3. Status Transition Validation
        if (subTask.status === newStatus && newStatus !== "REVIEW") {
            return subTask; // No change needed
        }

        const needsActivity = (subTask.status === "REVIEW" && newStatus !== "COMPLETED") || newStatus === "REVIEW";
        if (needsActivity && !comment && !attachmentData) {
            throw AppError.ValidationError("A comment or attachment is required for this status transition.");
        }

        // 4. Atomic Database Update
        const updated = await prisma.$transaction(async (tx) => {
            // Create activity if provided
            if (comment && needsActivity) {
                await tx.activity.create({
                    data: {
                        id: randomUUID(),
                        subTaskId: subTaskId,
                        authorId: userId,
                        workspaceId: workspaceId,
                        text: comment.trim(),
                        attachment: attachmentData,
                        updatedAt: new Date(),
                    },
                });
            }

            // Update parent task completed count if needed
            if (subTask.parentTaskId) {
                const wasCompleted = subTask.status === "COMPLETED";
                const isNowCompleted = newStatus === "COMPLETED";

                if (wasCompleted !== isNowCompleted) {
                    await tx.task.update({
                        where: { id: subTask.parentTaskId },
                        data: {
                            completedSubtaskCount: { [isNowCompleted ? "increment" : "decrement"]: 1 }
                        }
                    });
                }
            }

            return await tx.task.update({
                where: { id: subTaskId },
                data: { status: newStatus },
                select: { id: true, status: true, updatedAt: true },
            });
        });

        // 5. Record Activity & Broadcast (Asynchronous)
        try {
            const targetUserIds = await getTaskInvolvedUserIds(subTaskId);
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, surname: true } });

            await recordActivity({
                userId,
                userName: user?.surname || user?.name || "Someone",
                workspaceId,
                action: "SUBTASK_UPDATED",
                entityType: "SUBTASK",
                entityId: subTaskId,
                oldData: { status: subTask.status, name: subTask.name },
                newData: { status: newStatus },
                broadcastEvent: "team_update",
                targetUserIds,
            });
        } catch (e) {
            console.error("[SERVICE_ERROR] Failed to record activity:", e);
        }

        return updated;
    }

    /**
     * Get a task by ID with full relations
     */
    static async getTaskById(taskId: string) {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                ProjectMember_Task_assigneeIdToProjectMember: { include: { WorkspaceMember: { include: { user: { select: { id: true, name: true, surname: true, image: true, email: true } } } } } },
                reviewer: { include: { WorkspaceMember: { include: { user: { select: { id: true, name: true, surname: true, image: true } } } } } },
                tag: true,
                project: { select: { id: true, name: true, slug: true, workspaceId: true } },
                _count: { select: { subTasks: true } },
                Task_TaskDependency_A: { select: { id: true } }
            }
        });

        if (!task) throw AppError.NotFound("Task not found");
        return task;
    }

    /**
     * Update a task (Parent or Subtask)
     */
    static async updateTask({
        taskId,
        workspaceId,
        projectId,
        userId,
        permissions,
        data
    }: {
        taskId: string;
        workspaceId: string;
        projectId: string;
        userId: string;
        permissions: any;
        data: Partial<CreateSubTaskParams>;
    }) {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, createdById: true, assigneeId: true, parentTaskId: true, name: true, status: true }
        });

        if (!task) throw AppError.NotFound("Task not found");

        const currentProjectMemberId = permissions.projectMember?.id;
        const isWorkspaceAdmin = permissions.isWorkspaceAdmin;
        const isProjectManager = permissions.isProjectManager;

        // 1. Base Authorization
        const isAuthorized = isWorkspaceAdmin ||
            isProjectManager ||
            (currentProjectMemberId && (task.createdById === currentProjectMemberId || task.assigneeId === currentProjectMemberId));

        if (!isAuthorized) {
            throw AppError.Forbidden("You don't have permission to update this task.");
        }

        // 2. Hierarchy Rules
        if (task.assigneeId) {
            const assignee = await prisma.projectMember.findUnique({
                where: { id: task.assigneeId },
                select: { projectRole: true }
            });

            if (assignee?.projectRole === "PROJECT_MANAGER" && !isWorkspaceAdmin) {
                throw AppError.Forbidden("Only a Workspace Admin can edit tasks assigned to a Project Manager.");
            }
            if (assignee?.projectRole === "LEAD" && !isWorkspaceAdmin && !isProjectManager) {
                throw AppError.Forbidden("Only a Workspace Admin or Project Manager can edit tasks assigned to a Project Lead.");
            }
        }

        // Prepare update data
        const updateData: any = {};
        if (data.name) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.status) updateData.status = data.status;
        if (data.tagId !== undefined) updateData.tagId = data.tagId;
        if (data.days !== undefined) updateData.days = data.days;
        if (data.startDate !== undefined) updateData.startDate = parseIST(data.startDate as any);
        if (data.dueDate !== undefined) updateData.dueDate = parseIST(data.dueDate as any);

        if (data.assigneeUserId !== undefined) {
            updateData.assigneeId = data.assigneeUserId
                ? await resolveProjectMemberId(data.assigneeUserId, projectId, workspaceId)
                : null;
        }
        if (data.reviewerId !== undefined) {
            updateData.reviewerId = data.reviewerId
                ? await resolveProjectMemberId(data.reviewerId, projectId, workspaceId)
                : null;
        }

        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.task.update({
                where: { id: taskId },
                data: updateData,
            });

            // If status changed and it's a subtask, update parent completed count
            if (data.status && data.status !== task.status && task.parentTaskId) {
                const wasCompleted = task.status === "COMPLETED";
                const isNowCompleted = data.status === "COMPLETED";
                if (wasCompleted !== isNowCompleted) {
                    await tx.task.update({
                        where: { id: task.parentTaskId },
                        data: {
                            completedSubtaskCount: { [isNowCompleted ? "increment" : "decrement"]: 1 }
                        }
                    });
                }
            }

            return result;
        });

        // Record activity with surgical delta
        try {
            // Prepare minimal oldData based on updated fields to ensure clean audit logs
            const oldData: any = {};
            if (data.name) oldData.name = task.name;
            if (data.status) oldData.status = task.status;
            if (data.assigneeUserId) oldData.assigneeId = task.assigneeId;

            await recordActivity({
                userId,
                userName: permissions.workspaceMember?.surname || permissions.workspaceMember?.name || "Someone",
                workspaceId,
                action: task.parentTaskId ? "SUBTASK_UPDATED" : "TASK_UPDATED",
                entityType: task.parentTaskId ? "SUBTASK" : "TASK",
                entityId: taskId,
                oldData,
                newData: updateData,
                broadcastEvent: "team_update",
                targetUserIds: await getTaskInvolvedUserIds(taskId),
            });
        } catch (e) {
            console.error("[SERVICE_ERROR] Update activity failed:", e);
        }

        return updated;
    }

    /**
     * Delete a task (Parent or Subtask)
     */
    static async deleteTask({
        taskId,
        workspaceId,
        projectId,
        userId,
        permissions
    }: {
        taskId: string;
        workspaceId: string;
        projectId: string;
        userId: string;
        permissions: any;
    }) {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, name: true, status: true, createdById: true, parentTaskId: true }
        });

        if (!task) throw AppError.NotFound("Task not found");

        const currentProjectMemberId = permissions.projectMember?.id;
        const isAuthorized = permissions.isWorkspaceAdmin ||
            permissions.isProjectManager ||
            (currentProjectMemberId && task.createdById === currentProjectMemberId);

        if (!isAuthorized) {
            throw AppError.Forbidden("You don't have permission to delete this task.");
        }

        const targetUserIds = await getTaskInvolvedUserIds(taskId);

        await prisma.$transaction(async (tx) => {
            // Delete the task
            await tx.task.delete({ where: { id: taskId } });

            // If it was a subtask, decrement parent counters
            if (task.parentTaskId) {
                await tx.task.update({
                    where: { id: task.parentTaskId },
                    data: {
                        subtaskCount: { decrement: 1 },
                        completedSubtaskCount: task.status === "COMPLETED" ? { decrement: 1 } : undefined
                    }
                });
            }
        });

        // Record activity
        try {
            await recordActivity({
                userId,
                userName: permissions.workspaceMember?.surname || permissions.workspaceMember?.name || "Someone",
                workspaceId,
                action: task.parentTaskId ? "SUBTASK_DELETED" : "TASK_DELETED",
                entityType: task.parentTaskId ? "SUBTASK" : "TASK",
                entityId: taskId,
                oldData: { name: task.name, status: task.status, projectId },
                broadcastEvent: "team_update",
                targetUserIds,
            });
        } catch (e) {
            console.error("[SERVICE_ERROR] Delete activity failed:", e);
        }

        return { id: taskId };
    }

    /**
     * Update task dates (Gantt style)
     */
    static async updateTaskDates({
        taskId,
        startDate,
        dueDate,
        workspaceId,
        userId,
        permissions
    }: {
        taskId: string;
        startDate: string | Date;
        dueDate: string | Date;
        workspaceId: string;
        projectId: string;
        userId: string;
        permissions: any;
    }) {
        const start = parseIST(startDate as any);
        const end = parseIST(dueDate as any);

        if (!start || !end) throw AppError.ValidationError("Invalid dates");
        if (start > end) throw AppError.ValidationError("Start date must be before end date");

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true, createdById: true, assigneeId: true, parentTaskId: true, name: true }
        });

        if (!task) throw AppError.NotFound("Task not found");

        const isWorkspaceAdmin = permissions.isWorkspaceAdmin;
        const isProjectManager = permissions.isProjectManager;
        const currentProjectMemberId = permissions.projectMember?.id;

        // 1. Permission Check
        const isAuthorized = isWorkspaceAdmin || isProjectManager ||
            (permissions.isProjectLead && currentProjectMemberId && task.createdById === currentProjectMemberId);

        if (!isAuthorized) {
            throw AppError.Forbidden("Only Project Managers or the Task Creator can manage the timeline.");
        }

        // 2. Hierarchy Check
        if (task.assigneeId) {
            const assignee = await prisma.projectMember.findUnique({
                where: { id: task.assigneeId },
                select: { projectRole: true }
            });

            if (assignee?.projectRole === "PROJECT_MANAGER" && !isWorkspaceAdmin) {
                throw AppError.Forbidden("Only a Workspace Admin can update tasks assigned to a Project Manager.");
            }
            if (assignee?.projectRole === "LEAD" && !isWorkspaceAdmin && !isProjectManager) {
                throw AppError.Forbidden("Only a Workspace Admin or Project Manager can update tasks assigned to a Project Lead.");
            }
        }

        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;

        const updated = await prisma.task.update({
            where: { id: taskId },
            data: { startDate: start, dueDate: end, days },
        });

        // Record activity
        try {
            await recordActivity({
                userId,
                userName: permissions.workspaceMember?.surname || permissions.workspaceMember?.name || "Someone",
                workspaceId,
                action: "TASK_UPDATED",
                entityType: "TASK",
                entityId: taskId,
                newData: { startDate: start, dueDate: end, days },
                broadcastEvent: "team_update",
                targetUserIds: await getTaskInvolvedUserIds(taskId),
            });
        } catch (e) {
            console.error("[SERVICE_ERROR] Date update activity failed:", e);
        }

        return updated;
    }

    /**
     * Add a dependency between two tasks
     */
    static async addDependency({
        subtaskId,
        dependsOnId,
        projectId,
        workspaceId,
        permissions
    }: {
        subtaskId: string;
        dependsOnId: string;
        projectId: string;
        workspaceId: string;
        permissions: any;
    }) {
        if (subtaskId === dependsOnId) throw AppError.ValidationError("A task cannot depend on itself");

        const [subtask, dependsOnTask] = await Promise.all([
            prisma.task.findUnique({ where: { id: subtaskId }, select: { id: true, createdById: true, startDate: true, days: true } }),
            prisma.task.findUnique({ where: { id: dependsOnId }, select: { id: true, startDate: true, days: true } })
        ]);

        if (!subtask || !dependsOnTask) throw AppError.NotFound("One or both tasks not found");

        const isAuthorized = permissions.isWorkspaceAdmin || permissions.isProjectLead ||
            (permissions.projectMember && subtask.createdById === permissions.projectMember.id);

        if (!isAuthorized) {
            throw AppError.Forbidden("Only project admin, lead, or task creator can add dependencies.");
        }

        const isCircular = await this.checkCircularDependency(subtaskId, dependsOnId);
        if (isCircular) throw AppError.ValidationError("This would create a circular dependency");

        await prisma.task.update({
            where: { id: subtaskId },
            data: { Task_TaskDependency_A: { connect: { id: dependsOnId } } }
        });

        // Finish-to-Start auto-adjustment
        if (dependsOnTask.startDate && dependsOnTask.days && subtask.startDate) {
            const dependsOnEndDate = new Date(dependsOnTask.startDate);
            dependsOnEndDate.setDate(dependsOnEndDate.getDate() + dependsOnTask.days - 1);

            const newSubtaskStartDate = new Date(dependsOnEndDate);
            newSubtaskStartDate.setDate(newSubtaskStartDate.getDate() + 1);

            if (subtask.startDate < newSubtaskStartDate) {
                await prisma.task.update({
                    where: { id: subtaskId },
                    data: { startDate: newSubtaskStartDate }
                });
            }
        }

        return { success: true };
    }

    /**
     * Remove a dependency
     */
    static async removeDependency({
        subtaskId,
        dependsOnId,
        permissions
    }: {
        subtaskId: string;
        dependsOnId: string;
        permissions: any;
    }) {
        const subtask = await prisma.task.findUnique({ where: { id: subtaskId }, select: { createdById: true } });
        if (!subtask) throw AppError.NotFound("Subtask not found");

        const isAuthorized = permissions.isWorkspaceAdmin || permissions.isProjectLead ||
            (permissions.projectMember && subtask.createdById === permissions.projectMember.id);

        if (!isAuthorized) {
            throw AppError.Forbidden("Only project admin, lead, or task creator can remove dependencies.");
        }

        await prisma.task.update({
            where: { id: subtaskId },
            data: { Task_TaskDependency_A: { disconnect: { id: dependsOnId } } }
        });

        return { success: true };
    }

    /**
     * Helper to check circular dependencies
     */
    private static async checkCircularDependency(subtaskId: string, dependsOnId: string): Promise<boolean> {
        const visited = new Set<string>();
        let currentLevel = [dependsOnId];

        while (currentLevel.length > 0) {
            if (currentLevel.includes(subtaskId)) return true;
            currentLevel.forEach(id => visited.add(id));

            const tasks = await prisma.task.findMany({
                where: { id: { in: currentLevel } },
                select: { Task_TaskDependency_A: { select: { id: true } } }
            });

            const nextLevel: string[] = [];
            tasks.forEach(task => {
                task.Task_TaskDependency_A.forEach(dep => {
                    if (!visited.has(dep.id)) nextLevel.push(dep.id);
                });
            });

            currentLevel = Array.from(new Set(nextLevel));
            if (visited.size > 1000) break;
        }
        return false;
    }

    /**
     * Update the order of subtasks
     */
    static async updateSubtasksOrder(subtaskIds: string[]) {
        if (!subtaskIds.length) return;

        await prisma.$transaction(
            subtaskIds.map((id, index) =>
                prisma.task.update({
                    where: { id },
                    data: { position: index }
                })
            )
        );
    }
}
