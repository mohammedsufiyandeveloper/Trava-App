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
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: true, workspaceMemberId: "wm_admin" });
            (prisma.board_items.create as any).mockResolvedValue({ id: "b_1" });

            const result = await createBoardItem(validWorkspaceId, "wm_target", "Admin note");

            expect(result.status).toBe("success");
            expect(prisma.board_items.create).toHaveBeenCalled();
        });

        it("should prevent members from adding notes to others' boards", async () => {
            (requireUser as any).mockResolvedValue({ id: "member_user" });
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: false, workspaceMemberId: "wm_member" });

            const result = await createBoardItem(validWorkspaceId, "wm_other", "Member note");

            expect(result.status).toBe("error");
            expect(result.message).toContain("Unauthorized");
        });
    });

    describe("deleteBoardItem", () => {
        it("should prevent members from deleting notes created by admins", async () => {
            (requireUser as any).mockResolvedValue({ id: "member_user" });
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: false, workspaceMemberId: "wm_member" });

            // Mock item created by an OWNER (Admin role)
            (prisma.board_items.findUnique as any).mockResolvedValue({
                id: validItemId,
                assignedById: "wm_admin",
                memberId: "wm_member",
                assignedBy: { workspaceRole: "OWNER" }
            });

            const result = await deleteBoardItem(validWorkspaceId, validItemId);

            expect(result.status).toBe("error");
            expect(result.message).toContain("cannot delete notes created by an Admin");
        });

        it("should allow members to delete their own self-created notes", async () => {
            (requireUser as any).mockResolvedValue({ id: "member_user" });
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: false, workspaceMemberId: "wm_member" });

            (prisma.board_items.findUnique as any).mockResolvedValue({
                id: validItemId,
                assignedById: "wm_member",
                memberId: "wm_member",
                assignedBy: { workspaceRole: "MEMBER" }
            });

            const result = await deleteBoardItem(validWorkspaceId, validItemId);

            expect(result.status).toBe("success");
            expect(prisma.board_items.delete).toHaveBeenCalled();
        });
    });
});
