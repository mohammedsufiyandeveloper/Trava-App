import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTag } from "../create-tag";
import { updateTag } from "../update-tag";
import { deleteTag } from "../delete-tag";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { tagNameExists } from "@/data/tag/get-tags";
import prisma from "@/lib/db";

describe("Tag Actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const validWorkspaceId = "846e17c7-d85f-4453-9ca0-0acc7bfce49c";
    const validTagId = "846e17c7-d85f-4453-9ca0-0acc7bfce49d";

    describe("createTag", () => {
        it("should successfully create a tag if user is admin", async () => {
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: true });
            (tagNameExists as any).mockResolvedValue(false);
            (prisma.tag.create as any).mockResolvedValue({ id: validTagId, name: "Urgent" });

            const result = await createTag({
                workspaceId: validWorkspaceId,
                name: "Urgent",
                requirePurchase: false
            });

            expect(result.success).toBe(true);
            expect(prisma.tag.create).toHaveBeenCalled();
        });

        it("should fail if tag name already exists", async () => {
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: true });
            (tagNameExists as any).mockResolvedValue(true);

            const result = await createTag({
                workspaceId: validWorkspaceId,
                name: "Duplicate",
                requirePurchase: false
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("already exists");
        });
    });

    describe("updateTag", () => {
        it("should successfully update a tag", async () => {
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: true });
            (tagNameExists as any).mockResolvedValue(false);
            (prisma.tag.update as any).mockResolvedValue({ id: validTagId, name: "Updated" });

            const result = await updateTag({
                tagId: validTagId,
                workspaceId: validWorkspaceId,
                name: "Updated",
                requirePurchase: true
            });

            expect(result.success).toBe(true);
            expect(prisma.tag.update).toHaveBeenCalled();
        });
    });

    describe("deleteTag", () => {
        it("should successfully delete a tag", async () => {
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: true });

            const result = await deleteTag({
                tagId: validTagId,
                workspaceId: validWorkspaceId
            });

            expect(result.success).toBe(true);
            expect(prisma.tag.delete).toHaveBeenCalled();
        });

        it("should fail if user is not an admin", async () => {
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: false });

            const result = await deleteTag({
                tagId: validTagId,
                workspaceId: validWorkspaceId
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("don't have permission");
        });
    });
});
