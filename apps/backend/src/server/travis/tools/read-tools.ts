/**
 * Travis read tools — all workspace-scoped AND project-scoped to the caller.
 *
 * Non-admins only ever see data inside their accessible project set. Leave data
 * follows the app's admin-only rule (non-admins see only their own).
 */
import { SchemaType } from "@google/generative-ai";
import { z } from "zod";
import prisma from "@/lib/db";
import type { TravisContext } from "../context";
import { formatDateInTz, projectScopeFilter } from "../context";
import type { EntityRef } from "../contract";
import { defineTool, Policies, type ToolDefinition } from "./types";

// Route builders for entity deep-links the mobile app understands.
const routes = {
    task: (id: string) => `task/${id}`,
    project: (id: string) => `project/${id}`,
    member: (id: string) => `member/${id}`,
    leave: (id: string) => `leave/${id}`,
    indent: (id: string) => `indent/${id}`,
    dailyReport: (id: string) => `daily-report/${id}`,
};

const TASK_STATUSES = [
    "TO_DO",
    "IN_PROGRESS",
    "REVIEW",
    "HOLD",
    "COMPLETED",
    "CANCELLED",
] as const;
const IsoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format")
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date");

const fmt = (d: Date | null | undefined, ctx: TravisContext) =>
    d ? formatDateInTz(d, ctx.timezone) : null;

// Selection shared by task list tools.
const taskListSelect = {
    id: true,
    name: true,
    status: true,
    dueDate: true,
    startDate: true,
    projectId: true,
    project: { select: { name: true } },
    ProjectMember_Task_assigneeIdToProjectMember: {
        select: {
            WorkspaceMember: {
                select: { user: { select: { name: true, surname: true } } },
            },
        },
    },
} as const;

function mapTaskRow(t: any, ctx: TravisContext) {
    const assignee =
        t.ProjectMember_Task_assigneeIdToProjectMember?.WorkspaceMember?.user;
    return {
        row: {
            id: t.id,
            name: t.name,
            status: t.status,
            project: t.project?.name ?? null,
            dueDate: fmt(t.dueDate, ctx),
            assignee: assignee ? assignee.surname || assignee.name : null,
        },
        card: {
            type: "task" as const,
            id: t.id,
            label: t.name,
            sublabel: t.project?.name,
            status: t.status ?? undefined,
            route: routes.task(t.id),
        } satisfies EntityRef,
    };
}

// ---------------------------------------------------------------------------

const searchTasks = defineTool({
    name: "search_tasks",
    description:
        "Search tasks the caller can access. Filter by free-text query (matches name), project, status, assignee workspace member id, or due-date window. Results are capped.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    auditAction: undefined,
    argsSchema: z.object({
        query: z.string().max(120).optional(),
        projectId: z.string().optional(),
        status: z.enum(TASK_STATUSES).optional(),
        assigneeWorkspaceMemberId: z.string().optional(),
        dueBefore: z.string().optional(),
        dueAfter: z.string().optional(),
        limit: z.number().min(1).max(50).optional(),
    }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            query: { type: SchemaType.STRING, description: "Free text to match in the task name" },
            projectId: { type: SchemaType.STRING, description: "Restrict to a project id" },
            status: {
                type: SchemaType.STRING,
                description: "TO_DO | IN_PROGRESS | REVIEW | HOLD | COMPLETED | CANCELLED",
            },
            assigneeWorkspaceMemberId: {
                type: SchemaType.STRING,
                description: "Filter by the assignee's workspace member id",
            },
            dueBefore: { type: SchemaType.STRING, description: "ISO date upper bound for dueDate" },
            dueAfter: { type: SchemaType.STRING, description: "ISO date lower bound for dueDate" },
            limit: { type: SchemaType.NUMBER, description: "Max results (default 20, max 50)" },
        },
        required: [],
    },
    async handler(args, ctx) {
        const scope = projectScopeFilter(ctx);
        const limit = Math.min(args.limit ?? 20, 50);

        // If a specific project was requested, it must be within scope.
        if (args.projectId) {
            if (!ctx.canSeeAllProjects && !ctx.accessibleProjectIds.includes(args.projectId)) {
                return { ok: false, error: "You don't have access to that project." };
            }
        }

        // Resolve assignee filter to ProjectMember ids (assigneeId references ProjectMember).
        let assigneeProjectMemberIds: string[] | undefined;
        if (args.assigneeWorkspaceMemberId) {
            const pms = await prisma.projectMember.findMany({
                where: {
                    workspaceMemberId: args.assigneeWorkspaceMemberId,
                    hasAccess: true,
                    project: { workspaceId: ctx.workspaceId },
                    ...(ctx.canSeeAllProjects
                        ? {}
                        : { projectId: { in: ctx.accessibleProjectIds } }),
                },
                select: { id: true },
            });
            assigneeProjectMemberIds = pms.map((p) => p.id);
            if (assigneeProjectMemberIds.length === 0) {
                return { ok: true, data: { tasks: [], count: 0 }, summary: "No tasks found" };
            }
        }

        const dueDate: Record<string, Date> = {};
        if (args.dueAfter && !Number.isNaN(Date.parse(args.dueAfter)))
            dueDate.gte = new Date(args.dueAfter);
        if (args.dueBefore && !Number.isNaN(Date.parse(args.dueBefore)))
            dueDate.lte = new Date(args.dueBefore);

        const tasks = await prisma.task.findMany({
            where: {
                ...scope,
                ...(args.projectId ? { projectId: args.projectId } : {}),
                isParent: true,
                ...(args.status ? { status: args.status } : {}),
                ...(args.query ? { name: { contains: args.query, mode: "insensitive" } } : {}),
                ...(assigneeProjectMemberIds ? { assigneeId: { in: assigneeProjectMemberIds } } : {}),
                ...(Object.keys(dueDate).length ? { dueDate } : {}),
            },
            select: taskListSelect,
            orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
            take: limit,
        });

        const mapped = tasks.map((t) => mapTaskRow(t, ctx));
        return {
            ok: true,
            data: { tasks: mapped.map((m) => m.row), count: mapped.length },
            entities: mapped.map((m) => m.card),
            summary: `${mapped.length} task(s)`,
        };
    },
});

