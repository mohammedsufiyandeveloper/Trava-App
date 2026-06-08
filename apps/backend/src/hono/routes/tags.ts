import { Hono } from "hono";
import { HonoVariables } from "../types";
import { getWorkspaceTags } from "@/data/tag/get-tags";
import { createTag } from "@/actions/tag/create-tag";
import { updateTag } from "@/actions/tag/update-tag";
import { deleteTag } from "@/actions/tag/delete-tag";

export const tagsRouter = new Hono<{ Variables: HonoVariables }>()

    // GET /api/tags
    .get("/", async (c) => {
        const workspaceId = c.req.query("workspaceId");
        if (!workspaceId) {
            return c.json({ error: "Missing workspaceId" }, 400);
        }

        try {
            const tags = await getWorkspaceTags(workspaceId);
            return c.json({
                success: true,
                tags: tags
            });
        } catch (error: any) {
            console.error("Hono API Error [Tags GET]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    })

    // POST /api/tags
    .post("/", async (c) => {
        try {
            const body = await c.req.json();
            const result = await createTag(body);

            if (!result.success) {
                return c.json({ error: result.error }, 400);
            }

            return c.json({
                success: true,
                data: result.data
            });
        } catch (error: any) {
            console.error("Hono API Error [Tags POST]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    })

    // PATCH /api/tags
    .patch("/", async (c) => {
        try {
            const body = await c.req.json();
            const result = await updateTag(body);

            if (!result.success) {
                return c.json({ error: result.error }, 400);
            }

            return c.json({
                success: true,
                data: result.data
            });
        } catch (error: any) {
            console.error("Hono API Error [Tags PATCH]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    })

    // DELETE /api/tags
    .delete("/", async (c) => {
        const tagId = c.req.query("tagId");
        const workspaceId = c.req.query("workspaceId");

        if (!tagId || !workspaceId) {
            return c.json({ error: "Missing tagId or workspaceId" }, 400);
        }

        try {
            const result = await deleteTag({ tagId, workspaceId });

            if (!result.success) {
                return c.json({ error: result.error }, 400);
            }

            return c.json({
                success: true,
                message: "Tag deleted successfully"
            });
        } catch (error: any) {
            console.error("Hono API Error [Tags DELETE]:", error);
            return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
        }
    });
