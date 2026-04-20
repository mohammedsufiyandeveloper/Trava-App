import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { 
    addProjectMembers, 
    removeProjectMembers, 
    updateProjectMemberRole 
} from "@/actions/project/manage-members";
import { ProjectRole } from"@prisma/client";

/**
 * GET /api/projects/[projectId]/members
 * List all members of a specific project
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const session = await getSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const members = await prisma.projectMember.findMany({
            where: { projectId },
            include: {
                WorkspaceMember: {
                    include: {
                        user: true
                    }
                }
            }
        });

        // Map to a format the mobile app expects
        const mappedMembers = members.map(m => ({
            userId: m.WorkspaceMember.userId,
            name: `${m.WorkspaceMember.user.name || ""}${m.WorkspaceMember.user.surname ? ` ${m.WorkspaceMember.user.surname}` : ""}`.trim(),
            email: m.WorkspaceMember.user.email,
            image: m.WorkspaceMember.user.image,
            role: m.projectRole,
            hasAccess: m.hasAccess
        }));

        return NextResponse.json({ success: true, members: mappedMembers });
    } catch (error: any) {
        console.error("API Error [Project Members GET]:", error);
        return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
    }
}

/**
 * POST /api/projects/[projectId]/members
 * Add members to a project
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const body = await request.json();
        const { memberUserIds } = body;

        if (!memberUserIds || !Array.isArray(memberUserIds)) {
            return NextResponse.json({ error: "Missing or invalid memberUserIds" }, { status: 400 });
        }

        const result = await addProjectMembers(projectId, memberUserIds);
        
        if (result.status === "error") {
            return NextResponse.json({ success: false, error: result.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: result.message });
    } catch (error: any) {
        console.error("API Error [Project Members POST]:", error);
        return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
    }
}

/**
 * PATCH /api/projects/[projectId]/members
 * Update a member's role
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const body = await request.json();
        const { userId, role } = body;

        if (!userId || !role) {
            return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
        }

        const result = await updateProjectMemberRole(projectId, userId, role as ProjectRole);
        
        if (result.status === "error") {
            return NextResponse.json({ success: false, error: result.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: result.message });
    } catch (error: any) {
        console.error("API Error [Project Members PATCH]:", error);
        return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
    }
}

/**
 * DELETE /api/projects/[projectId]/members
 * Remove a member from the project
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const result = await removeProjectMembers(projectId, [userId]);
        
        if (result.status === "error") {
            return NextResponse.json({ success: false, error: result.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: result.message });
    } catch (error: any) {
        console.error("API Error [Project Members DELETE]:", error);
        return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
    }
}
