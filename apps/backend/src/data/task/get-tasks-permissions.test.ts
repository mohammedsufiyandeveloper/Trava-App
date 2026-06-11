import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserPermissions, getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { resolveTaskPermissions } from "./get-tasks";

vi.mock("@/data/user/get-user-permissions", () => ({
    getUserPermissions: vi.fn(),
    getWorkspacePermissions: vi.fn(),
}));

describe("resolveTaskPermissions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getUserPermissions as any).mockResolvedValue({});
    });

    it("restricts a workspace manager to managed projects and assigned work elsewhere", async () => {
        (getWorkspacePermissions as any).mockResolvedValue({
            WorkspaceMemberId: "wm-manager",
            isWorkspaceAdmin: true,
            isWorkspaceOwnerOrAdmin: false,
            isWorkspaceManager: true,
            leadProjectIds: ["lead-project"],
            managedProjectIds: ["managed-project"],
            memberProjectIds: ["member-project"],
            viewerProjectIds: [],
        });

        const result = await resolveTaskPermissions("manager-workspace", undefined, "manager-user");

        expect(result.isWorkspaceAdmin).toBe(false);
        expect(result.fullAccessProjectIds).toEqual(["lead-project", "managed-project"]);
        expect(result.restrictedProjectIds).toEqual(["member-project"]);
    });

    it("keeps true workspace owners and admins unrestricted", async () => {
        (getWorkspacePermissions as any).mockResolvedValue({
            WorkspaceMemberId: "wm-admin",
            isWorkspaceAdmin: true,
            isWorkspaceOwnerOrAdmin: true,
            isWorkspaceManager: false,
            leadProjectIds: [],
            managedProjectIds: [],
            memberProjectIds: [],
            viewerProjectIds: [],
        });

        const result = await resolveTaskPermissions("admin-workspace", undefined, "admin-user");

        expect(result.isWorkspaceAdmin).toBe(true);
        expect(result.authorizedProjectIds).toEqual([]);
        expect(result.fullAccessProjectIds).toEqual([]);
        expect(result.restrictedProjectIds).toEqual([]);
    });
});
