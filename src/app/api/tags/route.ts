import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import { createTag } from "@/actions/tag/create-tag";
import { updateTag } from "@/actions/tag/update-tag";
import { deleteTag } from "@/actions/tag/delete-tag";
import { getSession } from "@/lib/auth/require-user";

/**
 * GET /api/tags?workspaceId=ID
 * POST /api/tags
 * PATCH /api/tags
 * DELETE /api/tags?tagId=ID&workspaceId=ID
 */

export async function GET(request: NextRequest) {
    try {
        const workspaceId = request.nextUrl.searchParams.get("workspaceId");
        if (!workspaceId) {
            return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
        }

        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tags = await getWorkspaceTags(workspaceId);
        
        return NextResponse.json({
            success: true,
            tags: tags
        });
    } catch (error: any) {
        console.error("API Error [Tags GET]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await createTag(body);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: result.data
        });
    } catch (error: any) {
        console.error("API Error [Tags POST]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await updateTag(body);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: result.data
        });
    } catch (error: any) {
        console.error("API Error [Tags PATCH]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const tagId = request.nextUrl.searchParams.get("tagId");
        const workspaceId = request.nextUrl.searchParams.get("workspaceId");

        if (!tagId || !workspaceId) {
            return NextResponse.json({ error: "Missing tagId or workspaceId" }, { status: 400 });
        }

        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await deleteTag({ tagId, workspaceId });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: "Tag deleted successfully"
        });
    } catch (error: any) {
        console.error("API Error [Tags DELETE]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
