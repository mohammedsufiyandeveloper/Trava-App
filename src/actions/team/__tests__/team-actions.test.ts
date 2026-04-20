import { describe, it, expect, vi, beforeEach } from "vitest";
import { inviteMemberAction } from "../invite-member";
import { deleteMemberAction } from "../delete-member";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { getWorkspaceById } from "@/data/workspace/get-workspace-by-id";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { broadcastTeamUpdate } from "@/lib/realtime";

describe("Team Management Actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("inviteMemberAction", () => {
        const invitePayload = {
            email: "test@example.com",
            name: "Test User",
            niceName: "Testy",
            phoneNumber: "1234567890",
            password: "Password123!",
            role: "MEMBER" as const,
            workspaceId: "846e17c7-d85f-4453-9ca0-0acc7bfce49c",
        };

        it("should fail if user is not a workspace admin", async () => {
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: false });

            const result = await inviteMemberAction(invitePayload);

            expect(result.status).toBe("error");
            expect(result.message).toContain("Only workspace admins");
            expect(auth.api.signUpEmail).not.toHaveBeenCalled();
        });

        it("should succeed and broadcast event if all checks pass", async () => {
            (getWorkspacePermissions as any).mockResolvedValue({ isWorkspaceAdmin: true });
            (auth.api.signUpEmail as any).mockResolvedValue({ user: { id: "user_123" } });

            const result = await inviteMemberAction(invitePayload);

            expect(result.status).toBe("success");
            expect(broadcastTeamUpdate).toHaveBeenCalledWith(expect.objectContaining({
                type: "INVITE",
                workspaceId: "846e17c7-d85f-4453-9ca0-0acc7bfce49c",
            }));
        });
    });

    describe("deleteMemberAction", () => {
        it("should fail if current user is not an owner or admin", async () => {
            const mockWorkspace = {
                id: "ws_123",
                members: [
                    { userId: "me", workspaceRole: "MEMBER" }
                ]
            };
            (getWorkspaceById as any).mockResolvedValue(mockWorkspace);

            const result = await deleteMemberAction("member_456", "ws_123", "me");

            expect(result.status).toBe("error");
            expect(result.message).toContain("workspace owners/admins");
        });

        it("should prevent removing the owner", async () => {
            const mockWorkspace = {
                id: "ws_123",
                ownerId: "boss",
                members: [
                    { id: "me_id", userId: "me", workspaceRole: "ADMIN" },
                    { id: "boss_id", userId: "boss", workspaceRole: "OWNER" }
                ]
            };
            (getWorkspaceById as any).mockResolvedValue(mockWorkspace);

            const result = await deleteMemberAction("boss_id", "ws_123", "me");

            expect(result.status).toBe("error");
            expect(result.message).toContain("Cannot remove the workspace owner");
        });

        it("should successfully delete a member", async () => {
            const mockWorkspace = {
                id: "ws_123",
                ownerId: "me",
                members: [
                    { id: "me_id", userId: "me", workspaceRole: "OWNER" },
                    { id: "them_id", userId: "them", workspaceRole: "MEMBER", user: { name: "Joe" } }
                ]
            };
            (getWorkspaceById as any).mockResolvedValue(mockWorkspace);
            (prisma.workspace.count as any).mockResolvedValue(0);

            const result = await deleteMemberAction("them_id", "ws_123", "me");

            expect(result.status).toBe("success");
            expect(prisma.user.delete).toHaveBeenCalled();
            expect(broadcastTeamUpdate).toHaveBeenCalledWith(expect.objectContaining({
                type: "DELETE",
                payload: { memberId: "them_id" },
            }));
        });
    });
});
