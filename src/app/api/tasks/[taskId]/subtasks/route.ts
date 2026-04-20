import { NextRequest, NextResponse } from "next/server";
import { getSubTasksByParentIds } from "@/data/task/get-subtasks-batch";
import { createSubTask } from "@/actions/task/create-subTask";
import { getSession } from "@/lib/auth/require-user";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { TasksService } from "@/server/services/tasks.service";
import prisma from "@/lib/db";
import { parseIST } from "@/lib/utils";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        const { taskId } = await params;
        const session = await getSession();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const url = new URL(req.url);
        const workspaceId = url.searchParams.get("workspaceId");
        if (!workspaceId) {
            return new NextResponse("Missing workspaceId", { status: 400 });
        }

        const projectId = url.searchParams.get("projectId") || undefined;
        const viewMode = url.searchParams.get("viewMode") || "list";
        const pageSize = parseInt(url.searchParams.get("pageSize") || "30", 10);

        // Extract filters safely
        const filters: any = {};

        try {
            const statusStr = url.searchParams.get("status");
            if (statusStr) filters.status = JSON.parse(statusStr);

            const assigneeStr = url.searchParams.get("assigneeId");
            if (assigneeStr) filters.assigneeId = JSON.parse(assigneeStr);

            const tagStr = url.searchParams.get("tagId");
            if (tagStr) filters.tagId = JSON.parse(tagStr);
        } catch (e) {
            // Ignoring JSON parse errors
        }

        const search = url.searchParams.get("search");
        if (search) filters.search = search;

        const dueAfter = url.searchParams.get("dueAfter");
        if (dueAfter && dueAfter !== "undefined" && dueAfter !== "null") filters.dueAfter = new Date(dueAfter);

        const dueBefore = url.searchParams.get("dueBefore");
        if (dueBefore && dueBefore !== "undefined" && dueBefore !== "null") filters.dueBefore = new Date(dueBefore);

        const results = await getSubTasksByParentIds(
            [taskId],
            workspaceId,
            projectId,
            filters,
            pageSize,
            viewMode,
            session.user.id,
            true
        );

        const responsePayload = (results && results.length > 0) ? {
            success: true,
            subTasks: results[0].subTasks,
            totalCount: results[0].totalCount,
            hasMore: results[0].hasMore,
            nextCursor: results[0].nextCursor
        } : {
            success: true,
            subTasks: [],
            totalCount: 0,
            hasMore: false,
            nextCursor: null
        };

        return NextResponse.json(responsePayload);

    } catch (error) {
        console.error("Error in GET subtasks API:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

import { invalidateTaskMutation } from "@/lib/cache/invalidation";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        const { taskId: parentTaskId } = await params;
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json({ error: "Missing name" }, { status: 400 });
        }

        // Fetch parent task to get projectId and other context
        const parentTask = await prisma.task.findUnique({
            where: { id: parentTaskId },
            select: { projectId: true, workspaceId: true, tagId: true }
        });

        if (!parentTask) {
            return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
        }

        const permissions = await getUserPermissions(parentTask.workspaceId, parentTask.projectId);

        const result = await TasksService.createSubTask({
            name,
            description: body.description,
            projectId: parentTask.projectId,
            workspaceId: parentTask.workspaceId,
            parentTaskId: parentTaskId,
            userId: session.user.id,
            permissions,
            assigneeUserId: body.assigneeUserId || session.user.id,
            reviewerId: body.reviewerId || body.reviewerUserId || null,
            tagId: body.tagId || parentTask.tagId || null,
            startDate: body.startDate,
            dueDate: body.dueDate,
            days: body.days || 1,
            status: body.status || "TO_DO"
        });

        // Invalidate cache immediately to ensure parity with web functioning
        try {
            await invalidateTaskMutation({
                projectId: parentTask.projectId,
                workspaceId: parentTask.workspaceId,
                userId: session.user.id,
                taskId: result.id,
                parentTaskId: parentTaskId,
            });
        } catch (cacheError) {
            console.error("Cache Invalidation Error [Subtasks POST]:", cacheError);
            // We don't fail the request if cache invalidation failing, but log it
        }

        return NextResponse.json({
            success: true,
            task: result
        });
    } catch (error: any) {
        console.error("API Error [Subtasks POST]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
