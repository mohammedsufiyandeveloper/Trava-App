import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/db";
import { LeaveService } from "./leave.service";

describe("LeaveService pagination", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.workspaceMember.findFirst as any).mockResolvedValue({
            id: "wm1",
            workspaceRole: "ADMIN",
        });
    });

    it("returns a capped cursor page", async () => {
        (prisma.leave_request.findMany as any).mockResolvedValue([
            { id: "l3" },
            { id: "l2" },
        ]);

        const result = await LeaveService.getLeaveRequestsPage(
            "ws1",
            "u1",
            undefined,
            { limit: 1, cursor: "l4" }
        );

        expect(prisma.leave_request.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { workspaceId: "ws1" },
                take: 2,
                cursor: { id: "l4" },
                skip: 1,
            })
        );
        expect(result.requests).toEqual([{ id: "l3" }]);
        expect(result.hasMore).toBe(true);
        expect(result.nextCursor).toBe("l3");
    });

    it("scopes personal pages to the requesting member", async () => {
        (prisma.workspaceMember.findFirst as any)
            .mockResolvedValueOnce({ id: "wm1", workspaceRole: "VIEWER" })
            .mockResolvedValueOnce({ id: "wm1", workspaceRole: "VIEWER" });
        (prisma.leave_request.findMany as any).mockResolvedValue([]);

        await LeaveService.getLeaveRequestsPage("ws1", "u1", "u1");

        expect(prisma.leave_request.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    workspaceId: "ws1",
                    workspaceMemberId: "wm1",
                },
            })
        );
    });

    it("searches old requests on the server", async () => {
        (prisma.leave_request.findMany as any).mockResolvedValue([]);

        await LeaveService.getLeaveRequestsPage(
            "ws1",
            "u1",
            undefined,
            { search: "medical" }
        );

        expect(prisma.leave_request.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    workspaceId: "ws1",
                    OR: expect.arrayContaining([
                        {
                            reason: {
                                contains: "medical",
                                mode: "insensitive",
                            },
                        },
                    ]),
                }),
            })
        );
    });
});
