import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { resetRuntimeCacheForTests } from "@/lib/cache/runtime-cache";
import { getProjectMembers } from "./get-project-members";

describe("getProjectMembers access and caching", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetRuntimeCacheForTests();
        (requireUser as any).mockResolvedValue({ id: "u1" });
        (prisma.project.findUnique as any).mockResolvedValue({
            workspaceId: "ws1",
        });
        (prisma.projectMember.findMany as any).mockResolvedValue([]);
    });

    it("does not expose members to unrelated workspace users", async () => {
        (getUserPermissions as any).mockResolvedValue({
            WorkspaceMemberId: "wm1",
            isWorkspaceAdmin: false,
            projectMember: null,
        });

        await expect(getProjectMembers("p1")).resolves.toEqual([]);
        expect(prisma.projectMember.findMany).not.toHaveBeenCalled();
    });

    it("caches member lists only after authorization succeeds", async () => {
        (getUserPermissions as any).mockResolvedValue({
            WorkspaceMemberId: "wm1",
            isWorkspaceAdmin: true,
            projectMember: null,
        });

        await getProjectMembers("p1");
        await getProjectMembers("p1");

        expect(prisma.projectMember.findMany).toHaveBeenCalledTimes(1);
        expect(getUserPermissions).toHaveBeenCalledTimes(2);
    });
});
