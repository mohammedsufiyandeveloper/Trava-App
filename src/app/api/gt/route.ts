import { NextRequest, NextResponse } from "next/server";
import { getTasks, GetTasksOptions } from "@/data/task/get-tasks";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Shortened Gantt API (GT = Gantt Tasks)
 * Parameters:
 *  w = workspaceId
 *  p = projectId
 *  s = status
 *  da = dueAfter / startDate
 *  db = dueBefore / endDate
 *  q = search
 *  a = assigneeId
 *  t = tagId
 *  vm = view_mode
 *  l = limit
 *  c = cursor
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

        const dueAfter = searchParams.get("da") || searchParams.get("dueAfter") || searchParams.get("startDate") || undefined;
        const dueBefore = searchParams.get("db") || searchParams.get("dueBefore") || searchParams.get("endDate") || undefined;

        const search = searchParams.get("q") || searchParams.get("search") || undefined;
        const assigneeId = searchParams.getAll("a").length > 0 ? searchParams.getAll("a") : (searchParams.get("assigneeId") ? [searchParams.get("assigneeId")!] : []);
        const tagId = searchParams.getAll("t").length > 0 ? searchParams.getAll("t") : (searchParams.get("tagId") ? [searchParams.get("tagId")!] : []);

        const limit = parseInt(searchParams.get("l") || searchParams.get("limit") || "100");
        const cursorParam = searchParams.get("c") || searchParams.get("cursor");
        const cursor = cursorParam ? JSON.parse(cursorParam) : undefined;

        const view_mode = searchParams.get("vm") || searchParams.get("view_mode") || "gantt";

        const opts: GetTasksOptions = {
            workspaceId,
            projectId,
            status: status.length > 0 ? status : undefined,
            dueAfter,
            dueBefore,
            search,
            assigneeId: assigneeId.length > 0 ? assigneeId : undefined,
            tagId: tagId.length > 0 ? tagId : undefined,
            cursor,
            limit,
            view_mode: view_mode as any,
            includeSubTasks: true,
            includeFacets: true,
            hierarchyMode: "parents",
            sorts: [{ field: "startDate", direction: "asc" }]
        };

        const result = await getTasks(opts, user.id);

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error: any) {
        console.error("API Error [GT]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