const getTaskDetails = defineTool({
    name: "get_task_details",
    description:
        "Get full details for a single task by id, including assignee, dates, status, and subtask counts. Access is verified.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({ taskId: z.string().min(1) }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: { taskId: { type: SchemaType.STRING, description: "The task id" } },
        required: ["taskId"],
    },
    async handler(args, ctx) {
        const task = await prisma.task.findFirst({
            where: { id: args.taskId, workspaceId: ctx.workspaceId },
            select: {
                ...taskListSelect,
                description: true,
                subtaskCount: true,
                completedSubtaskCount: true,
                createdAt: true,
            },
        });
        if (!task) return { ok: false, error: "Task not found." };
        if (!ctx.canSeeAllProjects && !ctx.accessibleProjectIds.includes(task.projectId)) {
            return { ok: false, error: "You don't have access to that task." };
        }
        const { row, card } = mapTaskRow(task, ctx);
        return {
            ok: true,
            data: {
                ...row,
                // Task descriptions are untrusted content — passed as data only.
                description: task.description ?? null,
                startDate: fmt(task.startDate, ctx),
                subtaskCount: task.subtaskCount,
                completedSubtaskCount: task.completedSubtaskCount,
            },
            entities: [card],
            summary: task.name,
        };
    },
});

const getProjectSummary = defineTool({
    name: "get_project_summary",
    description:
        "Summarize a single project: task counts by status, total tasks, and member count. Access is verified.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({ projectId: z.string().min(1) }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: { projectId: { type: SchemaType.STRING, description: "The project id" } },
        required: ["projectId"],
    },
    async handler(args, ctx) {
        if (!ctx.canSeeAllProjects && !ctx.accessibleProjectIds.includes(args.projectId)) {
            return { ok: false, error: "You don't have access to that project." };
        }
        const project = await prisma.project.findFirst({
            where: { id: args.projectId, workspaceId: ctx.workspaceId },
            select: {
                id: true,
                name: true,
                description: true,
                _count: { select: { projectMembers: true } },
                tasks: { where: { isParent: true }, select: { status: true } },
            },
        });
        if (!project) return { ok: false, error: "Project not found." };
        const statusCounts: Record<string, number> = {};
        for (const t of project.tasks) {
            const s = t.status ?? "UNKNOWN";
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        }
        return {
            ok: true,
            data: {
                id: project.id,
                name: project.name,
                description: project.description,
                memberCount: project._count.projectMembers,
                totalTasks: project.tasks.length,
                taskStatusBreakdown: statusCounts,
            },
            entities: [
                {
                    type: "project",
                    id: project.id,
                    label: project.name,
                    sublabel: `${project.tasks.length} tasks`,
                    route: routes.project(project.id),
                },
            ],
            summary: project.name,
        };
    },
});

