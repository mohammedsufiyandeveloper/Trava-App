"use server";

import prisma from "@/lib/db";
import { ApiResponse } from "@/lib/types";
import { EditProjectSchemaType, editProjectSchema } from "@/lib/zodSchemas";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { isProjectAdmin } from "@/lib/constants/project-access";

export async function editProject(values: EditProjectSchemaType, providedUserId?: string): Promise<ApiResponse> {

    try {
        // Validate input
        const validation = editProjectSchema.safeParse(values);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(err => `${err.path.join(".")}: ${err.message}`).join(", ");
            return {
                status: "error",
                message: `Validation failed: ${errorMsg}`,
            };
        }

        // Fetch project with workspace members for member access updates
        const project = await prisma.project.findUnique({
            where: { id: values.projectId },
            include: {
                workspace: {
                    include: {
                        members: true,
                    },
                },
                clint: true,
            },
        });

        if (!project) {
            return {
                status: "error",
                message: `Project not found (ID: ${values.projectId}).`,
            };
        }

        // Get user permissions for this project
        const permissions = await getUserPermissions(project.workspaceId, values.projectId, providedUserId);

        // Check if user has admin access (workspace admin or project lead)
        const projectRole = permissions.projectMember?.projectRole || null;

        if (!permissions.isWorkspaceAdmin && !isProjectAdmin(projectRole)) {
            const roleName = projectRole || "No Role";
            return {
                status: "error",
                message: `Access Denied: Only workspace admins or project managers can edit projects. (Your role: ${roleName}, isWorkspaceAdmin: ${permissions.isWorkspaceAdmin})`,
            };
        }


        // 3. Check if slug is unique (if slug is being changed)
        if (validation.data.slug && validation.data.slug !== project.slug) {
            const existingProject = await prisma.project.findFirst({
                where: {
                    workspaceId: project.workspaceId,
                    slug: validation.data.slug,
                    id: { not: values.projectId },
                },
            });

            if (existingProject) {
                return {
                    status: "error",
                    message: "A project with this slug already exists in the workspace.",
                };
            }
        }

        // 4. Build workspace member map for member access updates
        const workspaceMemberMap = new Map<string, string>();
        for (const wm of project.workspace.members) {
            if (wm?.userId && wm?.id) {
                workspaceMemberMap.set(String(wm.userId), String(wm.id));
            }
        }

        // 5. Update project and client in a transaction
        await prisma.$transaction(async (tx) => {
            // Update project basic info
            await tx.project.update({
                where: { id: values.projectId },
                data: {
                    name: validation.data.name,
                    description: validation.data.description,
                    slug: validation.data.slug || project.slug,
                    color: validation.data.color || project.color,
                },
            });

            // Update client info if provided and client exists
            const clientRecord = project.clint?.[0]; // clint is an array, get first one
            if (clientRecord) {
                await tx.clints.update({
                    where: { id: clientRecord.id },
                    data: {
                        ...(validation.data.companyName && { name: validation.data.companyName }),
                        ...(validation.data.registeredCompanyName && { registeredCompanyName: validation.data.registeredCompanyName }),
                        ...(validation.data.directorName && { directorName: validation.data.directorName }),
                        ...(validation.data.address && { address: validation.data.address }),
                        ...(validation.data.gstNumber && { gstNumber: validation.data.gstNumber }),
                    },
                });

                // Update client member contact info if provided
                if (validation.data.contactPerson || validation.data.phoneNumber) {
                    const clientMember = await tx.clintMembers.findFirst({
                        where: { clintId: clientRecord.id },
                    });

                    if (clientMember) {
                        await tx.clintMembers.update({
                            where: { id: clientMember.id },
                            data: {
                                ...(validation.data.contactPerson && { name: validation.data.contactPerson }),
                                ...(validation.data.phoneNumber && { phoneNumber: validation.data.phoneNumber }),
                            },
                        });
                    }
                }
            } else if (validation.data.companyName) {
                // Create client if it doesn't exist but data is provided
                const newClient = await tx.clints.create({
                    data: {
                        name: validation.data.companyName,
                        registeredCompanyName: validation.data.registeredCompanyName || "",
                        directorName: validation.data.directorName || "",
                        address: validation.data.address || "",
                        gstNumber: validation.data.gstNumber || "",
                        projectId: values.projectId,
                        workspaceId: project.workspaceId,
                    }
                });

                if (validation.data.contactPerson || validation.data.phoneNumber) {
                    await tx.clintMembers.create({
                        data: {
                            clintId: newClient.id,
                            name: validation.data.contactPerson || "Contact",
                            phoneNumber: validation.data.phoneNumber || "",
                        }
                    });
                }

                // Update project's clintId reference
                await tx.project.update({
                    where: { id: values.projectId },
                    data: { clintId: newClient.id }
                });
            }

            // Update project managers if provided (or single projectLead from mobile)
            const requestedPMUserIds = validation.data.projectManagers || (validation.data.projectLead ? [validation.data.projectLead] : null);
            
            if (requestedPMUserIds) {
                // Get all current project members with PROJECT_MANAGER role
                const currentPMs = await tx.projectMember.findMany({
                    where: {
                        projectId: values.projectId,
                        projectRole: "PROJECT_MANAGER"
                    },
                    include: {
                        WorkspaceMember: true
                    }
                });

                const currentPMUserIds = currentPMs.map(pm => (pm as any).WorkspaceMember.userId);
                
                // IDs to add: requested but not current
                const idsToAdd = requestedPMUserIds.filter(id => !currentPMUserIds.includes(id));
                // IDs to remove: current but not requested
                const idsToRemove = currentPMUserIds.filter(id => !requestedPMUserIds.includes(id));

                // Add new project managers
                for (const userId of idsToAdd) {
                    const wmId = workspaceMemberMap.get(userId);
                    if (wmId) {
                        // Check if they already exist as a member but with a different role
                        const existingMember = await tx.projectMember.findFirst({
                            where: {
                                projectId: values.projectId,
                                workspaceMemberId: wmId
                            }
                        });

                        if (existingMember) {
                            await tx.projectMember.update({
                                where: { id: existingMember.id },
                                data: { projectRole: "PROJECT_MANAGER", hasAccess: true }
                            });
                        } else {
                            await tx.projectMember.create({
                                data: {
                                    projectId: values.projectId,
                                    workspaceMemberId: wmId,
                                    projectRole: "PROJECT_MANAGER",
                                    hasAccess: true
                                }
                            });
                        }
                    }
                }

                // Remove project managers (demote to MEMBER or delete? User said "only that person will be the pm")
                // Usually we just demote them to MEMBER or remove their PM status.
                // Let's demote them to MEMBER if we want them to stay in the project, 
                // but the user said "ONLY that person will be the pm".
                // I'll demote them to MEMBER.
                for (const userId of idsToRemove) {
                    const pm = currentPMs.find(pm => (pm as any).WorkspaceMember.userId === userId);
                    if (pm) {
                        await tx.projectMember.update({
                            where: { id: pm.id },
                            data: { projectRole: "MEMBER" }
                        });
                    }
                }
            }
        });

        // 6. Invalidate project cache
        const { invalidateWorkspaceProjects } = await import(
            "@/lib/cache/invalidation"
        );
        await invalidateWorkspaceProjects(project.workspaceId);

        return {
            status: "success",
            message: "Project updated successfully.",
        };
    } catch (err) {
        console.error("Error updating project:", err);
        return {
            status: "error",
            message: "An unexpected error occurred while updating the project. Please try again later.",
        };
    }
}