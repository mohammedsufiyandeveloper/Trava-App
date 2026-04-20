import { NextResponse } from "next/server";
import { getWorkspaces } from "@/data/workspace/get-workspaces";
import { getSession } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces
 * Returns all workspaces for the authenticated user.
 */
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await getWorkspaces(session.user.id);

        return NextResponse.json({
            success: true,
            workspaces: result.workspaces,
            totalCount: result.totalCount
        });
    } catch (error: any) {
        console.error("API Error [Workspaces]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
