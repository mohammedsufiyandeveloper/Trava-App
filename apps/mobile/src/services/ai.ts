import { apiFetch } from "./api";

export interface AIChatMessage {
    role: "user" | "model";
    parts: Array<{ text: string }>;
}

export interface AIChatResponse {
    success: boolean;
    data?: {
        message: string;
    };
    error?: string;
}

/**
 * Send a message to the Trava AI bot.
 */
export async function sendAIChatMessage(
    workspaceId: string,
    message: string,
    history: AIChatMessage[] = []
): Promise<AIChatResponse> {
    try {
        const res = await apiFetch("/api/ai/chat", {
            method: "POST",
            headers: {
                "x-workspace-id": workspaceId,
            },
            body: JSON.stringify({
                message,
                history,
            }),
        });

        const data = await res.json();
        return data as AIChatResponse;
    } catch (error: any) {
        console.error("[AI Service] Chat error:", error);
        return {
            success: false,
            error: error.message || "Failed to connect to Trava AI",
        };
    }
}
