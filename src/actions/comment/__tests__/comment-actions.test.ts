import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCommentAction } from "../create-comment";
import { updateCommentAction } from "../update-comment";
import { requireUser } from "@/lib/auth/require-user";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import prisma from "@/lib/db";

describe("Comment Actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const validWorkspaceId = "w_123";
    const validProjectId = "p_123";
    const validTaskId = "t_123";

    describe("createCommentAction", () => {
        it("should successfully create a comment for a project member", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            (getUserPermissions as any).mockResolvedValue({ workspaceMemberId: "wm_1" });
            (prisma.task.findUnique as any).mockResolvedValue({ id: validTaskId, projectId: validProjectId });
            (prisma.comment.create as any).mockResolvedValue({ id: "c_1", content: "Test" });

            const result = await createCommentAction(validTaskId, "Test", validWorkspaceId, validProjectId);

            expect(result.success).toBe(true);
            expect(prisma.comment.create).toHaveBeenCalled();
        });

        it("should fail if content is empty", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            (getUserPermissions as any).mockResolvedValue({ workspaceMemberId: "wm_1" });

            const result = await createCommentAction(validTaskId, "   ", validWorkspaceId, validProjectId);

            expect(result.success).toBe(false);
            expect(result.error).toContain("required");
        });

        it("should fail if reply depth exceeds 5", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            (getUserPermissions as any).mockResolvedValue({ workspaceMemberId: "wm_1" });
            (prisma.task.findUnique as any).mockResolvedValue({ id: validTaskId, projectId: validProjectId });
            
            // Mock parent comment
            (prisma.comment.findUnique as any).mockResolvedValueOnce({ id: "p_1", taskId: validTaskId, isDeleted: false, parentCommentId: "p_0" });
            // Mock chain to exceed depth 5 in getCommentDepth
            (prisma.comment.findUnique as any).mockResolvedValue({ parentCommentId: "some_id" });

            const result = await createCommentAction(validTaskId, "Reply", validWorkspaceId, validProjectId, "p_1");

            expect(result.success).toBe(false);
            expect(result.error).toContain("Maximum reply depth");
        });
    });

    describe("updateCommentAction", () => {
        it("should allow editing own comment", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_1" });
            (prisma.comment.findUnique as any).mockResolvedValue({ id: "c_1", userId: "user_1", taskId: validTaskId });
            (prisma.comment.update as any).mockResolvedValue({ id: "c_1", content: "Updated" });

            const result = await updateCommentAction("c_1", "Updated");

            expect(result.success).toBe(true);
            expect(prisma.comment.update).toHaveBeenCalled();
        });

        it("should block editing someone else's comment", async () => {
            (requireUser as any).mockResolvedValue({ id: "user_me" });
            (prisma.comment.findUnique as any).mockResolvedValue({ id: "c_1", userId: "user_someone_else" });

            const result = await updateCommentAction("c_1", "Hacked");

            expect(result.success).toBe(false);
            expect(result.error).toContain("only edit your own");
        });
    });
});
