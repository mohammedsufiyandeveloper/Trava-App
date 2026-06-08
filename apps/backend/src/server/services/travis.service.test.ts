import { describe, it, expect, vi, beforeEach } from "vitest";
import { TravisService } from "./travis.service";
import prisma from "@/lib/db";

// Use vi.hoisted so mockCreate is available inside the vi.mock factory
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
    class MockAnthropic {
        messages = { create: mockCreate };
        constructor(_opts?: any) {}
    }
    return {
        default: MockAnthropic,
    };
});

// Mock prisma
vi.mock("@/lib/db", () => ({
    default: {
        workspaceMember: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
        },
        project: {
            count: vi.fn(),
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        task: {
            groupBy: vi.fn(),
            findMany: vi.fn(),
        },
        projectMember: {
            findMany: vi.fn(),
        },
        attendance: {
            findMany: vi.fn(),
        },
        leave_request: {
            findMany: vi.fn(),
        },
        dailyReport: {
            findMany: vi.fn(),
        },
        indent: {
            findMany: vi.fn(),
        },
        material_catalog: {
            findMany: vi.fn(),
        },
        vendor: {
            findMany: vi.fn(),
        },
    },
}));

describe("TravisService.chat", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns a response when user is a workspace member", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "MEMBER" });
        mockCreate.mockResolvedValue({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "Here are your projects." }],
        });

        const result = await TravisService.chat("ws1", "user1", "Show me projects", []);
        expect(result).toBe("Here are your projects.");
    });

    it("returns error message when user is not a workspace member", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue(null);

        const result = await TravisService.chat("ws1", "outsider", "hello", []);
        expect(result).toMatch(/member/i);
    });

    it("executes tool calls and sends results back to Claude", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "ADMIN" });
        (prisma.project.count as any).mockResolvedValue(5);
        (prisma.workspaceMember.count as any).mockResolvedValue(10);
        (prisma.task.groupBy as any).mockResolvedValue([
            { status: "TO_DO", _count: { id: 3 } },
            { status: "COMPLETED", _count: { id: 7 } },
        ]);

        // First call: tool_use
        mockCreate.mockResolvedValueOnce({
            stop_reason: "tool_use",
            content: [
                {
                    type: "tool_use",
                    id: "tu_1",
                    name: "get_workspace_summary",
                    input: {},
                },
            ],
        });
        // Second call: end_turn with final answer
        mockCreate.mockResolvedValueOnce({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "Your workspace has 5 projects and 10 members." }],
        });

        const result = await TravisService.chat("ws1", "user1", "Summarize workspace", []);
        expect(result).toBe("Your workspace has 5 projects and 10 members.");
        expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("blocks tool execution for a non-member even after initial check passes (defense in depth)", async () => {
        // First findUnique (for chat membership check) returns member
        (prisma.workspaceMember.findUnique as any)
            .mockResolvedValueOnce({ id: "mem1", workspaceRole: "MEMBER" })
            // Second findUnique (inside executeTool) returns null — simulates revoked membership
            .mockResolvedValueOnce(null);

        mockCreate.mockResolvedValueOnce({
            stop_reason: "tool_use",
            content: [
                {
                    type: "tool_use",
                    id: "tu_1",
                    name: "get_workspace_summary",
                    input: {},
                },
            ],
        });
        mockCreate.mockResolvedValueOnce({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "Access was denied in tools." }],
        });

        const result = await TravisService.chat("ws1", "user1", "Summary please", []);
        // The second API call should have been made with a tool_result containing an access error
        const secondCallMessages = mockCreate.mock.calls[1][0].messages;
        const toolResultMsg = secondCallMessages[secondCallMessages.length - 1];
        expect(toolResultMsg.role).toBe("user");
        const toolResult = toolResultMsg.content[0];
        expect(JSON.parse(toolResult.content)).toMatchObject({ error: expect.stringMatching(/access denied/i) });
    });

    it("respects max tool rounds (5)", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "ADMIN" });
        (prisma.project.count as any).mockResolvedValue(1);
        (prisma.workspaceMember.count as any).mockResolvedValue(1);
        (prisma.task.groupBy as any).mockResolvedValue([]);


        // Always respond with tool_use (infinite loop scenario)
        mockCreate.mockResolvedValue({
            stop_reason: "tool_use",
            content: [
                {
                    type: "tool_use",
                    id: "tu_1",
                    name: "get_workspace_summary",
                    input: {},
                },
            ],
        });

        // After 5 rounds, the service calls Claude once more to synthesize — mock that too
        mockCreate.mockResolvedValueOnce({
            stop_reason: "tool_use",
            content: [{ type: "tool_use", id: "tu_1", name: "get_workspace_summary", input: {} }],
        });
        mockCreate.mockResolvedValueOnce({
            stop_reason: "tool_use",
            content: [{ type: "tool_use", id: "tu_2", name: "get_workspace_summary", input: {} }],
        });
        mockCreate.mockResolvedValueOnce({
            stop_reason: "tool_use",
            content: [{ type: "tool_use", id: "tu_3", name: "get_workspace_summary", input: {} }],
        });
        mockCreate.mockResolvedValueOnce({
            stop_reason: "tool_use",
            content: [{ type: "tool_use", id: "tu_4", name: "get_workspace_summary", input: {} }],
        });
        mockCreate.mockResolvedValueOnce({
            stop_reason: "tool_use",
            content: [{ type: "tool_use", id: "tu_5", name: "get_workspace_summary", input: {} }],
        });
        // Final synthesis call
        mockCreate.mockResolvedValueOnce({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "Reached max steps." }],
        });

        const result = await TravisService.chat("ws1", "user1", "Summarize", []);
        // Should resolve (not throw) and return a meaningful message
        expect(typeof result).toBe("string");
        // Total calls: 5 tool rounds + 1 final synthesis
        expect(mockCreate).toHaveBeenCalledTimes(6);
    });

    it("handles invalid tool args gracefully", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "MEMBER" });

        mockCreate.mockResolvedValueOnce({
            stop_reason: "tool_use",
            content: [
                {
                    type: "tool_use",
                    id: "tu_1",
                    name: "get_project_detail",
                    input: { projectId: "" }, // invalid: empty string
                },
            ],
        });
        mockCreate.mockResolvedValueOnce({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "I couldn't find that project." }],
        });

        const result = await TravisService.chat("ws1", "user1", "Project detail", []);
        expect(typeof result).toBe("string");

        // Verify the tool result contained an error (not a crash)
        const secondCallMessages = mockCreate.mock.calls[1][0].messages;
        const toolResultMsg = secondCallMessages[secondCallMessages.length - 1];
        const toolResult = JSON.parse(toolResultMsg.content[0].content);
        expect(toolResult.error).toBeDefined();
    });
});
