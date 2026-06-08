import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWorkSpace } from "../create-workspace";
import { deleteWorkSpace } from "../delete-workspace";
import { updateWorkspaceInfo } from "../update-workspace-info";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import prisma from "@/lib/db";

describe("Workspace Actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createWorkSpace", () => {
        const workspaceData = {
            name: "New Workspace",
            slug: "new-workspace",
            description: "A description of the workspace",
        };

        it("should successfully create a workspace", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            
            const result = await createWorkSpace(workspaceData);

            expect(result.status).toBe("success");
            expect(prisma.workspace.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    name: workspaceData.name,
                    ownerId: "user_1",
                }),
            }));
        });

        it("should fail with invalid input data", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            
            const result = await createWorkSpace({ ...workspaceData, name: "ab" }); // Too short

            expect(result.status).toBe("error");
            expect(result.message).toContain("Invalid validation form data");
        });
    });

    describe("deleteWorkSpace", () => {
        it("should fail if workspace not found", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            (prisma.workspace.findUnique as any).mockResolvedValue(null);

            const result = await deleteWorkSpace("ws_NotFound");

            expect(result.status).toBe("error");
            expect(result.message).toBe("Workspace not found");
        });

        it("should fail if user is not the owner", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_NotOwner" });
            (prisma.workspace.findUnique as any).mockResolvedValue({ ownerId: "user_Owner" });

            const result = await deleteWorkSpace("ws_123");

            expect(result.status).toBe("error");
            expect(result.message).toContain("Only the owner can delete");
        });

        it("should successfully delete the workspace if user is owner", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_Owner" });
            (prisma.workspace.findUnique as any).mockResolvedValue({ ownerId: "user_Owner" });

            const result = await deleteWorkSpace("ws_123");

            expect(result.status).toBe("success");
            expect(prisma.workspace.delete).toHaveBeenCalledWith({
                where: { id: "ws_123" },
            });
        });
    });

    describe("updateWorkspaceInfo", () => {
        const updateData = {
            workspaceId: "846e17c7-d85f-4453-9ca0-0acc7bfce49c",
            name: "Updated Workspace",
            legalName: "Updated Legal Name",
            gstNumber: "27AAACR3714R1ZN",
            companyType: "Private Limited",
            industry: "Construction",
            msmeNumber: "MSME12345",
            email: "updated@example.com",
            phone: "9876543210",
            addressLine1: "123 Street",
            city: "City",
            state: "State",
            country: "Country",
            pincode: "123456",
        };

        it("should fail if user is not an admin", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: false });

            const result = await updateWorkspaceInfo(updateData);

            expect(result.status).toBe("error");
            expect(result.message).toContain("Unauthorized");
        });

        it("should successfully update workspace info if user is admin", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: true });

            const result = await updateWorkspaceInfo(updateData);

            expect(result.status).toBe("success");
            expect(prisma.workspace.update).toHaveBeenCalled();
        });
    });
});
