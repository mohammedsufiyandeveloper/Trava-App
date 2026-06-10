import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/db";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import procurement from "./procurement";
import { HonoVariables } from "../types";

const app = new Hono<{ Variables: HonoVariables }>();
app.use("*", async (c, next) => {
    c.set("user", { id: "u1" } as any);
    await next();
});
app.route("/procurement", procurement);

describe("procurement reads", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getWorkspacePermissions as any).mockResolvedValue({
            workspaceMember: { id: "wm1" },
        });
    });

    it("returns a bounded indent page with a stable cursor", async () => {
        (prisma.indent.findMany as any).mockResolvedValue([
            { id: "i3" },
            { id: "i2" },
        ]);

        const response = await app.request(
            "/procurement/indents?workspaceId=ws1&limit=1&cursor=i4"
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.indent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { workspaceId: "ws1" },
                take: 2,
                cursor: { id: "i4" },
                skip: 1,
            })
        );
        expect(body.indents).toEqual([{ id: "i3" }]);
        expect(body.hasMore).toBe(true);
        expect(body.nextCursor).toBe("i3");
    });

    it("loads one workspace-scoped indent without listing history", async () => {
        (prisma.indent.findFirst as any).mockResolvedValue({ id: "i9" });

        const response = await app.request(
            "/procurement/indents?workspaceId=ws1&indentId=i9"
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            indent: { id: "i9" },
        });
        expect(prisma.indent.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "i9", workspaceId: "ws1" },
            })
        );
        expect(prisma.indent.findMany).not.toHaveBeenCalled();
    });

    it("applies server-side history search inside the page query", async () => {
        (prisma.indent.findMany as any).mockResolvedValue([]);

        await app.request(
            "/procurement/indents?workspaceId=ws1&search=cement"
        );

        expect(prisma.indent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    workspaceId: "ws1",
                    OR: expect.arrayContaining([
                        {
                            name: {
                                contains: "cement",
                                mode: "insensitive",
                            },
                        },
                    ]),
                }),
            })
        );
    });
});