const getWorkspaceSummary = defineTool({
    name: "get_workspace_summary",
    description:
        "High-level workspace summary scoped to the caller: number of accessible projects, task counts by status, and member count.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({}),
    parameters: { type: SchemaType.OBJECT, properties: {}, required: [] },
    async handler(_args, ctx) {
        const scope = projectScopeFilter(ctx);
        const [projectCount, memberCount, taskCounts] = await Promise.all([
            ctx.canSeeAllProjects
                ? prisma.project.count({ where: { workspaceId: ctx.workspaceId } })
                : Promise.resolve(ctx.accessibleProjectIds.length),
            prisma.workspaceMember.count({ where: { workspaceId: ctx.workspaceId } }),
            prisma.task.groupBy({
                by: ["status"],
                where: { ...scope, isParent: true },
                _count: { id: true },
            }),
        ]);
        const statusBreakdown: Record<string, number> = {};
        for (const r of taskCounts) {
            if (r.status) statusBreakdown[r.status] = (r._count as any).id;
        }
        return {
            ok: true,
            data: { projectCount, memberCount, taskStatusBreakdown: statusBreakdown },
            summary: `${projectCount} projects, ${memberCount} members`,
        };
    },
});

const getDeadlines = defineTool({
    name: "get_deadlines",
    description:
        "Tasks due within the next N days across the caller's accessible projects, soonest first.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({
        days: z.number().min(1).max(60).optional(),
        limit: z.number().min(1).max(50).optional(),
    }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            days: { type: SchemaType.NUMBER, description: "Days ahead (default 7, max 60)" },
            limit: { type: SchemaType.NUMBER, description: "Max results (default 20, max 50)" },
        },
        required: [],
    },
    async handler(args, ctx) {
        const scope = projectScopeFilter(ctx);
        const days = Math.min(args.days ?? 7, 60);
        const limit = Math.min(args.limit ?? 20, 50);
        const start = new Date(ctx.now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start.getTime() + days * 86_400_000);

        const tasks = await prisma.task.findMany({
            where: {
                ...scope,
                isParent: true,
                dueDate: { gte: start, lte: end },
                status: { notIn: ["COMPLETED", "CANCELLED"] },
            },
            select: taskListSelect,
            orderBy: { dueDate: "asc" },
            take: limit,
        });
        const mapped = tasks.map((t) => mapTaskRow(t, ctx));
        return {
            ok: true,
            data: { tasks: mapped.map((m) => m.row), count: mapped.length },
            entities: mapped.map((m) => m.card),
            summary: `${mapped.length} upcoming`,
        };
    },
});

const getOverdueTasks = defineTool({
    name: "get_overdue_tasks",
    description:
        "Tasks whose due date is in the past and are not completed/cancelled, across the caller's accessible projects.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({ limit: z.number().min(1).max(50).optional() }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: { limit: { type: SchemaType.NUMBER, description: "Max results (default 20, max 50)" } },
        required: [],
    },
    async handler(args, ctx) {
        const scope = projectScopeFilter(ctx);
        const limit = Math.min(args.limit ?? 20, 50);
        const start = new Date(ctx.now);
        start.setHours(0, 0, 0, 0);
        const tasks = await prisma.task.findMany({
            where: {
                ...scope,
                isParent: true,
                dueDate: { lt: start },
                status: { notIn: ["COMPLETED", "CANCELLED"] },
            },
            select: taskListSelect,
            orderBy: { dueDate: "asc" },
            take: limit,
        });
        const mapped = tasks.map((t) => mapTaskRow(t, ctx));
        return {
            ok: true,
            data: { tasks: mapped.map((m) => m.row), count: mapped.length },
            entities: mapped.map((m) => m.card),
            summary: `${mapped.length} overdue`,
        };
    },
});

