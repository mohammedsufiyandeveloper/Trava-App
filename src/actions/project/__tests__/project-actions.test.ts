import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProject } from "../create-project";
import { deleteProject } from "../delete-project";
import { editProject } from "../update-project";
import { requireUser } from "@/lib/auth/require-user";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { hasWorkspacePermission } from "@/lib/constants/workspace-access";
import prisma from "@/lib/db";

describe("Project Actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const validWorkspaceId = "846e17c7-d85f-4453-9ca0-0acc7bfce49c";
    const validProjectId = "846e17c7-d85f-4453-9ca0-0acc7bfce49d";

    describe("createProject", () => {
        const projectData = {
            workspaceId: validWorkspaceId,
            name: "New Project",
            slug: "new-project",
            description: "A description",
            color: "#ff0000",
            projectManagers: ["user_admin"],
            memberAccess: [], // Required by schema
        };

        it("should successfully create a project if user has permission", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_admin" });
            (prisma.workspace.findUnique as any).mockResolvedValue({
                id: validWorkspaceId,
                members: [
                    { id: "wm_admin", userId: "user_admin", workspaceRole: "ADMIN" }
                ]
            });
            (hasWorkspacePermission as any).mockReturnValue(true);

            const result = await createProject(projectData);

            expect(result.status).toBe("success");
            expect(prisma.project.create).toHaveBeenCalled();
        });

        it("should fail if user is not in the workspace", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_outsider" });
            (prisma.workspace.findUnique as any).mockResolvedValue({
                id: validWorkspaceId,
                members: [
                    { id: "wm_admin", userId: "user_admin", workspaceRole: "ADMIN" }
                ]
            });
            (hasWorkspacePermission as any).mockReturnValue(true);

            const result = await createProject(projectData);

            expect(result.status).toBe("error");
            expect(result.message).toContain("must be a member");
        });

        it("should fail if unauthorized user attempts to create project", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_member" });
            (prisma.workspace.findUnique as any).mockResolvedValue({
                id: validWorkspaceId,
                members: [
                    { id: "wm_member", userId: "user_member", workspaceRole: "MEMBER" }
                ]
            });
            (hasWorkspacePermission as any).mockReturnValue(false);

            const result = await createProject(projectData);

            expect(result.status).toBe("error");
            expect(result.message).toContain("don't have permission");
        });
    });

    describe("deleteProject", () => {
        it("should fail if user is not an admin or owner", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_member" });
            (prisma.project.findUnique as any).mockResolvedValue({
                id: validProjectId,
                workspaceId: validWorkspaceId,
                workspace: { ownerId: "user_owner" }
            });
            (getUserPermissions as any).mockResolvedValue({ isWorkspaceAdmin: false });

            const result = await deleteProject(validProjectId);

            expect(result.status).toBe("error");
            expect(result.message).toContain("Only workspace owners and admins");
        });

        it("should successfully delete if user is the workspace owner", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_owner" });
            (prisma.project.findUnique as any).mockResolvedValue({
                id: validProjectId,
                workspaceId: validWorkspaceId,
                workspace: { ownerId: "user_owner" }
            });
            (getUserPermissions as any).mockResolvedValue({ isWorkspaceAdmin: false });

            const result = await deleteProject(validProjectId);

            expect(result.status).toBe("success");
            expect(prisma.project.delete).toHaveBeenCalled();
        });
    });

    describe("editProject", () => {
        const editData = {
            projectId: validProjectId, // Must be UUID
            name: "Updated Name",
            slug: "updated-slug",
        };

        it("should fail if slug collision occurs", async () => {
            (prisma.project.findUnique as any).mockResolvedValue({
                id: validProjectId,
                workspaceId: validWorkspaceId,
                slug: "old-slug",
                workspace: { members: [] }
            });
            (getUserPermissions as any).mockResolvedValue({ isWorkspaceAdmin: true });
            (prisma.project.findFirst as any).mockResolvedValue({ id: "p_other", slug: "updated-slug" });

            const result = await editProject(editData);

            expect(result.status).toBe("error");
            expect(result.message).toContain("already exists");
        });

        it("should successfully update project info", async () => {
            (prisma.project.findUnique as any).mockResolvedValue({
                id: validProjectId,
                workspaceId: validWorkspaceId,
                slug: "old-slug",
                workspace: { members: [] }
            });
            (getUserPermissions as any).mockResolvedValue({ isWorkspaceAdmin: true });
            (prisma.project.findFirst as any).mockResolvedValue(null);

            const result = await editProject(editData);

            expect(result.status).toBe("success");
            expect(prisma.$transaction).toHaveBeenCalled();
        });
    });
});
