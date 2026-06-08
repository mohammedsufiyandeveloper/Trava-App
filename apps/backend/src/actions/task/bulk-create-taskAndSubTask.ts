"use server"

import { getUserPermissions } from "@/data/user/get-user-permissions";
import { invalidateTaskMutation } from "@/lib/cache/invalidation";
import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { generateUniqueSlugs } from "@/lib/slug-generator";
import { ApiResponse } from "@/lib/types";
import { parseIST } from "@/lib/utils";

function calculateDueDate(startDate: Date | undefined, days: number | undefined): Date | undefined {
    if (!startDate || days === undefined || days === null) return undefined;
    // Add days as milliseconds to stay timezone-agnostic for the duration calculation
    const dueDate = new Date(startDate.getTime() + (Number(days) * 24 * 60 * 60 * 1000));
    return dueDate;
}

export async function bulkUploadTasksAndSubtasks(data: {
    projectId: string;
    tasks: Array<{
        taskName: string;
        subtaskName?: string;
        description?: string;
        assigneeEmail?: string;
        reviewerEmail?: string;
        startDate?: string;
        days?: number;
        status?: string;
        tag?: string;
    }>;
}): Promise<ApiResponse> {
    const user = await requireUser();

    try {
        if (!data.tasks || data.tasks.length === 0) {
            return {
                status: "error",
                message: "No tasks provided"
            };
        }

        // Get project and verify permissions
        const project = await prisma.project.findUnique({
            where: { id: data.projectId },
            select: { workspaceId: true, slug: true }
        });

        if (!project) {
            return {
                status: "error",
                message: "Project not found",
            };
        }

        const permissions = await getUserPermissions(project.workspaceId, data.projectId);

        if (!permissions.WorkspaceMember) {
            return {
                status: "error",
                message: "You are not a member of this workspace",
            };
        }

        const projectMembers = await prisma.projectMember.findMany({
            where: { projectId: data.projectId },
            include: {
                WorkspaceMember: {
                    include: {
                        user: {
                            select: { email: true, id: true, surname: true }
                        }
                    }
                }
            }
        });

        // Map email → ProjectMember.id (not User.id)
        const emailToProjectMemberId = new Map<string, string>();
        const emailToSurname = new Map<string, string>();
        const pmIdToSurname = new Map<string, string>();

        for (const pm of projectMembers) {
            const email = (pm as any).WorkspaceMember.user.email.toLowerCase();
            const surname = (pm as any).WorkspaceMember.user.surname || "";

            emailToProjectMemberId.set(email, pm.id);
            emailToSurname.set(email, surname);
            pmIdToSurname.set(pm.id, surname);
        }

        // Find or create current user's ProjectMember.id
        let creatorProjectMemberId = permissions.projectMember?.id;

        // If not found by direct ID (permissions), try resolving by email from the fetched project members
        if (!creatorProjectMemberId && user.email) {
            creatorProjectMemberId = emailToProjectMemberId.get(user.email.toLowerCase());
        }

        // If STILL not found but user is Workspace Admin/Owner/Manager, automatically join them
        if (!creatorProjectMemberId && (permissions.isWorkspaceAdmin || permissions.isProjectManager)) {
            // Self-join the admin to the project so they can be the creator
            const newMember = await prisma.projectMember.create({
                data: {
                    projectId: data.projectId,
                    workspaceMemberId: permissions.workspaceMemberId!,
                    projectRole: permissions.isWorkspaceAdmin ? "PROJECT_MANAGER" : "MEMBER",
                    hasAccess: true,
                }
            });
            creatorProjectMemberId = newMember.id;
        }

        if (!creatorProjectMemberId) {
            return {
                status: "error",
                message: "You are not a member of this project and don't have permission to join automatically.",
            };
        }

        const emailToMemberId = emailToProjectMemberId;
        const invalidAssigneeEmails: string[] = [];
        const invalidReviewerEmails: string[] = [];
        const uniqueAssigneeEmails = new Set<string>();
        const uniqueReviewerEmails = new Set<string>();

        for (const task of data.tasks) {
            if (task.assigneeEmail && task.assigneeEmail.trim()) {
                uniqueAssigneeEmails.add(task.assigneeEmail.trim().toLowerCase());
            }
            if (task.reviewerEmail && task.reviewerEmail.trim()) {
                uniqueReviewerEmails.add(task.reviewerEmail.trim().toLowerCase());
            }
        }

        for (const email of uniqueAssigneeEmails) {
            if (!emailToMemberId.has(email)) {
                invalidAssigneeEmails.push(email);
            }
        }

        for (const email of uniqueReviewerEmails) {
            if (!emailToMemberId.has(email)) {
                invalidReviewerEmails.push(email);
            }
        }

        if (invalidAssigneeEmails.length > 0) {
            return {
                status: "error",
                message: `The following assignee email(s) are not members of this project: ${invalidAssigneeEmails.join(', ')}. Please add them to the project first or remove them from the CSV file.`,
            };
        }

        if (invalidReviewerEmails.length > 0) {
            return {
                status: "error",
                message: `The following reviewer email(s) are not members of this project: ${invalidReviewerEmails.join(', ')}. Please add them to the project first or remove them from the CSV file.`,
            };
        }

        // Validate dates and days BEFORE starting the transaction
        const invalidDates: string[] = [];
        const invalidDays: string[] = [];

        for (let i = 0; i < data.tasks.length; i++) {
            const task = data.tasks[i];
            const rowNum = i + 2; // +2 because row 1 is header, and array is 0-indexed

            // Check for invalid dates
            if (task.startDate && task.startDate.trim()) {
                const date = parseIST(task.startDate);
                if (!date || isNaN(date.getTime())) {
                    invalidDates.push(`Row ${rowNum}: "${task.startDate}" (Task: ${task.taskName}${task.subtaskName ? ` - ${task.subtaskName}` : ''})`);
                }
            }

            // Check for invalid days
            if (task.days !== undefined && task.days !== null) {
                const daysNum = typeof task.days === 'number' ? task.days : parseInt(String(task.days));
                if (isNaN(daysNum) || daysNum < 0) {
                    invalidDays.push(`Row ${rowNum}: "${task.days}" (Task: ${task.taskName}${task.subtaskName ? ` - ${task.subtaskName}` : ''})`);
                }
            }
        }

        if (invalidDates.length > 0) {
            return {
                status: "error",
                message: `Invalid date format found in the following rows. Please use YYYY-MM-DD format (e.g., 2024-12-20):\n${invalidDates.join('\n')}`,
            };
        }

        if (invalidDays.length > 0) {
            return {
                status: "error",
                message: `Invalid days value found in the following rows. Please use positive numbers only:\n${invalidDays.join('\n')}`,
            };
        }

        // Group tasks by task name
        const taskGroups = new Map<string, typeof data.tasks>();
        for (const task of data.tasks) {
            const existing = taskGroups.get(task.taskName) || [];
            taskGroups.set(task.taskName, [...existing, task]);
        }

        const createdItems: any[] = [];
        const errors: string[] = [];

        // Pre-generate all slugs BEFORE the transaction to improve performance
        const taskNames = Array.from(taskGroups.keys());
        const taskSlugs = await generateUniqueSlugs(taskNames, 'task');
        const taskSlugMap = new Map(taskNames.map((name, i) => [name, taskSlugs[i]]));

        // Pre-generate subtask slugs
        const allSubtaskNames: string[] = [];
        const subtaskNameToTaskName = new Map<string, string>();

        for (const [taskName, taskGroup] of taskGroups.entries()) {
            const subtaskRows = taskGroup.filter(t => t.subtaskName);
            for (const row of subtaskRows) {
                if (row.subtaskName) {
                    allSubtaskNames.push(row.subtaskName);
                    subtaskNameToTaskName.set(row.subtaskName, taskName);
                }
            }
        }

        const allSubtaskSlugs = allSubtaskNames.length > 0
            ? await generateUniqueSlugs(allSubtaskNames, 'task', undefined, taskSlugs)
            : [];

        // Fetch all workspace tags for resolution
        const workspaceTags = await prisma.tag.findMany({
            where: { workspaceId: project.workspaceId },
            select: { id: true, name: true, requirePurchase: true }
        });

        const tagMap = new Map(
            workspaceTags.map(t => [t.name.toUpperCase(), t])
        );

        // Process each task group in a transaction with increased timeout
        let globalSubtaskIndex = 0;

        await prisma.$transaction(async (tx) => {
            for (const [taskName, taskGroup] of taskGroups.entries()) {
                const taskSlug = taskSlugMap.get(taskName)!;
                const firstRow = taskGroup[0];

                // Resolve parent task fields
                const parentAssigneeId = firstRow.assigneeEmail
                    ? emailToMemberId.get(firstRow.assigneeEmail.trim().toLowerCase())
                    : undefined;

                const parentReviewerId = firstRow.reviewerEmail
                    ? emailToMemberId.get(firstRow.reviewerEmail.trim().toLowerCase())
                    : creatorProjectMemberId;

                const parentStartDate = firstRow.startDate
                    ? parseIST(firstRow.startDate) || undefined
                    : undefined;

                let parentTagId: string | undefined = undefined;
                if (firstRow.tag) {
                    const tagInfo = tagMap.get(firstRow.tag.toUpperCase());
                    if (tagInfo) parentTagId = tagInfo.id;
                }

                // Pre-calculate subtask counts for this parent
                const subtaskRowsForThisParent = taskGroup.filter(t => t.subtaskName);
                const subtaskCountVal = subtaskRowsForThisParent.length;
                const completedSubtaskCountVal = subtaskRowsForThisParent.filter(st => st.status === "COMPLETED").length;

                // Create parent task
                const parentTask = await tx.task.create({
                    data: {
                        name: taskName,
                        taskSlug: taskSlug,
                        description: firstRow.description,
                        projectId: data.projectId,
                        workspaceId: project.workspaceId,
                        createdById: creatorProjectMemberId,
                        isParent: true,
                        status: firstRow.status ? (firstRow.status as any) : undefined,
                        assigneeId: parentAssigneeId,
                        reviewerId: parentReviewerId,
                        startDate: parentStartDate,
                        days: firstRow.days,
                        Tag: parentTagId ? { connect: { id: parentTagId } } : undefined,
                        subtaskCount: subtaskCountVal,
                        completedSubtaskCount: completedSubtaskCountVal,
                    },
                });

                createdItems.push({ type: 'task', name: taskName });

                // Create subtasks
                const subtaskRows = taskGroup.filter(t => t.subtaskName);

                if (subtaskRows.length > 0) {
                    for (const subtaskRow of subtaskRows) {
                        const subtaskSlug = allSubtaskSlugs[globalSubtaskIndex++];

                        const subtaskAssigneeId = subtaskRow.assigneeEmail
                            ? emailToMemberId.get(subtaskRow.assigneeEmail.trim().toLowerCase())
                            : undefined;

                        const subtaskReviewerId = subtaskRow.reviewerEmail
                            ? emailToMemberId.get(subtaskRow.reviewerEmail.trim().toLowerCase())
                            : creatorProjectMemberId;

                        const subtaskStartDate = subtaskRow.startDate
                            ? parseIST(subtaskRow.startDate) || undefined
                            : undefined;

                        // Resolve tag ID
                        let resolvedTagId: string | undefined = undefined;
                        let shouldAddToProcurement = false;

                        if (subtaskRow.tag) {
                            const tagInfo = tagMap.get(subtaskRow.tag.toUpperCase());
                            if (tagInfo) {
                                resolvedTagId = tagInfo.id;
                                shouldAddToProcurement = tagInfo.requirePurchase === true;
                            }
                        }

                        const createdSubtask = await tx.task.create({
                            data: {
                                name: subtaskRow.subtaskName!,
                                taskSlug: subtaskSlug,
                                description: subtaskRow.description,
                                projectId: data.projectId,
                                workspaceId: project.workspaceId,
                                createdById: creatorProjectMemberId,
                                parentTaskId: parentTask.id,
                                isParent: false,
                                assigneeId: subtaskAssigneeId,
                                reviewerId: subtaskReviewerId,
                                startDate: subtaskStartDate,
                                days: subtaskRow.days,
                                dueDate: calculateDueDate(subtaskStartDate, subtaskRow.days),
                                status: subtaskRow.status ? (subtaskRow.status as any) : undefined,
                                Tag: resolvedTagId ? { connect: { id: resolvedTagId } } : undefined,
                            },
                        });

                        if (shouldAddToProcurement) {
                            await tx.procurementTask.create({
                                data: {
                                    taskId: createdSubtask.id,
                                    projectId: data.projectId,
                                    workspaceId: project.workspaceId,
                                },
                            });
                        }

                        createdItems.push({ type: 'subtask', name: subtaskRow.subtaskName });
                    }
                }
            }
        }, {
            timeout: 30000,
        });

        // Revalidate caches globally
        await invalidateTaskMutation({
            projectId: data.projectId,
            workspaceId: project.workspaceId,
            userId: user.id
        });

        const taskCount = createdItems.filter(i => i.type === 'task').length;
        const subtaskCount = createdItems.filter(i => i.type === 'subtask').length;

        let message = `Successfully created ${taskCount} task${taskCount !== 1 ? 's' : ''}`;
        if (subtaskCount > 0) {
            message += ` and ${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''}`;
        }
        if (errors.length > 0) {
            message += `. Errors: ${errors.join(', ')}`;
        }

        return {
            status: "success",
            message,
            data: createdItems,
        };

    } catch (err: any) {
        console.error("Error bulk uploading tasks:", err);

        if (err.code === 'P2002') {
            const field = err.meta?.target?.[0] || 'field';
            return {
                status: "error",
                message: `Duplicate ${field} found. Please ensure all task and subtask names are unique.`,
            };
        }

        if (err.code === 'P2003') {
            return {
                status: "error",
                message: "Invalid assignee email or project member not found. Please check that all assignees are members of the project.",
            };
        }

        if (err.code === 'P2025') {
            return {
                status: "error",
                message: "Project or workspace not found. Please refresh and try again.",
            };
        }

        if (err.message?.includes('22021') || err.message?.includes('invalid byte sequence')) {
            return {
                status: "error",
                message: "Your CSV file contains invalid characters. Please re-save your CSV file in UTF-8 encoding without BOM or try copying the data to a new file.",
            };
        }

        const errorMessage = err.message || "Unknown error occurred";
        return {
            status: "error",
            message: `Failed to upload tasks: ${errorMessage}`,
        };
    }
}