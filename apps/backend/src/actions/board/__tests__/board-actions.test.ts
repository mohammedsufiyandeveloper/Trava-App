import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBoardItem, toggleBoardItemStatus, deleteBoardItem } from "../board-actions";
import { requireUser } from "@/lib/auth/require-user";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import prisma from "@/lib/db";

describe("Board Actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const validWorkspaceId = "w_123";
    const validItemId = "b_123";

    describe("createBoardItem", () => {
        it("should allow admin to create a note for any member", async () => {
            (requireUser as any).mockResolvedValue({ id: "admin_user" });
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: true, WorkspaceMemberId: "wm_admin" });
            (prisma.member_todos.create as any).mockResolvedValue({ id: "b_1" });

            const result = await createBoardItem(validWorkspaceId, "wm_target", "Admin note");

            expect(result.status).toBe("success");
            expect(prisma.member_todos.create).toHaveBeenCalled();
        });

        it("should prevent members from adding notes to others' boards", async () => {
            (requireUser as any).mockResolvedValue({ id: "member_user" });
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: false, WorkspaceMemberId: "wm_member" });

            const result = await createBoardItem(validWorkspaceId, "wm_other", "Member note");

            expect(result.status).toBe("error");
            expect(result.message).toContain("Unauthorized");
        });
    });

    describe("deleteBoardItem", () => {
        it("should prevent members from deleting others' notes", async () => {
            (requireUser as any).mockResolvedValue({ id: "member_user" });
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: false, WorkspaceMemberId: "wm_member" });

            (prisma.member_todos.findUnique as any).mockResolvedValue({
                id: validItemId,
                memberId: "wm_other"
            });

            const result = await deleteBoardItem(validWorkspaceId, validItemId);

            expect(result.status).toBe("error");
            expect(result.message).toContain("Unauthorized");
        });

        it("should allow members to delete their own notes", async () => {
            (requireUser as any).mockResolvedValue({ id: "member_user" });
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: false, WorkspaceMemberId: "wm_member" });

            (prisma.member_todos.findUnique as any).mockResolvedValue({
                id: validItemId,
                memberId: "wm_member"
            });

            const result = await deleteBoardItem(validWorkspaceId, validItemId);

            expect(result.status).toBe("success");
            expect(prisma.member_todos.delete).toHaveBeenCalled();
        });
    });
});
