import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveTravisContext, projectScopeFilter } from "./context";
import prisma from "@/lib/db";

vi.mock("@/lib/db", () => ({
    default: {
        workspaceMember: { findUnique: vi.fn() },
        project: { findMany: vi.fn() },
        projectMember: { findMany: vi.fn() },
        task: { findFirst: vi.fn() },
    },
}));

describe("resolveTravisContext", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns null for a non-member (deny)", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue(null);
        const ctx = await resolveTravisContext({ userId: "u1", workspaceId: "ws1" });
        expect(ctx).toBeNull();
    });

    it("gives admins full workspace project visibility", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "ADMIN" });
        (prisma.project.findMany as any).mockResolvedValue([{ id: "p1" }, { id: "p2" }]);

        const ctx = await resolveTravisContext({ userId: "u1", workspaceId: "ws1" });
        expect(ctx).not.toBeNull();
        expect(ctx!.isWorkspaceAdmin).toBe(true);
        expect(ctx!.canSeeAllProjects).toBe(true);
        expect(ctx!.accessibleProjectIds.sort()).toEqual(["p1", "p2"]);
        expect(prisma.projectMember.findMany).not.toHaveBeenCalled();
    });

    it("scopes non-admins to their project memberships only", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "MEMBER" });
        (prisma.projectMember.findMany as any).mockResolvedValue([
            { projectId: "p1" },
            { projectId: "p1" },
            { projectId: "p3" },
        ]);

        const ctx = await resolveTravisContext({ userId: "u1", workspaceId: "ws1" });
        expect(ctx!.canSeeAllProjects).toBe(false);
        expect(ctx!.accessibleProjectIds.sort()).toEqual(["p1", "p3"]);
        expect(prisma.project.findMany).not.toHaveBeenCalled();
        expect(prisma.projectMember.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ hasAccess: true }),
            })
        );
    });

    it("drops a selected project the caller cannot access", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "MEMBER" });
        (prisma.projectMember.findMany as any).mockResolvedValue([{ projectId: "p1" }]);

        const ctx = await resolveTravisContext({
            userId: "u1",
            workspaceId: "ws1",
            selectedProjectId: "p999",
        });
        expect(ctx!.selectedProjectId).toBeUndefined();
    });

    it("drops a selected task in an inaccessible project", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "MEMBER" });
        (prisma.projectMember.findMany as any).mockResolvedValue([{ projectId: "p1" }]);
        (prisma.task.findFirst as any).mockResolvedValue({ id: "t9", projectId: "p2" });

        const ctx = await resolveTravisContext({
            userId: "u1",
            workspaceId: "ws1",
            selectedTaskId: "t9",
        });
        expect(ctx!.selectedTaskId).toBeUndefined();
    });

    it("falls back to UTC for an invalid timezone", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "MEMBER" });
        (prisma.projectMember.findMany as any).mockResolvedValue([]);
        const ctx = await resolveTravisContext({ userId: "u1", workspaceId: "ws1", timezone: "Not/AZone" });
        expect(ctx!.timezone).toBe("UTC");
    });
});

describe("projectScopeFilter", () => {
    it("is unconstrained for admins", () => {
        const f = projectScopeFilter({ canSeeAllProjects: true, workspaceId: "ws1" } as any);
        expect(f).toEqual({ workspaceId: "ws1" });
    });
    it("restricts non-admins to accessible projects", () => {
        const f = projectScopeFilter({
            canSeeAllProjects: false,
            workspaceId: "ws1",
            accessibleProjectIds: ["p1", "p2"],
        } as any);
        expect(f).toEqual({ workspaceId: "ws1", projectId: { in: ["p1", "p2"] } });
    });
});
