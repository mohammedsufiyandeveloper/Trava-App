import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/require-user";
import prisma from "@/lib/db";

/**
 * GET /api/tasks/[taskId]
 * Returns the full details of a single task or subtask by ID.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        const { taskId } = await params;
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                ProjectMember_Task_assigneeIdToProjectMember: {
                    include: { WorkspaceMember: { include: { user: true } } }
                },
                Tag: true,
                project: { select: { id: true, name: true, workspaceId: true, color: true } },
                parentTask: { select: { id: true, name: true } },
                subTasks: { select: { id: true } },
            }
        });

        if (!task) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        // Map the complex relations for the mobile client
        const assigneeUser = (task as any).ProjectMember_Task_assigneeIdToProjectMember?.WorkspaceMember?.user;
        const mapped = {
            ...task,
            assignee: assigneeUser
                ? { id: assigneeUser.id, name: `${assigneeUser.name || ""}`.trim(), image: assigneeUser.image }
                : null,
            subtaskCount: task.subTasks.length,
            subTasks: undefined,
            ProjectMember_Task_assigneeIdToProjectMember: undefined,
        };

        return NextResponse.json({ success: true, task: mapped });
    } catch (error: any) {
        console.error("API Error [Task GET by ID]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
