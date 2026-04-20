"use server";

import { requireUser } from "@/lib/auth/require-user";
import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { projectSchema, ProjectSchemaType } from "@/lib/zodSchemas";
import { ProjectRole } from"@prisma/client";
import { hasWorkspacePermission } from "@/lib/constants/workspace-access";
import { getUniqueRandomColor } from "@/lib/colors/project-colors";

/**
 * Create a new project with strict RBAC enforcement
 * 
 * Rules:
 * - OWNER/ADMIN: Can assign multiple PROJECT_MANAGERs from the selection
 * - MANAGER: Auto-assigned as PROJECT_MANAGER, cannot assign others
 * 
 * Chain: User → WorkspaceMember → ProjectMember (created via workspaceMemberId)
 */
export async function createProject(values: ProjectSchemaType): Promise<ApiResponse> {
    const user = await requireUser();

    const validation = projectSchema.safeParse(values);
    if (!validation.success) {
        return {
            status: "error",
            message: "Please check the form details and try again.",
        };
    }

    if (!values?.workspaceId) {
        return {
            status: "error",
            message: "We couldn't identify the workspace. Please refresh the page and try again.",
        };
    }

    try {
        // Fetch workspace with members
        const workspace = await prisma.workspace.findUnique({
            where: { id: values.workspaceId },
            include: {
                members: {
                    include: {
                        user: true
                    }
                }
            }
        });

        if (!workspace) {
            return { status: "error", message: "The requested workspace could not be found." };
        }

        const workspaceMembers = workspace.members || [];

        if (workspaceMembers.length === 0) {
            return {
                status: "error",
                message: "This workspace doesn't have any members yet.",
            };
        }

        const currentMemberRecord = workspaceMembers.find(
            (m) => String(m.userId) === String(user.id)
        );

        if (!currentMemberRecord) {
            return {
                status: "error",
                message: "You must be a member of this workspace to create a project.",
            };
        }

        // Check if user has permission to create projects
        if (!hasWorkspacePermission(currentMemberRecord.workspaceRole, "project:create")) {
            return {
                status: "error",
                message: "You don't have permission to create projects.",
            };
        }

        // Build userId -> workspaceMemberId map
        const workspaceMemberMap = new Map<string, string>();
        for (const wm of workspaceMembers) {
            if (wm?.userId && wm?.id) workspaceMemberMap.set(String(wm.userId), String(wm.id));
        }

        // Determine project managers based on creator's role
        const isOwnerOrAdmin = currentMemberRecord.workspaceRole === "OWNER" ||
            currentMemberRecord.workspaceRole === "ADMIN";
        const isManager = currentMemberRecord.workspaceRole === "MANAGER";

        let projectManagersToAdd: string[] = [];

        if (isOwnerOrAdmin) {
            // OWNER/ADMIN: Use provided projectManagers array or fall back to projectLead
            if (values.projectManagers && values.projectManagers.length > 0) {
                if (values.projectManagers.length > 1) {
                    return {
                        status: "error",
                        message: "A project can only have exactly one Project Manager.",
                    };
                }
                projectManagersToAdd = values.projectManagers;
            } else {
                return {
                    status: "error",
                    message: "Exactly one project manager must be assigned.",
                };
            }

            // Validate all project managers are workspace members
            for (const pmUserId of projectManagersToAdd) {
                if (!workspaceMemberMap.has(pmUserId)) {
                    return {
                        status: "error",
                        message: "All project managers must be members of this workspace.",
                    };
                }
            }
        } else if (isManager) {
            // MANAGER: Auto-assign themselves as PROJECT_MANAGER
            projectManagersToAdd = [user.id];
        } else {
            return {
                status: "error",
                message: "Insufficient permissions to create projects.",
            };
        }

        // Determine project color
        let finalColor = validation.data.color;

        if (!finalColor) {
            const existingProjects = await prisma.project.findMany({
                where: { workspaceId: values.workspaceId },
                select: { color: true },
            });

            const usedColors = existingProjects
                .map((p) => p.color)
                .filter((c): c is string => !!c);

            finalColor = getUniqueRandomColor(usedColors);
        }

        // Create project with project managers
        // KEY CHANGE: ProjectMember is created using workspaceMemberId only (no userId)
        let newProject;
        try {
            newProject = await prisma.project.create({
                data: {
                    name: validation.data.name,
                    description: validation.data.description,
                    slug: validation.data.slug,
                    color: finalColor,
                    workspaceId: values.workspaceId,
                    createdBy: user.id, // Track who created the project (User.id on Project model)
                    projectMembers: {
                        create: projectManagersToAdd.map(userId => ({
                            workspaceMemberId: workspaceMemberMap.get(userId)!,
                            hasAccess: true,
                            projectRole: "PROJECT_MANAGER" as ProjectRole,
                        })),
                    },
                    // Conditionally create client if companyName is provided
                    ...(validation.data.companyName ? {
                        clint: {
                            create: {
                                name: validation.data.companyName,
                                registeredCompanyName: validation.data.registeredCompanyName,
                                directorName: validation.data.directorName,
                                address: validation.data.address,
                                gstNumber: validation.data.gstNumber,
                                clintMembers: {
                                    create: {
                                        name: validation.data.contactPerson,
                                        phoneNumber: validation.data.phoneNumber,
                                    },
                                },
                            },
                        },
                    } : {}),
                },
            });
        } catch (error: any) {
            console.error("❌ [PRISMA_ERROR] Project creation failed:", error);
            if (error.code === 'P2011') {
                console.error("🔍 [PRISMA_META] Null constraint violation details:", error.meta);
            }
            return {
                status: "error",
                message: `Failed to create project: ${error.message || "Unknown database error"}`,
            };
        }

        // Invalidate project cache for all users in the workspace
        const { invalidateWorkspaceProjects } = await import("@/lib/cache/invalidation");
        await invalidateWorkspaceProjects(values.workspaceId);

        return {
            status: "success",
            message: "Project created successfully! You can now start adding tasks.",
        };
    } catch (err) {
        console.error("Error creating project:", err);
        return {
            status: "error",
            message: "An unexpected error occurred while creating the project. Please try again later.",
        };
    }
}
