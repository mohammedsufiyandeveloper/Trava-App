import { NextRequest, NextResponse } from "next/server";
import { getTasks, GetTasksOptions } from "@/data/task/get-tasks";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Shortened Kanban API (KT = Kanban Tasks)
 * Parameters:
 *  w = workspaceId
 *  p = projectId
 *  s = status
 *  c = cursor
 *  l = limit
 *  q = search
 *  a = assigneeId
 *  t = tagId
 *  vm = view_mode
 */
export async function GET(request: NextRequest) {
    try {
        const user = await requireUser();
        const searchParams = request.nextUrl.searchParams;

        const workspaceId = searchParams.get("w") || searchParams.get("workspaceId");
        if (!workspaceId) {
            return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
        }

        const projectId = searchParams.get("p") || searchParams.get("projectId") || undefined;
        const status = searchParams.getAll("s").length > 0 ? searchParams.getAll("s") : (searchParams.get("status") ? [searchParams.get("status")!] : []);

        const cursorParam = searchParams.get("c") || searchParams.get("cursor");
        const cursor = cursorParam ? JSON.parse(cursorParam) : undefined;

        const limit = parseInt(searchParams.get("l") || searchParams.get("limit") || "30");
        const search = searchParams.get("q") || searchParams.get("search") || undefined;

        const assigneeId = searchParams.getAll("a").length > 0 ? searchParams.getAll("a") : (searchParams.get("assigneeId") ? [searchParams.get("assigneeId")!] : []);
        const tagId = searchParams.getAll("t").length > 0 ? searchParams.getAll("t") : (searchParams.get("tagId") ? [searchParams.get("tagId")!] : []);

        const view_mode = searchParams.get("vm") || searchParams.get("view_mode") || "kanban";

        const opts: GetTasksOptions = {
            workspaceId,
            projectId,
            status: status.length > 0 ? status : undefined,
            cursor,
            limit,
            search,
            assigneeId: assigneeId.length > 0 ? assigneeId : undefined,
            tagId: tagId.length > 0 ? tagId : undefined,
            view_mode: view_mode as any,
            groupBy: "status",
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
        console.error("API Error [KT]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