const getWorkload = defineTool({
    name: "get_workload",
    description:
        "Open (not completed/cancelled) task counts per assignee across the caller's accessible projects, busiest first. Useful for spotting who is overloaded.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({ limit: z.number().min(1).max(50).optional() }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: { limit: { type: SchemaType.NUMBER, description: "Max members (default 20)" } },
        required: [],
    },
    async handler(args, ctx) {
        const scope = projectScopeFilter(ctx);
        const limit = Math.min(args.limit ?? 20, 50);
        const tasks = await prisma.task.findMany({
            where: {
                ...scope,
                isParent: true,
                status: { notIn: ["COMPLETED", "CANCELLED"] },
                assigneeId: { not: null },
            },
            select: {
                assigneeId: true,
                ProjectMember_Task_assigneeIdToProjectMember: {
                    select: {
                        WorkspaceMember: {
                            select: { id: true, user: { select: { name: true, surname: true } } },
                        },
                    },
                },
            },
        });
        const counts = new Map<string, { memberId: string; name: string; count: number }>();
        for (const t of tasks) {
            const wm = t.ProjectMember_Task_assigneeIdToProjectMember?.WorkspaceMember;
            if (!wm) continue;
            const key = wm.id;
            const name = wm.user.surname || wm.user.name || "Unknown";
            const cur = counts.get(key) ?? { memberId: key, name, count: 0 };
            cur.count += 1;
            counts.set(key, cur);
        }
        const sorted = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
        return {
            ok: true,
            data: { workload: sorted },
            entities: sorted.map((s) => ({
                type: "member" as const,
                id: s.memberId,
                label: s.name,
                sublabel: `${s.count} open tasks`,
                route: routes.member(s.memberId),
            })),
            summary: `${sorted.length} members`,
        };
    },
});

const getWorkspaceMembers = defineTool({
    name: "get_workspace_members",
    description:
        "List workspace members with their roles and ids. Use this to resolve a person's name to a workspace member id before assigning tasks.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({ query: z.string().max(80).optional() }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: { query: { type: SchemaType.STRING, description: "Filter by name (optional)" } },
        required: [],
    },
    async handler(args, ctx) {
        const members = await prisma.workspaceMember.findMany({
            where: {
                workspaceId: ctx.workspaceId,
                ...(args.query
                    ? {
                          user: {
                              OR: [
                                  { name: { contains: args.query, mode: "insensitive" } },
                                  { surname: { contains: args.query, mode: "insensitive" } },
                              ],
                          },
                      }
                    : {}),
            },
            select: {
                id: true,
                workspaceRole: true,
                designation: true,
                user: { select: { name: true, surname: true } },
            },
            orderBy: { createdAt: "asc" },
            take: 100,
        });
        return {
            ok: true,
            data: {
                members: members.map((m) => ({
                    id: m.id,
                    name: m.user.surname || m.user.name,
                    role: m.workspaceRole,
                    designation: m.designation,
                })),
            },
            entities: members.slice(0, 20).map((m) => ({
                type: "member" as const,
                id: m.id,
                label: m.user.surname || m.user.name || "Member",
                sublabel: m.workspaceRole ?? undefined,
                route: routes.member(m.id),
            })),
            summary: `${members.length} members`,
        };
    },
});

const getAttendanceSummary = defineTool({
    name: "get_attendance_summary",
    description:
        "Today's attendance. Admins and managers see a workspace-wide breakdown; other members see only their own status.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({}),
    parameters: { type: SchemaType.OBJECT, properties: {}, required: [] },
    async handler(_args, ctx) {
        const today = new Date(ctx.now);
        today.setHours(0, 0, 0, 0);
        const seesAll = ctx.isWorkspaceAdmin || ctx.isManager;
        const records = await prisma.attendance.findMany({
            where: {
                workspaceId: ctx.workspaceId,
                date: today,
                ...(seesAll ? {} : { workspaceMemberId: ctx.workspaceMemberId }),
            },
            select: {
                status: true,
                checkIn: true,
                workspaceMember: { select: { user: { select: { name: true, surname: true } } } },
            },
        });
        const summary: Record<string, number> = {};
        for (const r of records) summary[r.status] = (summary[r.status] || 0) + 1;
        return {
            ok: true,
            data: {
                date: formatDateInTz(today, ctx.timezone),
                scope: seesAll ? "workspace" : "self",
                summary,
                records: seesAll
                    ? records.map((r) => ({
                          name: r.workspaceMember.user.surname || r.workspaceMember.user.name,
                          status: r.status,
                      }))
                    : records.map((r) => ({ status: r.status })),
            },
            summary: seesAll ? "Workspace attendance" : "Your attendance",
        };
    },
});

