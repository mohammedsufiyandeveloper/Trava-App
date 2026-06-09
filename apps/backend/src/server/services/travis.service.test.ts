import { describe, it, expect, vi, beforeEach } from "vitest";
import { TravisService } from "./travis.service";
import prisma from "@/lib/db";

// Use vi.hoisted so the mock fn is available inside the vi.mock factory.
const { mockSendMessage } = vi.hoisted(() => ({ mockSendMessage: vi.fn() }));

// Mock the Google Generative AI SDK.
//
// IMPORTANT: the real enums (SchemaType, FunctionCallingMode) are evaluated at
// module load time when travis.service.ts builds its TOOLS array, so we keep
// the real exports via importActual and only swap out the network-calling
// GoogleGenerativeAI class. This guarantees the suite never reaches Gemini.
vi.mock("@google/generative-ai", async (importActual) => {
    const actual = await importActual<typeof import("@google/generative-ai")>();
    class MockGoogleGenerativeAI {
        constructor(_apiKey?: string) {}
        getGenerativeModel() {
            return {
                startChat: () => ({ sendMessage: mockSendMessage }),
            };
        }
    }
    return { ...actual, GoogleGenerativeAI: MockGoogleGenerativeAI };
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

// Build a Gemini-style `sendMessage` result. The service reads
// `result.response.functionCalls()` and `result.response.text()`.
function geminiResult(opts: { functionCalls?: { name: string; args: any }[]; text?: string }) {
    const calls = opts.functionCalls ?? [];
    return {
        response: {
            functionCalls: () => (calls.length > 0 ? calls : undefined),
            text: () => opts.text ?? "",
        },
    };
}

describe("TravisService.chat", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns a response when user is a workspace member", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "MEMBER" });
        mockSendMessage.mockResolvedValue(geminiResult({ text: "Here are your projects." }));

        const result = await TravisService.chat("ws1", "user1", "Show me projects", []);
        expect(result).toBe("Here are your projects.");
    });

    it("returns error message when user is not a workspace member", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue(null);

        const result = await TravisService.chat("ws1", "outsider", "hello", []);
        expect(result).toMatch(/member/i);
        // No model call should ever be made for a non-member.
        expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("executes tool calls and sends results back to Gemini", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "ADMIN" });
        (prisma.project.count as any).mockResolvedValue(5);
        (prisma.workspaceMember.count as any).mockResolvedValue(10);
        (prisma.task.groupBy as any).mockResolvedValue([
            { status: "TO_DO", _count: { id: 3 } },
            { status: "COMPLETED", _count: { id: 7 } },
        ]);

        // Round 1: model asks for a tool, then returns the final answer.
        mockSendMessage
            .mockResolvedValueOnce(geminiResult({ functionCalls: [{ name: "get_workspace_summary", args: {} }] }))
            .mockResolvedValueOnce(geminiResult({ text: "Your workspace has 5 projects and 10 members." }));

        const result = await TravisService.chat("ws1", "user1", "Summarize workspace", []);
        expect(result).toBe("Your workspace has 5 projects and 10 members.");
        // One call to request the tool, one to send the tool result back.
        expect(mockSendMessage).toHaveBeenCalledTimes(2);
    });

    it("blocks tool execution for a non-member even after initial check passes (defense in depth)", async () => {
        // First findUnique (chat-level membership check) returns a member,
        // second findUnique (inside executeTool) returns null — revoked mid-request.
        (prisma.workspaceMember.findUnique as any)
            .mockResolvedValueOnce({ id: "mem1", workspaceRole: "MEMBER" })
            .mockResolvedValueOnce(null);

        mockSendMessage
            .mockResolvedValueOnce(geminiResult({ functionCalls: [{ name: "get_workspace_summary", args: {} }] }))
            .mockResolvedValueOnce(geminiResult({ text: "Access was denied in tools." }));

        const result = await TravisService.chat("ws1", "user1", "Summary please", []);
        expect(typeof result).toBe("string");

        // The second sendMessage call carries the tool result, which must contain
        // an access-denied error rather than real workspace data.
        const secondCallArg = mockSendMessage.mock.calls[1][0];
        const part = secondCallArg[0];
        expect(part.functionResponse.name).toBe("get_workspace_summary");
        expect(part.functionResponse.response.result).toMatchObject({
            error: expect.stringMatching(/access denied/i),
        });
    });

    it("respects max tool rounds (5)", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "ADMIN" });
        (prisma.project.count as any).mockResolvedValue(1);
        (prisma.workspaceMember.count as any).mockResolvedValue(1);
        (prisma.task.groupBy as any).mockResolvedValue([]);

        // Always respond with a tool call — simulates a model that never settles.
        mockSendMessage.mockResolvedValue(
            geminiResult({ functionCalls: [{ name: "get_workspace_summary", args: {} }] })
        );

        const result = await TravisService.chat("ws1", "user1", "Summarize", []);
        // Should resolve (not throw) with the max-steps fallback message.
        expect(typeof result).toBe("string");
        expect(result).toMatch(/maximum number of reasoning steps/i);
        // Each of the 5 rounds makes 2 sendMessage calls (request + tool result).
        expect(mockSendMessage).toHaveBeenCalledTimes(10);
    });

    it("handles invalid tool args gracefully", async () => {
        (prisma.workspaceMember.findUnique as any).mockResolvedValue({ id: "mem1", workspaceRole: "MEMBER" });
        // No project matches the empty id, so prisma returns nothing.
        (prisma.project.findFirst as any).mockResolvedValue(null);

        mockSendMessage
            .mockResolvedValueOnce(
                geminiResult({ functionCalls: [{ name: "get_project_detail", args: { projectId: "" } }] })
            )
            .mockResolvedValueOnce(geminiResult({ text: "I couldn't find that project." }));

        const result = await TravisService.chat("ws1", "user1", "Project detail", []);
        expect(typeof result).toBe("string");

        // The tool result sent back to the model should be an error, not a crash.
        const secondCallArg = mockSendMessage.mock.calls[1][0];
        const toolResult = secondCallArg[0].functionResponse.response.result;
        expect(toolResult.error).toBeDefined();
    });
});
