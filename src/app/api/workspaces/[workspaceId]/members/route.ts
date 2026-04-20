import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceMembers } from "@/data/workspace/get-workspace-members";
import { getSession } from "@/lib/auth/require-user";

/**
 * GET /api/workspaces/[workspaceId]/members
 * Returns members for a specific workspace.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params;
        const searchParams = request.nextUrl.searchParams;
        const role = searchParams.get("role") || undefined;

        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await getWorkspaceMembers(workspaceId, role);
        
        return NextResponse.json({
            success: true,
            members: result.workspaceMembers
        });
    } catch (error: any) {
        console.error(`API Error [WorkspaceMembers - ${error.message}]:`, error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
