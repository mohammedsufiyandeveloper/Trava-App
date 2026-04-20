import { NextRequest, NextResponse } from "next/server";
import { getTasks, GetTasksOptions } from "@/data/task/get-tasks";
import { requireUser } from "@/lib/auth/require-user";

/**
 * API for Kanban View Debugging and Data Retrieval
 * Mirroring the list API to enable easier network inspection.
 */
export async function GET(request: NextRequest) {
    try {
        const user = await requireUser();
        const searchParams = request.nextUrl.searchParams;
        const workspaceId = searchParams.get("workspaceId");
        if (!workspaceId) {
            return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
        }

        const projectId = searchParams.get("projectId") || undefined;
        const status = searchParams.getAll("status");
        const cursorParam = searchParams.get("cursor");
        const cursor = cursorParam ? JSON.parse(cursorParam) : undefined;
        const limit = parseInt(searchParams.get("limit") || "30");
        const search = searchParams.get("search") || undefined;
        const assigneeId = searchParams.getAll("assigneeId");
        const tagId = searchParams.getAll("tagId");
        const view_mode = searchParams.get("view_mode") as any || "kanban";

        const opts: GetTasksOptions = {
            workspaceId,
            projectId,
            status: status.length > 0 ? status : undefined,
            cursor,
            limit,
            search,
            assigneeId: assigneeId.length > 0 ? assigneeId : undefined,
            tagId: tagId.length > 0 ? tagId : undefined,
            view_mode,
            groupBy: "status",
            includeSubTasks: true,
            excludeParents: true,
            includeFacets: true,
            sorts: [{ field: "createdAt", direction: "desc" }]
        };

        const result = await getTasks(opts, user.id);
        const tasksByStatus: Record<string, any[]> = {};
        result.tasks.forEach(task => {
            const status = task.status || "UNKNOWN";
            if (!tasksByStatus[status]) tasksByStatus[status] = [];
            tasksByStatus[status].push(task);
        });

        return NextResponse.json({
            success: true,
            data: {
                ...result,
                tasksByStatus
            }
        });

    } catch (error: any) {
        console.error("API Error [Kanban Tasks]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
