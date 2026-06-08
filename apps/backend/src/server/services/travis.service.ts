/**
 * Travis AI Service
 * Powered by Anthropic Claude. Replaces the Gemini-based AIService.
 * All tools are strictly read-only and scoped to the caller's workspace.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import prisma from "@/lib/db";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-5";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are Travis, a helpful and professional workspace assistant built for Trava — a project and team management platform.

You ONLY answer questions using the data returned by your tools. You NEVER make up information or guess. If a tool returns no data, say so honestly.

You have access to tools that can look up:
- Projects in the workspace (with member counts)
- Task lists (by project, status, assignee, due date)
- Tasks assigned to the current user
- Overdue tasks across the workspace
- Upcoming tasks (due in next N days)
- Workspace members and their roles
- Today's attendance (who is present/absent)
- Leave requests (pending or approved)
- Daily reports submitted by the team
- Indent/procurement records
- Material catalog
- Vendors
- A high-level workspace summary

Always be concise and well-formatted. Use bullet points and bold text where it helps readability.
Today's date is ${new Date().toISOString().split("T")[0]}.`;

// ---------------------------------------------------------------------------
// Tool definitions (Anthropic tool_use format)
// ---------------------------------------------------------------------------
const TOOLS: Anthropic.Tool[] = [
    {
        name: "get_workspace_summary",
        description:
            "Get a high-level summary of the workspace: number of projects, task statistics by status, and member count.",
        input_schema: {
            type: "object" as const,
            properties: {},
            required: [],
        },
    },
    {
        name: "get_projects",
        description:
            "List all projects the calling user has access to in the workspace, including member count.",
        input_schema: {
            type: "object" as const,
            properties: {},
            required: [],
        },
    },
    {
        name: "get_project_detail",
        description:
            "Get details for a single project including its task summary (counts by status).",
        input_schema: {
            type: "object" as const,
            properties: {
                projectId: {
                    type: "string",
                    description: "The project ID to look up",
                },
            },
            required: ["projectId"],
        },
    },
    {
        name: "get_tasks",
        description:
            "Get tasks in a specific project, optionally filtered by status or assignee workspace member ID.",
        input_schema: {
            type: "object" as const,
            properties: {
                projectId: {
                    type: "string",
                    description: "Project ID to list tasks for",
                },
                status: {
                    type: "string",
                    description:
                        "Filter by status: TO_DO | IN_PROGRESS | REVIEW | HOLD | COMPLETED | CANCELLED",
                },
                assigneeWorkspaceMemberId: {
                    type: "string",
                    description: "Filter by workspace member ID of the assignee",
                },
                limit: {
                    type: "number",
                    description: "Max tasks to return (default 20, max 50)",
                },
            },
            required: ["projectId"],
        },
    },
    {
        name: "get_my_tasks",
        description:
            "Get tasks assigned to the currently authenticated user (not completed or cancelled).",
        input_schema: {
            type: "object" as const,
            properties: {
                status: {
                    type: "string",
                    description:
                        "Optional status filter: TO_DO | IN_PROGRESS | REVIEW | HOLD",
                },
            },
            required: [],
        },
    },
    {
        name: "get_overdue_tasks",
        description:
            "Get all overdue tasks (dueDate in the past, not completed/cancelled) across the workspace.",
        input_schema: {
            type: "object" as const,
            properties: {
                limit: {
                    type: "number",
                    description: "Max tasks to return (default 20, max 50)",
                },
            },
            required: [],
        },
    },
    {
        name: "get_upcoming_tasks",
        description: "Get tasks due in the next N days across the workspace.",
        input_schema: {
            type: "object" as const,
            properties: {
                days: {
                    type: "number",
                    description: "Number of days ahead to look (default 7, max 30)",
                },
                limit: {
                    type: "number",
                    description: "Max tasks to return (default 20, max 50)",
                },
            },
            required: [],
        },
    },
    {
        name: "get_workspace_members",
        description: "List workspace members with their roles and basic profile info.",
        input_schema: {
            type: "object" as const,
            properties: {
                role: {
                    type: "string",
                    description:
                        "Optional role filter: OWNER | ADMIN | MANAGER | MEMBER | VIEWER | PROCUREMENT",
                },
            },
            required: [],
        },
    },
    {
        name: "get_attendance",
        description: "Get today's attendance records for the workspace (who is present, absent, on leave, etc.).",
        input_schema: {
            type: "object" as const,
            properties: {},
            required: [],
        },
    },
    {
        name: "get_leave_requests",
        description: "Get leave requests for the workspace, optionally filtered by status.",
        input_schema: {
            type: "object" as const,
            properties: {
                status: {
                    type: "string",
                    description: "Filter by status: PENDING | APPROVED | REJECTED",
                },
                limit: {
                    type: "number",
                    description: "Max records to return (default 20)",
                },
            },
            required: [],
        },
    },
    {
        name: "get_daily_reports",
        description: "Get recent daily reports submitted by team members.",
        input_schema: {
            type: "object" as const,
            properties: {
                limit: {
                    type: "number",
                    description: "Max records to return (default 20)",
                },
            },
            required: [],
        },
    },
    {
        name: "get_indents",
        description: "Get indent/procurement records for the workspace, optionally filtered by status.",
        input_schema: {
            type: "object" as const,
            properties: {
                status: {
                    type: "string",
                    description:
                        "Filter by status: DRAFT | SUBMITTED | ASSIGNED | APPROVED | CANCELLED",
                },
                limit: {
                    type: "number",
                    description: "Max records to return (default 20)",
                },
            },
            required: [],
        },
    },
    {
        name: "get_materials",
        description: "Get material catalog entries for the workspace.",
        input_schema: {
            type: "object" as const,
            properties: {
                limit: {
                    type: "number",
                    description: "Max records to return (default 30)",
                },
            },
            required: [],
        },
    },
    {
        name: "get_vendors",
        description: "Get vendor records for the workspace.",
        input_schema: {
            type: "object" as const,
            properties: {},
            required: [],
        },
    },
];

// ---------------------------------------------------------------------------
// Zod schemas for tool input validation
// ---------------------------------------------------------------------------
const GetProjectDetailSchema = z.object({
    projectId: z.string().min(1),
});

const GetTasksSchema = z.object({
    projectId: z.string().min(1),
    status: z.string().optional(),
    assigneeWorkspaceMemberId: z.string().optional(),
    limit: z.number().min(1).max(50).optional(),
});

const GetMyTasksSchema = z.object({
    status: z.string().optional(),
});

const GetOverdueTasksSchema = z.object({
    limit: z.number().min(1).max(50).optional(),
});

const GetUpcomingTasksSchema = z.object({
    days: z.number().min(1).max(30).optional(),
    limit: z.number().min(1).max(50).optional(),
});

const GetWorkspaceMembersSchema = z.object({
    role: z.string().optional(),
});

const GetLeaveRequestsSchema = z.object({
    status: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
});

const GetDailyReportsSchema = z.object({
    limit: z.number().min(1).max(100).optional(),
});

const GetIndentsSchema = z.object({
    status: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
});

const GetMaterialsSchema = z.object({
    limit: z.number().min(1).max(200).optional(),
});

// ---------------------------------------------------------------------------
// Tool executor — all calls are workspace-scoped and read-only
// ---------------------------------------------------------------------------
async function executeTool(
    toolName: string,
    rawInput: unknown,
    workspaceId: string,
    userId: string
): Promise<unknown> {
    // Verify caller is a member of the workspace before every tool call
    const membership = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
        select: { id: true, workspaceRole: true },
    });

    if (!membership) {
        return { error: "Access denied: you are not a member of this workspace." };
    }

    const memberId = membership.id;

    try {
        switch (toolName) {
            case "get_workspace_summary": {
                const [projectCount, memberCount, taskCounts] = await Promise.all([
                    prisma.project.count({ where: { workspaceId } }),
                    prisma.workspaceMember.count({ where: { workspaceId } }),
                    prisma.task.groupBy({
                        by: ["status"],
                        where: { workspaceId },
                        _count: { id: true },
                    }),
                ]);
                const statusBreakdown: Record<string, number> = {};
                taskCounts.forEach((r) => {
                    if (r.status) statusBreakdown[r.status] = (r._count as any).id;
                });
                return { projectCount, memberCount, taskStatusBreakdown: statusBreakdown };
            }

            case "get_projects": {
                const isAdmin =
                    membership.workspaceRole === "OWNER" ||
                    membership.workspaceRole === "ADMIN";
                const isManager = membership.workspaceRole === "MANAGER";

                let whereClause: any = { workspaceId };
                if (!isAdmin && !isManager) {
                    whereClause = {
                        workspaceId,
                        projectMembers: {
                            some: { workspaceMemberId: memberId, hasAccess: true },
                        },
                    };
                } else if (isManager) {
                    whereClause = {
                        workspaceId,
                        OR: [
                            { createdBy: userId },
                            {
                                projectMembers: {
                                    some: { workspaceMemberId: memberId, hasAccess: true },
                                },
                            },
                        ],
                    };
                }

                const projects = await prisma.project.findMany({
                    where: whereClause,
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        color: true,
                        _count: { select: { projectMembers: true, tasks: true } },
                    },
                    orderBy: { createdAt: "desc" },
                });

                return projects.map((p) => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    memberCount: p._count.projectMembers,
                    taskCount: p._count.tasks,
                }));
            }

            case "get_project_detail": {
                const args = GetProjectDetailSchema.parse(rawInput);
                const project = await prisma.project.findFirst({
                    where: { id: args.projectId, workspaceId },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        tasks: {
                            where: { isParent: true },
                            select: { status: true },
                        },
                        _count: { select: { projectMembers: true } },
                    },
                });
                if (!project) return { error: "Project not found or access denied." };

                const statusCounts: Record<string, number> = {};
                project.tasks.forEach((t) => {
                    const s = t.status ?? "UNKNOWN";
                    statusCounts[s] = (statusCounts[s] || 0) + 1;
                });

                return {
                    id: project.id,
                    name: project.name,
                    description: project.description,
                    memberCount: project._count.projectMembers,
                    taskStatusBreakdown: statusCounts,
                    totalTasks: project.tasks.length,
                };
            }

            case "get_tasks": {
                const args = GetTasksSchema.parse(rawInput);
                const limit = Math.min(args.limit ?? 20, 50);

                const tasks = await prisma.task.findMany({
                    where: {
                        workspaceId,
                        projectId: args.projectId,
                        status: args.status ? (args.status as any) : undefined,
                        assigneeId: args.assigneeWorkspaceMemberId
                            ? args.assigneeWorkspaceMemberId
                            : undefined,
                        isParent: true,
                    },
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        dueDate: true,
                        startDate: true,
                        ProjectMember_Task_assigneeIdToProjectMember: {
                            select: {
                                WorkspaceMember: {
                                    select: {
                                        user: { select: { name: true, surname: true } },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    take: limit,
                });

                return tasks.map((t) => ({
                    id: t.id,
                    name: t.name,
                    status: t.status,
                    dueDate: t.dueDate?.toISOString().split("T")[0] ?? null,
                    assignee:
                        t.ProjectMember_Task_assigneeIdToProjectMember?.WorkspaceMember?.user
                            ?.name ?? null,
                }));
            }

            case "get_my_tasks": {
                const args = GetMyTasksSchema.parse(rawInput);

                // Find all ProjectMember IDs for this workspace member
                const projectMembers = await prisma.projectMember.findMany({
                    where: { workspaceMemberId: memberId },
                    select: { id: true },
                });
                const pmIds = projectMembers.map((pm) => pm.id);

                const tasks = await prisma.task.findMany({
                    where: {
                        workspaceId,
                        assigneeId: { in: pmIds },
                        status: args.status
                            ? (args.status as any)
                            : { notIn: ["COMPLETED", "CANCELLED"] },
                        isParent: true,
                    },
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        dueDate: true,
                        project: { select: { name: true } },
                    },
                    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
                    take: 30,
                });

                return tasks.map((t) => ({
                    id: t.id,
                    name: t.name,
                    status: t.status,
                    project: t.project.name,
                    dueDate: t.dueDate?.toISOString().split("T")[0] ?? null,
                }));
            }

            case "get_overdue_tasks": {
                const args = GetOverdueTasksSchema.parse(rawInput);
                const limit = Math.min(args.limit ?? 20, 50);
                const now = new Date();
                now.setHours(0, 0, 0, 0);

                const tasks = await prisma.task.findMany({
                    where: {
                        workspaceId,
                        dueDate: { lt: now },
                        status: { notIn: ["COMPLETED", "CANCELLED"] },
                        isParent: true,
                    },
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        dueDate: true,
                        project: { select: { name: true } },
                        ProjectMember_Task_assigneeIdToProjectMember: {
                            select: {
                                WorkspaceMember: {
                                    select: {
                                        user: { select: { name: true, surname: true } },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { dueDate: "asc" },
                    take: limit,
                });

                return tasks.map((t) => ({
                    id: t.id,
                    name: t.name,
                    status: t.status,
                    project: t.project.name,
                    dueDate: t.dueDate?.toISOString().split("T")[0] ?? null,
                    assignee:
                        t.ProjectMember_Task_assigneeIdToProjectMember?.WorkspaceMember?.user
                            ?.name ?? null,
                }));
            }

            case "get_upcoming_tasks": {
                const args = GetUpcomingTasksSchema.parse(rawInput);
                const days = Math.min(args.days ?? 7, 30);
                const limit = Math.min(args.limit ?? 20, 50);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

                const tasks = await prisma.task.findMany({
                    where: {
                        workspaceId,
                        dueDate: { gte: now, lte: future },
                        status: { notIn: ["COMPLETED", "CANCELLED"] },
                        isParent: true,
                    },
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        dueDate: true,
                        project: { select: { name: true } },
                        ProjectMember_Task_assigneeIdToProjectMember: {
                            select: {
                                WorkspaceMember: {
                                    select: {
                                        user: { select: { name: true, surname: true } },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { dueDate: "asc" },
                    take: limit,
                });

                return tasks.map((t) => ({
                    id: t.id,
                    name: t.name,
                    status: t.status,
                    project: t.project.name,
                    dueDate: t.dueDate?.toISOString().split("T")[0] ?? null,
                    assignee:
                        t.ProjectMember_Task_assigneeIdToProjectMember?.WorkspaceMember?.user
                            ?.name ?? null,
                }));
            }

            case "get_workspace_members": {
                const args = GetWorkspaceMembersSchema.parse(rawInput);
                const members = await prisma.workspaceMember.findMany({
                    where: {
                        workspaceId,
                        workspaceRole: args.role ? (args.role as any) : undefined,
                    },
                    select: {
                        id: true,
                        workspaceRole: true,
                        designation: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                surname: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                });

                return members.map((m) => ({
                    id: m.id,
                    name: m.user.name,
                    surname: m.user.surname,
                    email: m.user.email,
                    role: m.workspaceRole,
                    designation: m.designation,
                }));
            }

            case "get_attendance": {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const attendance = await prisma.attendance.findMany({
                    where: { workspaceId, date: today },
                    select: {
                        status: true,
                        checkIn: true,
                        checkOut: true,
                        workspaceMember: {
                            select: {
                                user: { select: { name: true, surname: true } },
                            },
                        },
                    },
                });

                const summary: Record<string, number> = {};
                const records = attendance.map((a) => {
                    summary[a.status] = (summary[a.status] || 0) + 1;
                    return {
                        name: a.workspaceMember.user.name,
                        status: a.status,
                        checkIn: a.checkIn?.toISOString() ?? null,
                        checkOut: a.checkOut?.toISOString() ?? null,
                    };
                });

                return { date: today.toISOString().split("T")[0], summary, records };
            }

            case "get_leave_requests": {
                const args = GetLeaveRequestsSchema.parse(rawInput);
                const limit = args.limit ?? 20;

                const requests = await prisma.leave_request.findMany({
                    where: {
                        workspaceId,
                        status: args.status ? (args.status as any) : undefined,
                    },
                    select: {
                        id: true,
                        type: true,
                        status: true,
                        startDate: true,
                        endDate: true,
                        reason: true,
                        WorkspaceMember: {
                            select: {
                                user: { select: { name: true, surname: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    take: limit,
                });

                return requests.map((r) => ({
                    id: r.id,
                    member: r.WorkspaceMember.user.name,
                    type: r.type,
                    status: r.status,
                    startDate: r.startDate.toISOString().split("T")[0],
                    endDate: r.endDate.toISOString().split("T")[0],
                    reason: r.reason,
                }));
            }

            case "get_daily_reports": {
                const args = GetDailyReportsSchema.parse(rawInput);
                const limit = args.limit ?? 20;

                const reports = await prisma.dailyReport.findMany({
                    where: { workspaceId },
                    select: {
                        id: true,
                        date: true,
                        status: true,
                        submittedAt: true,
                        user: { select: { name: true, surname: true } },
                    },
                    orderBy: { date: "desc" },
                    take: limit,
                });

                return reports.map((r) => ({
                    id: r.id,
                    member: r.user.name,
                    date: r.date.toISOString().split("T")[0],
                    status: r.status,
                    submittedAt: r.submittedAt?.toISOString() ?? null,
                }));
            }

            case "get_indents": {
                const args = GetIndentsSchema.parse(rawInput);
                const limit = args.limit ?? 20;

                const indents = await prisma.indent.findMany({
                    where: {
                        workspaceId,
                        status: args.status ? (args.status as any) : undefined,
                    },
                    select: {
                        id: true,
                        indentId: true,
                        name: true,
                        status: true,
                        createdAt: true,
                        expectedDelivery: true,
                        Project: { select: { name: true } },
                        WorkspaceMember_indent_requestedByIdToWorkspaceMember: {
                            select: {
                                user: { select: { name: true, surname: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    take: limit,
                });

                return indents.map((i) => ({
                    id: i.id,
                    indentId: i.indentId,
                    name: i.name,
                    status: i.status,
                    project: i.Project.name,
                    requestedBy:
                        i.WorkspaceMember_indent_requestedByIdToWorkspaceMember.user.name,
                    expectedDelivery:
                        i.expectedDelivery?.toISOString().split("T")[0] ?? null,
                    createdAt: i.createdAt.toISOString().split("T")[0],
                }));
            }

            case "get_materials": {
                const args = GetMaterialsSchema.parse(rawInput);
                const limit = args.limit ?? 30;

                const materials = await prisma.material_catalog.findMany({
                    where: { workspaceId },
                    select: {
                        id: true,
                        name: true,
                        unit: true,
                        source: true,
                    },
                    orderBy: { name: "asc" },
                    take: limit,
                });

                return materials;
            }

            case "get_vendors": {
                const vendors = await prisma.vendor.findMany({
                    where: { workspaceId, status: "ACTIVE" },
                    select: {
                        id: true,
                        name: true,
                        companyName: true,
                        contactPerson: true,
                        email: true,
                        phoneNumber: true,
                        city: true,
                        state: true,
                        status: true,
                    },
                    orderBy: { name: "asc" },
                });

                return vendors;
            }

            default:
                return { error: `Unknown tool: ${toolName}` };
        }
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            return { error: `Invalid tool arguments: ${err.message}` };
        }
        console.error(`[Travis] Tool '${toolName}' error:`, err?.message);
        return { error: `Tool execution failed: ${err?.message ?? "unknown error"}` };
    }
}

// ---------------------------------------------------------------------------
// Conversation history type
// ---------------------------------------------------------------------------
export interface TravisMessage {
    role: "user" | "assistant";
    content: string;
}

// ---------------------------------------------------------------------------
// Main chat function
// ---------------------------------------------------------------------------
export class TravisService {
    private static readonly MAX_TOOL_ROUNDS = 5;
    private static readonly TIMEOUT_MS = 30_000;

    static async chat(
        workspaceId: string,
        userId: string,
        message: string,
        history: TravisMessage[] = []
    ): Promise<string> {
        // Verify workspace membership upfront
        const membership = await prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
            select: { id: true },
        });
        if (!membership) {
            return "I'm sorry, but you don't appear to be a member of this workspace.";
        }

        // Build message history for the API call
        const messages: Anthropic.MessageParam[] = [
            ...history.map((h) => ({
                role: h.role,
                content: h.content,
            })),
            { role: "user" as const, content: message },
        ];

        let rounds = 0;

        const runWithTimeout = <T>(promise: Promise<T>): Promise<T> =>
            Promise.race([
                promise,
                new Promise<T>((_, reject) =>
                    setTimeout(
                        () => reject(new Error("TIMEOUT")),
                        TravisService.TIMEOUT_MS
                    )
                ),
            ]);

        while (rounds < TravisService.MAX_TOOL_ROUNDS) {
            rounds++;

            const response = await runWithTimeout(
                client.messages.create({
                    model: MODEL,
                    max_tokens: 1024,
                    system: SYSTEM_PROMPT,
                    tools: TOOLS,
                    messages,
                })
            );

            // If Claude decided to stop and give a final answer
            if (response.stop_reason === "end_turn") {
                const textBlock = response.content.find((b) => b.type === "text");
                return textBlock ? (textBlock as Anthropic.TextBlock).text : "No response generated.";
            }

            // If Claude wants to use tools
            if (response.stop_reason === "tool_use") {
                // Add Claude's response (which contains tool_use blocks) to history
                messages.push({ role: "assistant", content: response.content });

                // Execute all tool calls in parallel
                const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
                    response.content
                        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
                        .map(async (toolUse) => {
                            const result = await executeTool(
                                toolUse.name,
                                toolUse.input,
                                workspaceId,
                                userId
                            );
                            return {
                                type: "tool_result" as const,
                                tool_use_id: toolUse.id,
                                content: JSON.stringify(result),
                            };
                        })
                );

                // Add tool results to the conversation
                messages.push({ role: "user", content: toolResults });
                continue;
            }

            // Unexpected stop reason — extract whatever text is available
            const textBlock = response.content.find((b) => b.type === "text");
            return textBlock
                ? (textBlock as Anthropic.TextBlock).text
                : "I was unable to generate a response.";
        }

        // Exceeded max rounds — ask Claude to synthesize what it has
        const finalResp = await runWithTimeout(
            client.messages.create({
                model: MODEL,
                max_tokens: 512,
                system: SYSTEM_PROMPT,
                messages,
            })
        );
        const textBlock = finalResp.content.find((b) => b.type === "text");
        return textBlock
            ? (textBlock as Anthropic.TextBlock).text
            : "I reached the maximum number of reasoning steps. Please try a more specific question.";
    }
}
