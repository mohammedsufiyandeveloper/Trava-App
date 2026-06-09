import { Hono } from "hono";
import { HonoVariables } from "../types";
import prisma from "@/lib/db";
import { getUserProjects } from "@/data/project/get-projects";
import { createProject } from "@/actions/project/create-project";
import { ProjectRole } from "@prisma/client";
import {
    addProjectMembers,
    removeProjectMembers,
    updateProjectMemberRole
} from "@/actions/project/manage-members";
import { getProjectReviewers } from "@/actions/project/get-project-reviewers";

export const projectsRouter = new Hono<{ Variables: HonoVariables }>()

    // GET /api/projects
    .get("/", async (c) => {
        const user = c.get("user");
        const workspaceId = c.req.query("workspaceId");
        const projectId = c.req.query("projectId");

        try {
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
                    return c.json({ error: "Project not found" }, 404);
                }

                const isDirectProjectMember = project.projectMembers.some(
                    (member) => member.WorkspaceMember.userId === user.id
                );

                if (!isDirectProjectMember) {
                    const workspaceMember = await prisma.workspaceMember.findFirst({
                        where: {
                            workspaceId: project.workspaceId,
                            userId: user.id,
                            workspaceRole: { in: ["OWNER", "ADMIN"] },
                        },
                        select: { id: true },
                    });

                    if (!workspaceMember) {
                        return c.json({ error: "Project not found" }, 404);
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

                return c.json({
                    success: true,
                    project: {
                        ...project,
                        projectManagers,
                    },
                });
            }

            if (!workspaceId) {
                return c.json({ error: "Missing workspaceId" }, 400);
            }

            // Honor ?lite=true (mobile sends it for list/picker views). The lite
            // projection drops the heavy projectMembers array + per-member emails,
            // cutting list payload size substantially without affecting the
            // full-detail endpoint used by project detail/edit screens.
            const lite = c.req.query("lite") === "true";
            const projects = await getUserProjects(workspaceId, lite);
            return c.json({
                success: true,
                projects: projects
            });
        } catch (error: any) {
            console.error("Hono API Error [Projects GET]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    })

    // POST /api/projects
    .post("/", async (c) => {
        const user = c.get("user");
        try {
            const body = await c.req.json();
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
                return c.json({ error: "Missing required fields" }, 400);
            }

            const result = await createProject({
                name,
                workspaceId,
                color: color || "#4F46E5",
                projectManagers: [projectManagerUserId || user.id],
                memberAccess: [],
                description: description || "",
                slug: name.toLowerCase().replace(/ /g, "-") + "-" + Date.now().toString().slice(-4),
                companyName: companyName || name,
                registeredCompanyName: registeredCompanyName || name,
                directorName: directorName || "",
                address: address || "",
                gstNumber: gstNumber || "",
                contactPerson: contactPersonName || user.name || "Owner",
                phoneNumber: contactNumber || "0000000000",
            });

            if (result.status === "error") {
                return c.json({ error: result.message || "Failed to create project" }, 400);
            }

            return c.json({
                success: true,
                project: result.data
            });
        } catch (error: any) {
            console.error("Hono API Error [Projects POST]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    })

    // PATCH /api/projects
    .patch("/", async (c) => {
        const user = c.get("user");
        try {
            const body = await c.req.json();
            const { editProject } = await import("@/actions/project/update-project");
            const result = await editProject(body, user.id);

            if (result.status === "error") {
                return c.json({ error: result.message || "Failed to update project" }, 400);
            }

            return c.json({
                success: true,
                message: result.message
            });
        } catch (error: any) {
            console.error("Hono API Error [Projects PATCH]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    })

    // DELETE /api/projects
    .delete("/", async (c) => {
        try {
            const projectId = c.req.query("projectId");
            if (!projectId) {
                return c.json({ error: "Missing projectId" }, 400);
            }

            const { deleteProject: deleteProjectAction } = await import("@/actions/project/delete-project");
            const result = await deleteProjectAction(projectId);

            if (result.status === "error") {
                return c.json({ error: result.message || "Failed to delete project" }, 400);
            }

            return c.json({
                success: true,
                message: result.message
            });
        } catch (error: any) {
            console.error("Hono API Error [Projects DELETE]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    })

    // GET /api/projects/:projectId/members
    .get("/:projectId/members", async (c) => {
        const projectId = c.req.param("projectId");
        try {
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

            const mappedMembers = members.map(m => ({
                userId: m.WorkspaceMember.userId,
                name: `${m.WorkspaceMember.user.name || ""}${m.WorkspaceMember.user.surname ? ` ${m.WorkspaceMember.user.surname}` : ""}`.trim(),
                email: m.WorkspaceMember.user.email,
                image: m.WorkspaceMember.user.image,
                role: m.projectRole,
                hasAccess: m.hasAccess
            }));

            return c.json({ success: true, members: mappedMembers });
        } catch (error: any) {
            console.error("Hono API Error [Project Members GET]:", error);
            return c.json({ success: false, error: "Internal Error" }, 500);
        }
    })

    // POST /api/projects/:projectId/members
    .post("/:projectId/members", async (c) => {
        const projectId = c.req.param("projectId");
        try {
            const body = await c.req.json();
            const { memberUserIds } = body;

            if (!memberUserIds || !Array.isArray(memberUserIds)) {
                return c.json({ error: "Missing or invalid memberUserIds" }, 400);
            }

            const result = await addProjectMembers(projectId, memberUserIds);

            if (result.status === "error") {
                return c.json({ success: false, error: result.message }, 400);
            }

            return c.json({ success: true, message: result.message });
        } catch (error: any) {
            console.error("Hono API Error [Project Members POST]:", error);
            return c.json({ success: false, error: "Internal Error" }, 500);
        }
    })

    // PATCH /api/projects/:projectId/members
    .patch("/:projectId/members", async (c) => {
        const projectId = c.req.param("projectId");
        try {
            const body = await c.req.json();
            const { userId, role } = body;

            if (!userId || !role) {
                return c.json({ error: "Missing userId or role" }, 400);
            }

            const result = await updateProjectMemberRole(projectId, userId, role as ProjectRole);

            if (result.status === "error") {
                return c.json({ success: false, error: result.message }, 400);
            }

            return c.json({ success: true, message: result.message });
        } catch (error: any) {
            console.error("Hono API Error [Project Members PATCH]:", error);
            return c.json({ success: false, error: "Internal Error" }, 500);
        }
    })

    // DELETE /api/projects/:projectId/members
    .delete("/:projectId/members", async (c) => {
        const projectId = c.req.param("projectId");
        const userId = c.req.query("userId");

        try {
            if (!userId) {
                return c.json({ error: "Missing userId" }, 400);
            }

            const result = await removeProjectMembers(projectId, [userId]);

            if (result.status === "error") {
                return c.json({ success: false, error: result.message }, 400);
            }

            return c.json({ success: true, message: result.message });
        } catch (error: any) {
            console.error("Hono API Error [Project Members DELETE]:", error);
            return c.json({ success: false, error: "Internal Error" }, 500);
        }
    })

    // GET /api/projects/:projectId/reviewers
    .get("/:projectId/reviewers", async (c) => {
        const projectId = c.req.param("projectId");
        try {
            if (!projectId) {
                return c.json({ error: "Project ID is required" }, 400);
            }

            const reviewers = await getProjectReviewers(projectId);
            return c.json({ success: true, data: reviewers });
        } catch (error: any) {
            console.error("Hono API Error [Project Reviewers GET]:", error);
            return c.json({ success: false, error: "Failed to fetch project reviewers" }, 500);
        }
    });
