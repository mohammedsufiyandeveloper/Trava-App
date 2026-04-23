import { Hono } from "hono";
import { AIService } from "@/server/services/ai.service";
import { HonoVariables } from "../types";

export const aiRouter = new Hono<{ Variables: HonoVariables }>()

.post("/chat", async (c) => {
    const user = c.get("user");
    const workspaceId = c.req.header("x-workspace-id");
    
    if (!user || !user.id) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!workspaceId) return c.json({ success: false, error: "Workspace ID is required" }, 400);

    try {
        const { message, history } = await c.req.json();
        
        if (!message) {
            return c.json({ success: false, error: "Message is required" }, 400);
        }

        const response = await AIService.chat(workspaceId, user.id, message, history || []);
        
        return c.json({ 
            success: true, 
            data: {
                message: response
            }
        });
    } catch (error: any) {
        console.error("AI Chat Error:", error);
        return c.json({ success: false, error: error.message || "Internal Server Error" }, 500);
    }
});
