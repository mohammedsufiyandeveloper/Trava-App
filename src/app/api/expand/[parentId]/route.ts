import { NextResponse } from "next/server";
import { getSubTasksByParentIds } from "@/data/task/get-subtasks-batch";
import { getSession } from "@/lib/auth/require-user";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ parentId: string }> }
) {
    try {
        const { parentId } = await params;
        const session = await getSession();
        console.log(`🌐 [API_EXPAND_ROUTE] Request for parentId: ${parentId}, userId: ${session?.user?.id}`);
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const url = new URL(req.url);
        // Supports both shortened and full parameter names for maximum flexibility
        const workspaceId = url.searchParams.get("w") || url.searchParams.get("workspaceId");
        if (!workspaceId) {
            return new NextResponse("Missing workspaceId (w)", { status: 400 });
        }

        const projectId = url.searchParams.get("p") || url.searchParams.get("projectId") || undefined;
        const viewMode = url.searchParams.get("vm") || url.searchParams.get("viewMode") || "list";
        const pageSize = parseInt(url.searchParams.get("ps") || url.searchParams.get("pageSize") || "30", 10);

        const filters: any = {};

        // Mapping short params to filters: s=status, a=assigneeId, t=tagId, q=search, da=dueAfter, db=dueBefore
        try {
            const statusStr = url.searchParams.get("s") || url.searchParams.get("status");
            if (statusStr) {
                try {
                    filters.status = JSON.parse(statusStr);
                } catch {
                    filters.status = statusStr.split(',');
                }
            }

            const assigneeStr = url.searchParams.get("a") || url.searchParams.get("assigneeId");
            if (assigneeStr) {
                try {
                    filters.assigneeId = JSON.parse(assigneeStr);
                } catch {
                    filters.assigneeId = assigneeStr.split(',');
                }
            }

            const tagStr = url.searchParams.get("t") || url.searchParams.get("tagId");
            if (tagStr) {
                try {
                    filters.tagId = JSON.parse(tagStr);
                } catch {
                    filters.tagId = tagStr.split(',');
                }
            }
        } catch (e) {
            // Ignoring parse errors
        }

        const search = url.searchParams.get("q") || url.searchParams.get("search");
        if (search) filters.search = search;

        const dueAfter = url.searchParams.get("da") || url.searchParams.get("dueAfter");
        if (dueAfter && dueAfter !== "undefined" && dueAfter !== "null") filters.dueAfter = new Date(dueAfter);

        const dueBefore = url.searchParams.get("db") || url.searchParams.get("dueBefore");
        if (dueBefore && dueBefore !== "undefined" && dueBefore !== "null") filters.dueBefore = new Date(dueBefore);

        const results = await getSubTasksByParentIds(
            [parentId],
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

        return NextResponse.json(responsePayload, {
            headers: {
                "Cache-Control": "private, s-maxage=10, stale-while-revalidate=5",
            },
        });

    } catch (error) {
        console.error("Error in GET expansion API:", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
