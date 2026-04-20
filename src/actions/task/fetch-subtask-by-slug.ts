"use server";

import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";

export async function fetchSubTaskBySlugAction(workspaceId: string, slugOrId: string) {
    try {
        const user = await requireUser();

        const member = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId,
                userId: user.id
            }
        });

        if (!member) {
            return { success: false, error: "Access denied" };
        }

        const task = await prisma.task.findFirst({
            where: {
                workspaceId,
                OR: [
                    { id: slugOrId },
                    { taskSlug: slugOrId }
                ]
            },
            include: {
                ProjectMember_Task_assigneeIdToProjectMember: {
                    select: {
                        id: true,
                        WorkspaceMember: {
                            select: {
                                user: {
                                    select: {
                                        surname: true,
                                    }
                                }
                            }
                        }
                    }
                },
                tag: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                project: {
                    select: {
                        id: true,
                        name: true,
                        color: true,
                    }
                },
                parentTask: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                _count: {
                    select: {
                        Activity: true
                    }
                }
            }
        });

        if (!task) {
            return { success: false, error: "Task not found" };
        }

        return {
            success: true,
            subTask: task
        };

    } catch (error) {
        console.error("Error fetching subtask by slug:", error);
        return { success: false, error: "Internal server error" };
    }
}
