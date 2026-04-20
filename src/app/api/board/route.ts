import { NextRequest, NextResponse } from "next/server";
import { getBoardData } from "@/data/board/get-board-data";
import { createBoardItem } from "@/actions/board/board-actions";
import { getSession } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const workspaceId = request.nextUrl.searchParams.get("workspaceId");
        if (!workspaceId) {
            return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
        }

        const data = await getBoardData(workspaceId);

        return NextResponse.json({
            success: true,
            data
        });
    } catch (error: any) {
        console.error("API Error [Board GET]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { workspaceId, memberId, note } = body;

        if (!workspaceId || !memberId || !note) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const result = await createBoardItem(workspaceId, memberId, note);

        if (result.status === "error") {
             return NextResponse.json({ success: false, error: result.message }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: result.data
        });
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) {
             return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.error("API Error [Board POST]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