const getLeaveSummary = defineTool({
    name: "get_leave_summary",
    description:
        "Leave requests. Admins see all workspace requests; other members see only their own. Filter by status.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({
        status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
        limit: z.number().min(1).max(50).optional(),
    }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            status: { type: SchemaType.STRING, description: "PENDING | APPROVED | REJECTED" },
            limit: { type: SchemaType.NUMBER, description: "Max results (default 20)" },
        },
        required: [],
    },
    async handler(args, ctx) {
        const limit = Math.min(args.limit ?? 20, 50);
        const requests = await prisma.leave_request.findMany({
            where: {
                workspaceId: ctx.workspaceId,
                ...(ctx.isWorkspaceAdmin ? {} : { workspaceMemberId: ctx.workspaceMemberId }),
                ...(args.status ? { status: args.status } : {}),
            },
            select: {
                id: true,
                type: true,
                status: true,
                startDate: true,
                endDate: true,
                WorkspaceMember: { select: { user: { select: { name: true, surname: true } } } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        return {
            ok: true,
            data: {
                scope: ctx.isWorkspaceAdmin ? "workspace" : "self",
                requests: requests.map((r) => ({
                    id: r.id,
                    member: r.WorkspaceMember.user.surname || r.WorkspaceMember.user.name,
                    type: r.type,
                    status: r.status,
                    startDate: fmt(r.startDate, ctx),
                    endDate: fmt(r.endDate, ctx),
                })),
            },
            entities: requests.slice(0, 20).map((r) => ({
                type: "leave" as const,
                id: r.id,
                label: `${r.type} leave`,
                sublabel: `${fmt(r.startDate, ctx)} → ${fmt(r.endDate, ctx)}`,
                status: r.status ?? undefined,
                route: routes.leave(r.id),
            })),
            summary: `${requests.length} leave request(s)`,
        };
    },
});

const getProcurementSummary = defineTool({
    name: "get_procurement_summary",
    description:
        "Indent / procurement records across the caller's accessible projects. Filter by status.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({
        status: z
            .enum(["DRAFT", "SUBMITTED", "ASSIGNED", "APPROVED", "CANCELLED"])
            .optional(),
        limit: z.number().min(1).max(50).optional(),
    }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            status: {
                type: SchemaType.STRING,
                description: "DRAFT | SUBMITTED | ASSIGNED | APPROVED | CANCELLED",
            },
            limit: { type: SchemaType.NUMBER, description: "Max results (default 20)" },
        },
        required: [],
    },
    async handler(args, ctx) {
        const limit = Math.min(args.limit ?? 20, 50);
        // Indents are tied to projects; scope to accessible projects for non-admins.
        const projectFilter =
            ctx.canSeeAllProjects || ctx.isProcurement
                ? {}
                : { projectId: { in: ctx.accessibleProjectIds } };
        const indents = await prisma.indent.findMany({
            where: {
                workspaceId: ctx.workspaceId,
                ...projectFilter,
                ...(args.status ? { status: args.status } : {}),
            },
            select: {
                id: true,
                indentId: true,
                name: true,
                status: true,
                expectedDelivery: true,
                Project: { select: { name: true } },
                WorkspaceMember_indent_requestedByIdToWorkspaceMember: {
                    select: { user: { select: { name: true, surname: true } } },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        return {
            ok: true,
            data: {
                indents: indents.map((i) => ({
                    id: i.id,
                    indentId: i.indentId,
                    name: i.name,
                    status: i.status,
                    project: i.Project?.name ?? null,
                    requestedBy:
                        i.WorkspaceMember_indent_requestedByIdToWorkspaceMember?.user?.surname ||
                        i.WorkspaceMember_indent_requestedByIdToWorkspaceMember?.user?.name ||
                        null,
                    expectedDelivery: fmt(i.expectedDelivery, ctx),
                })),
            },
            entities: indents.slice(0, 20).map((i) => ({
                type: "indent" as const,
                id: i.id,
                label: i.name || i.indentId || "Indent",
                sublabel: i.Project?.name,
                status: i.status ?? undefined,
                route: routes.indent(i.id),
            })),
            summary: `${indents.length} indent(s)`,
        };
    },
});

const getDailyReportSummary = defineTool({
    name: "get_daily_report_summary",
    description:
        "Recent daily reports. Admins/managers see the team's reports; other members see their own.",
    access: "read",
    timeoutMs: 8000,
    policy: Policies.member,
    argsSchema: z.object({ limit: z.number().min(1).max(50).optional() }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: { limit: { type: SchemaType.NUMBER, description: "Max results (default 20)" } },
        required: [],
    },
    async handler(args, ctx) {
        const limit = Math.min(args.limit ?? 20, 50);
        const seesAll = ctx.isWorkspaceAdmin || ctx.isManager;
        const reports = await prisma.dailyReport.findMany({
            where: {
                workspaceId: ctx.workspaceId,
                ...(seesAll ? {} : { userId: ctx.userId }),
            },
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
        return {
            ok: true,
            data: {
                scope: seesAll ? "team" : "self",
                reports: reports.map((r) => ({
                    id: r.id,
                    member: r.user.surname || r.user.name,
                    date: fmt(r.date, ctx),
                    status: r.status,
                    submitted: !!r.submittedAt,
                })),
            },
            entities: reports.slice(0, 20).map((r) => ({
                type: "daily_report" as const,
                id: r.id,
                label: `Report ${fmt(r.date, ctx)}`,
                sublabel: r.user.surname || r.user.name || undefined,
                status: r.status ?? undefined,
                route: routes.dailyReport(r.id),
            })),
            summary: `${reports.length} report(s)`,
        };
    },
});

const draftLeaveRequest = defineTool({
    name: "draft_leave_request",
    description:
        "Prepare a leave-request draft for the current user without saving or submitting anything.",
    access: "read",
    timeoutMs: 3000,
    policy: Policies.member,
    argsSchema: z
        .object({
            type: z.enum(["CASUAL", "SICK"]),
            startDate: IsoDate,
            endDate: IsoDate,
            reason: z.string().min(1).max(1000),
        })
        .refine(
            (args) => new Date(args.endDate) >= new Date(args.startDate),
            "End date cannot be before start date"
        ),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            type: { type: SchemaType.STRING, description: "CASUAL | SICK" },
            startDate: { type: SchemaType.STRING, description: "Start date (YYYY-MM-DD)" },
            endDate: { type: SchemaType.STRING, description: "End date (YYYY-MM-DD)" },
            reason: { type: SchemaType.STRING, description: "Reason for leave" },
        },
        required: ["type", "startDate", "endDate", "reason"],
    },
    async handler(args) {
        return {
            ok: true,
            data: {
                draft: {
                    type: args.type,
                    startDate: args.startDate,
                    endDate: args.endDate,
                    reason: args.reason,
                },
                saved: false,
                submitted: false,
            },
            summary: "Leave draft prepared",
        };
    },
});

const draftDailyReport = defineTool({
    name: "draft_daily_report",
    description:
        "Prepare a daily-report draft without saving or submitting anything.",
    access: "read",
    timeoutMs: 5000,
    policy: Policies.member,
    argsSchema: z.object({
        date: IsoDate.optional(),
        entries: z
            .array(
                z.object({
                    taskId: z.string().optional(),
                    description: z.string().min(1).max(2000),
                })
            )
            .min(1)
            .max(30),
    }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            date: { type: SchemaType.STRING, description: "Optional date (YYYY-MM-DD)" },
            entries: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        taskId: { type: SchemaType.STRING },
                        description: { type: SchemaType.STRING },
                    },
                    required: ["description"],
                },
            },
        },
        required: ["entries"],
    },
    async handler(args, ctx) {
        const taskIds = args.entries
            .map((entry) => entry.taskId)
            .filter((id): id is string => !!id && id !== "other");
        if (taskIds.length) {
            const tasks = await prisma.task.findMany({
                where: {
                    id: { in: taskIds },
                    ...projectScopeFilter(ctx),
                },
                select: { id: true },
            });
            const accessibleIds = new Set(tasks.map((task) => task.id));
            if (taskIds.some((id) => !accessibleIds.has(id))) {
                return { ok: false, error: "A referenced task is not accessible." };
            }
        }
        return {
            ok: true,
            data: {
                draft: { date: args.date ?? fmt(ctx.now, ctx), entries: args.entries },
                saved: false,
                submitted: false,
            },
            summary: "Daily report draft prepared",
        };
    },
});

export const READ_TOOLS: ToolDefinition<any>[] = [
    searchTasks,
    getTaskDetails,
    getProjectSummary,
    getWorkspaceSummary,
    getDeadlines,
    getOverdueTasks,
    getWorkload,
    getWorkspaceMembers,
    getAttendanceSummary,
    getLeaveSummary,
    getProcurementSummary,
    getDailyReportSummary,
    draftLeaveRequest,
    draftDailyReport,
];
