import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getUserProjects } from "./get-projects";

// prisma is mocked here; requireUser is mocked globally in src/tests/setup.ts.
// getUserProjects -> _getUserProjectsInternal calls workspaceMember.findUnique
// then project.findMany({ select: projectSelect }).
vi.mock("@/lib/db", () => ({
    default: {
        workspaceMember: { findUnique: vi.fn() },
        project: { findMany: vi.fn() },
    },
}));

describe("getUserProjects projection (lite vs full)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (requireUser as any).mockResolvedValue({ id: "u1" });
        // OWNER/ADMIN sees all workspace projects (simplest branch).
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({
            id: "mem1",
            workspaceRole: "ADMIN",
            userId: "u1",
        });
        (prisma.project.findMany as any).mockResolvedValue([]);
    });

    it("lite=true selects list fields WITHOUT the heavy projectMembers array or _count", async () => {
        await getUserProjects("ws1", true);

        expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
        const select = (prisma.project.findMany as any).mock.calls[0][0].select;

        // Fields the Projects list / pickers render must be present.
        expect(select).toMatchObject({ id: true, name: true, color: true, description: true, workspaceId: true });
        // The payload bloat must be gone.
        expect(select.projectMembers).toBeUndefined();
        expect(select._count).toBeUndefined();
    });

    it("lite=false (default) still includes projectMembers for the full view", async () => {
        await getUserProjects("ws1", false);

        const select = (prisma.project.findMany as any).mock.calls[0][0].select;
        expect(select.projectMembers).toBeDefined();
    });
});
