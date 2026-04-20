import { NextRequest, NextResponse } from "next/server";
import { getTasks, GetTasksOptions } from "@/data/task/get-tasks";
import { createTask } from "@/actions/task/create-task";
import { editTask } from "@/actions/task/update-task";
import { getSession } from "@/lib/auth/require-user";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { TasksService } from "@/server/services/tasks.service";
import prisma from "@/lib/db";

/**
 * GET /api/tasks
 * POST /api/tasks
 * PATCH /api/tasks?taskId=ID
 */

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const workspaceId = searchParams.get("workspaceId");
        if (!workspaceId) {
            return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
        }

        const projectId = searchParams.get("projectId") || undefined;
        const status = searchParams.getAll("status");
        const assigneeId = searchParams.getAll("assigneeId");
        const tagId = searchParams.getAll("tagId");
        const search = searchParams.get("search") || undefined;
        const hierarchyMode = (searchParams.get("hierarchyMode") as "parents" | "children" | "all") || "parents";
        const excludeParents = searchParams.get("excludeParents") === "true";
        const onlySubtasks = searchParams.get("onlySubtasks") === "true";

        const opts: GetTasksOptions = {
            workspaceId,
            projectId,
            status: status.length > 0 ? status : undefined,
            assigneeId: assigneeId.length > 0 ? assigneeId : undefined,
            tagId: tagId.length > 0 ? tagId : undefined,
            search,
            limit: 500, // Higher limit to capture all tasks + subtasks for mobile
            includeSubTasks: hierarchyMode === "all", // Include subtasks when mode is "all"
            hierarchyMode,
            excludeParents,
            onlySubtasks,
        };

        const result = await getTasks(opts, session.user.id);

        return NextResponse.json({
            success: true,
            tasks: result.tasks,
            totalCount: result.totalCount,
            hasMore: result.hasMore,
            nextCursor: result.nextCursor
        });
    } catch (error: any) {
        console.error("API Error [Tasks GET]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { 
            name, 
            projectId, 
            description,
            assigneeUserId,
            reviewerId,
            tagId,
            status,
            startDate,
            dueDate,
            days
        } = body;

        if (!name || !projectId) {
            return NextResponse.json({ error: "Missing name or projectId" }, { status: 400 });
        }

        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch project to get its workspaceId for permissions
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { workspaceId: true }
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const permissions = await getUserPermissions(project.workspaceId, projectId); 

        const result = await TasksService.createTask({
            name,
            projectId,
            workspaceId: project.workspaceId, 
            userId: session.user.id,
            permissions,
            description,
            assigneeUserId,
            reviewerId,
            tagId,
            status,
            startDate,
            dueDate,
            days
        });

        return NextResponse.json({
            success: true,
            task: result
        });
    } catch (error: any) {
        console.error("API Error [Tasks POST]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const taskId = request.nextUrl.searchParams.get("taskId");
        if (!taskId) {
            return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
        }

        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // Fetch existing task to merge data if the action requires a full schema
        const existingTask = await prisma.task.findUnique({
            where: { id: taskId },
            select: { name: true, taskSlug: true, projectId: true, reviewerId: true }
        });

        if (!existingTask) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        // Merge updates
        const updateData = {
            name: body.name || existingTask.name,
            taskSlug: body.taskSlug || existingTask.taskSlug, // Mobile app might send a new slug or name
            projectId: existingTask.projectId,
            reviewerId: body.reviewerId !== undefined ? body.reviewerId : existingTask.reviewerId,
            // If the mobile app is trying to update status, we might need a different logic 
            // because taskSchema doesn't include status (it's often handled by a different action).
            // However, for compatibility, if they send status, we can try to update it directly.
        };

        const result = await editTask(updateData, taskId);

        if (result.status === "error") {
            return NextResponse.json({ error: result.message }, { status: 400 });
        }

        // If status was provided, update it directly as the editTask action doesn't handle it
        if (body.status) {
            await prisma.task.update({
                where: { id: taskId },
                data: { status: body.status }
            });
        }

        return NextResponse.json({
            success: true,
            message: result.message
        });
    } catch (error: any) {
        console.error("API Error [Tasks PATCH]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const taskId = request.nextUrl.searchParams.get("taskId");
        if (!taskId) {
            return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
        }

        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const existing = await prisma.task.findUnique({
            where: { id: taskId },
            select: { id: true }
        });

        if (!existing) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        await prisma.task.delete({ where: { id: taskId } });

        return NextResponse.json({ success: true, message: "Task deleted successfully" });
    } catch (error: any) {
        console.error("API Error [Tasks DELETE]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
