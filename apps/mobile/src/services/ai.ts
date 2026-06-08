import { apiFetch } from "./api";

export interface TravisMessage {
    role: "user" | "assistant";
    content: string;
}

export interface AIChatResponse {
    success: boolean;
    data?: {
        message: string;
    };
    error?: string;
}

/**
 * Send a message to Travis, the Trava workspace AI assistant.
 */
export async function sendAIChatMessage(
    workspaceId: string,
    message: string,
    history: TravisMessage[] = []
): Promise<AIChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35_000);

    try {
        const res = await apiFetch("/api/ai/chat", {
            method: "POST",
            body: JSON.stringify({
                message,
                history,
                workspaceId,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 429) {
            return {
                success: false,
                error: "You're sending messages too fast. Please wait a moment and try again.",
            };
        }

        if (res.status === 504) {
            return {
                success: false,
                error: "Travis is taking too long to respond. Please try again.",
            };
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            return {
                success: false,
                error: (errorData as any)?.error || `Server error (${res.status})`,
            };
        }

        const data = await res.json();
        return data as AIChatResponse;
    } catch (error: any) {
        clearTimeout(timeoutId);

        if (error?.name === "AbortError") {
            return {
                success: false,
                error: "Travis is taking too long to respond. Please try again.",
            };
        }

        if (
            error?.message?.toLowerCase().includes("network") ||
            error?.message?.toLowerCase().includes("fetch")
        ) {
            return {
                success: false,
                error: "Unable to connect. Please check your internet connection.",
            };
        }

        console.error("[Travis Service] Chat error:", error);
        return {
            success: false,
            error: error.message || "Failed to connect to Travis.",
        };
    }
}

// Keep legacy export alias for backwards compatibility during transition
export type AIChatMessage = TravisMessage;
