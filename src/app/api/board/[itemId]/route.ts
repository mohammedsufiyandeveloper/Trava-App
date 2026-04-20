import { NextRequest, NextResponse } from "next/server";
import { toggleBoardItemStatus, deleteBoardItem } from "@/actions/board/board-actions";
import { getSession } from "@/lib/auth/require-user";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ itemId: string }> }
) {
    try {
        const { itemId } = await params;
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { workspaceId, status } = body;

        if (!workspaceId || !status) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const result = await toggleBoardItemStatus(workspaceId, itemId, status);

        if (result.status === "error") {
             return NextResponse.json({ success: false, error: result.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) {
             return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("API Error [Board PATCH]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ itemId: string }> }
) {
    try {
        const { itemId } = await params;
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const workspaceId = request.nextUrl.searchParams.get("workspaceId");

        if (!workspaceId) {
            return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
        }

        const result = await deleteBoardItem(workspaceId, itemId);

        if (result.status === "error") {
             return NextResponse.json({ success: false, error: result.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.message?.includes('NEXT_REDIRECT')) {
             return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("API Error [Board DELETE]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
