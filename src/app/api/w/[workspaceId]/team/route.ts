import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { inviteMemberAction } from "@/actions/team/invite-member";

/**
 * Handle POST /api/w/[workspaceId]/team
 * Calls the shared inviteMemberAction
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    const { workspaceId } = await params;
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    
    // Call the shared action
    const result = await inviteMemberAction({ ...body, workspaceId });
    
    return NextResponse.json(result, { 
        status: result.status === "success" ? 200 : 400 
    });
}
