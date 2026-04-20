import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteMemberAction } from "@/actions/team/delete-member";

/**
 * Handle DELETE /api/w/[workspaceId]/team/members/[memberId]
 * Calls the shared deleteMemberAction
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ workspaceId: string; memberId: string }> }
) {
    const { workspaceId, memberId } = await params;
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Call the shared action
    const result = await deleteMemberAction(memberId, workspaceId, session.user.id);

    return NextResponse.json(result, { 
        status: result.status === "success" ? 200 : 400 
    });
}
