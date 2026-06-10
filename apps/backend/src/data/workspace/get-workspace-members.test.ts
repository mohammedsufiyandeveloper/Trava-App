import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { resetRuntimeCacheForTests } from "@/lib/cache/runtime-cache";
import { getWorkspaceMembers } from "./get-workspace-members";

vi.mock("@/lib/auth/require-user", () => ({
    requireUser: vi.fn(),
}));

describe("getWorkspaceMembers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetRuntimeCacheForTests();
        (requireUser as any).mockResolvedValue({ id: "u1" });
    });

    it("verifies membership outside a filtered result", async () => {
        (prisma.workspaceMember.findMany as any)
            .mockResolvedValueOnce([
                {
                    id: "m2",
                    workspaceId: "ws1",
                    userId: "u2",
                    workspaceRole: "ADMIN",
                    user: { id: "u2", email: "u2@example.com" },
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: "m1",
                    workspaceId: "ws1",
                    userId: "u1",
                    workspaceRole: "MEMBER",
                    user: { id: "u1", email: "u1@example.com" },
                },
            ]);

        const result = await getWorkspaceMembers("ws1", "ADMIN");

        expect(result.workspaceMembers).toHaveLength(1);
        expect(prisma.workspaceMember.findMany).toHaveBeenCalledTimes(2);
    });

    it("rejects an outsider using a role filter", async () => {
        (prisma.workspaceMember.findMany as any)
            .mockResolvedValueOnce([
                {
                    id: "m2",
                    workspaceId: "ws1",
                    userId: "u2",
                    workspaceRole: "ADMIN",
                    user: { id: "u2", email: "u2@example.com" },
                },
            ])
            .mockResolvedValueOnce([]);

        await expect(getWorkspaceMembers("ws1", "ADMIN")).rejects.toThrow(
            "notFound not available in API server"
        );
    });
});
