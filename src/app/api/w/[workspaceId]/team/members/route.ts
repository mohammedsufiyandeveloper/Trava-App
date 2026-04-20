import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWorkspaceMembers } from "@/data/workspace/get-workspace-members";

/**
 * Handle GET /api/w/[workspaceId]/team/members
 * Fetches the list of all members in the specified workspace.
 * This API is used by Mobile apps and potentially for client-side fetches.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params;
        
        // Verify authentication
        const session = await auth.api.getSession({ headers: req.headers });
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Call the shared data layer (already handles member permission checks)
        const result = await getWorkspaceMembers(workspaceId);
        
        return NextResponse.json(result);
    } catch (error) {
        console.error("[TEAM_MEMBERS_API_ERROR]", error);
        
        // Handle common errors like notFound (which throws in some Next.js patterns)
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json(
            { error: "Failed to fetch members", message }, 
            { status: message.includes("not found") ? 404 : 500 }
        );
    }
}
