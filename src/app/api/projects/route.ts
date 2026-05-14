import { NextRequest, NextResponse } from "next/server";
import { getUserProjects } from "@/data/project/get-projects";
import { createProject } from "@/actions/project/create-project";
import { getSession } from "@/lib/auth/require-user";
import prisma from "@/lib/db";

/**
 * GET /api/projects?workspaceId=ID
 * Returns all projects for the authenticated user in the given workspace.
 * 
 * POST /api/projects
 * Creates a new project in the workspace.
 */

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const workspaceId = request.nextUrl.searchParams.get("workspaceId");
        const projectId = request.nextUrl.searchParams.get("projectId");

        if (projectId) {
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                include: {
                    projectMembers: {
                        include: {
                            WorkspaceMember: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            surname: true,
                                            image: true,
                                            email: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    clint: {
                        include: {
                            clintMembers: true,
                        },
                    },
                },
            });

            if (!project) {
                return NextResponse.json({ error: "Project not found" }, { status: 404 });
            }

            const isDirectProjectMember = project.projectMembers.some(
                (member) => member.WorkspaceMember.userId === session.user.id
            );

            if (!isDirectProjectMember) {
                const workspaceMember = await prisma.workspaceMember.findFirst({
                    where: {
                        workspaceId: project.workspaceId,
                        userId: session.user.id,
                        workspaceRole: { in: ["OWNER", "ADMIN"] },
                    },
                    select: { id: true },
                });

                if (!workspaceMember) {
                    return NextResponse.json({ error: "Project not found" }, { status: 404 });
                }
            }

            const projectManagers = project.projectMembers
                .filter((member) => member.projectRole === "PROJECT_MANAGER" || member.projectRole === "LEAD")
                .map((member) => ({
                    id: member.WorkspaceMember.user.id,
                    userId: member.WorkspaceMember.userId,
                    name: member.WorkspaceMember.user.name || "",
                    surname: member.WorkspaceMember.user.surname || "",
                    image: member.WorkspaceMember.user.image,
                    email: member.WorkspaceMember.user.email,
                    projectRole: member.projectRole,
                }));

            return NextResponse.json({
                success: true,
                project: {
                    ...project,
                    projectManagers,
                },
            });
        }

        if (!workspaceId) {
            return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
        }

        // getUserProjects already uses requireUser internally, but we use getSession for consistency
        const projects = await getUserProjects(workspaceId);
        
        return NextResponse.json({
            success: true,
            projects: projects
        });
    } catch (error: any) {
        console.error("API Error [Projects GET]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { 
            name, 
            workspaceId, 
            color, 
            projectManagerUserId, 
            description,
            companyName,
            registeredCompanyName,
            directorName,
            address,
            gstNumber,
            contactPersonName,
            contactNumber
        } = body;

        if (!name || !workspaceId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Mapping fields from mobile app to the createProject action
        // Note: The action expects a specific shape. We'll adapt it.
        const result = await createProject({
            name,
            workspaceId,
            color: color || "#4F46E5", // Default color
            projectManagers: [projectManagerUserId || session.user.id],
            memberAccess: [], // Default to empty
            description: description || "",
            slug: name.toLowerCase().replace(/ /g, "-") + "-" + Date.now().toString().slice(-4),
            companyName: companyName || name,
            registeredCompanyName: registeredCompanyName || name,
            directorName: directorName || "",
            address: address || "",
            gstNumber: gstNumber || "",
            contactPerson: contactPersonName || session.user.name || "Owner",
            phoneNumber: contactNumber || "0000000000",
        });

        if (result.status === "error") {
            return NextResponse.json({ error: result.message || "Failed to create project" }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            project: result.data
        });
    } catch (error: any) {
        console.error("API Error [Projects POST]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const projectId = request.nextUrl.searchParams.get("projectId");
        if (!projectId) {
            return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
        }

        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Import the server action to reuse its logic
        const { deleteProject: deleteProjectAction } = await import("@/actions/project/delete-project");
        const result = await deleteProjectAction(projectId);

        if (result.status === "error") {
            return NextResponse.json({ error: result.message || "Failed to delete project" }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: result.message
        });
    } catch (error: any) {
        console.error("API Error [Projects DELETE]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { editProject } = await import("@/actions/project/update-project");
        const result = await editProject(body, session.user.id);

        if (result.status === "error") {
            return NextResponse.json({ error: result.message || "Failed to update project" }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: result.message
        });
    } catch (error: any) {
        console.error("API Error [Projects PATCH]:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
