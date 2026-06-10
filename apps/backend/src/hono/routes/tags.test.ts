import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import { getWorkspacePermissions } from "@/data/user/get-user-permissions";
import { HonoVariables } from "../types";
import { tagsRouter } from "./tags";

vi.mock("@/data/tag/get-tags", () => ({
    getWorkspaceTags: vi.fn(),
}));
vi.mock("@/data/user/get-user-permissions", () => ({
    getWorkspacePermissions: vi.fn(),
}));

const app = new Hono<{ Variables: HonoVariables }>();
app.use("*", async (c, next) => {
    c.set("user", { id: "u1" } as any);
    await next();
});
app.route("/tags", tagsRouter);

describe("tags route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getWorkspacePermissions as any).mockResolvedValue({ hasAccess: true });
        (getWorkspaceTags as any).mockResolvedValue([{ id: "tag1" }]);
    });

    it("returns tags to workspace members", async () => {
        const response = await app.request("/tags?workspaceId=ws1");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            tags: [{ id: "tag1" }],
        });
    });

    it("rejects users outside the workspace", async () => {
        (getWorkspacePermissions as any).mockResolvedValue({ hasAccess: false });

        const response = await app.request("/tags?workspaceId=ws1");

        expect(response.status).toBe(403);
        expect(getWorkspaceTags).not.toHaveBeenCalled();
    });
});
