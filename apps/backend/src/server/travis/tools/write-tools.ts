/**
 * Travis write tools.
 *
 * Each tool produces a confirmation PREVIEW (buildPreview) when the model
 * proposes it, and only mutates in EXECUTE — which runs from the confirmation
 * endpoint after the signed token, permission re-check, and idempotency guard.
 *
 * All mutations delegate to the app's existing services/actions; no business
 * logic is duplicated. Entity ids supplied by the model are always re-resolved
 * and re-scoped to the caller before any write.
 */
import { randomUUID } from "crypto";
import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { z } from "zod";
import { IndentStatus, LineItemStatus, LeaveType } from "@prisma/client";
import prisma from "@/lib/db";
import { getUserPermissions } from "@/data/user/get-user-permissions";
import { TasksService } from "@/server/services/tasks.service";
import { LeaveService } from "@/server/services/leave.service";
import { submitDailyReport } from "@/actions/daily-report-actions";
import type { TravisContext } from "../context";
import type { EntityRef } from "../contract";
import { defineTool, Policies, type ToolDefinition, type ToolResult } from "./types";

const TASK_STATUSES = ["TO_DO", "IN_PROGRESS", "REVIEW", "HOLD", "COMPLETED", "CANCELLED"] as const;
const IsoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format")
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Invalid date");

const taskRoute = (id: string) => `task/${id}`;

// ---------------------------------------------------------------------------
// Shared scope/permission helpers (re-checked at preview AND execute time)
// ---------------------------------------------------------------------------

function projectInScope(ctx: TravisContext, projectId: string): boolean {
    return ctx.canSeeAllProjects || ctx.accessibleProjectIds.includes(projectId);
}

async function loadAccessibleTask(ctx: TravisContext, taskId: string) {
    const task = await prisma.task.findFirst({
        where: { id: taskId, workspaceId: ctx.workspaceId },
        select: { id: true, name: true, projectId: true, status: true },
    });
    if (!task) return { error: "Task not found." as const };
    if (!projectInScope(ctx, task.projectId)) {
        return { error: "You don't have access to that task." as const };
    }
    return { task };
}

async function resolveProjectMember(
    ctx: TravisContext,
    projectId: string,
    workspaceMemberId: string
) {
    const member = await prisma.projectMember.findFirst({
        where: {
            projectId,
            workspaceMemberId,
            hasAccess: true,
            project: { workspaceId: ctx.workspaceId },
        },
        select: {
            WorkspaceMember: {
                select: {
                    userId: true,
                    user: { select: { name: true, surname: true } },
                },
            },
        },
    });
    if (!member) return null;
    return {
        userId: member.WorkspaceMember.userId,
        name:
            member.WorkspaceMember.user.surname ||
            member.WorkspaceMember.user.name ||
            "Member",
    };
}

function denied(reason: string): ToolResult {
    return { ok: false, error: reason };
}

// ---------------------------------------------------------------------------
// create_task
// ---------------------------------------------------------------------------

const CreateTaskArgs = z.object({
    projectId: z.string().min(1),
    name: z.string().min(1).max(300),
    description: z.string().max(4000).optional(),
    assigneeWorkspaceMemberId: z.string().optional(),
    dueDate: IsoDate.optional(),
    startDate: IsoDate.optional(),
    status: z.enum(TASK_STATUSES).optional(),
});

const createTask = defineTool({
    name: "create_task",
    description:
        "Create a new task in a project. Requires manager/admin rights. Always produces a confirmation preview; never creates immediately.",
    access: "write",
    timeoutMs: 12000,
    policy: Policies.canManageTasks,
    auditAction: "TASK_CREATED",
    argsSchema: CreateTaskArgs,
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            projectId: { type: SchemaType.STRING, description: "Target project id" },
            name: { type: SchemaType.STRING, description: "Task title" },
            description: { type: SchemaType.STRING, description: "Optional details" },
            assigneeWorkspaceMemberId: {
                type: SchemaType.STRING,
                description: "Optional assignee workspace member id (resolve names via get_workspace_members)",
            },
            dueDate: { type: SchemaType.STRING, description: "Optional ISO date (YYYY-MM-DD)" },
            startDate: { type: SchemaType.STRING, description: "Optional ISO date (YYYY-MM-DD)" },
            status: { type: SchemaType.STRING, description: "Optional initial status" },
        },
        required: ["projectId", "name"],
    },
    async buildPreview(args, ctx) {
        if (!projectInScope(ctx, args.projectId)) {
            throw new Error("You don't have access to that project.");
        }
        const project = await prisma.project.findFirst({
            where: { id: args.projectId, workspaceId: ctx.workspaceId },
            select: { name: true },
        });
        if (!project) throw new Error("Project not found.");
        let assigneeName: string | undefined;
        if (args.assigneeWorkspaceMemberId) {
            const m = await resolveProjectMember(
                ctx,
                args.projectId,
                args.assigneeWorkspaceMemberId
            );
            if (!m) throw new Error("Assignee does not have access to this project.");
            assigneeName = m.name;
        }
        const fields = [
            { label: "Project", value: project.name },
            { label: "Task", value: args.name },
        ];
        if (assigneeName) fields.push({ label: "Assignee", value: assigneeName });
        if (args.dueDate) fields.push({ label: "Due", value: args.dueDate });
        if (args.status) fields.push({ label: "Status", value: args.status });
        if (args.description) fields.push({ label: "Description", value: args.description });
        return { title: "Create task", summary: `Create “${args.name}” in ${project.name}`, fields };
    },
    async execute(args, ctx) {
        if (!projectInScope(ctx, args.projectId)) return denied("You don't have access to that project.");
        let assigneeUserId: string | null = null;
        if (args.assigneeWorkspaceMemberId) {
            const m = await resolveProjectMember(
                ctx,
                args.projectId,
                args.assigneeWorkspaceMemberId
            );
            if (!m) return denied("Assignee does not have access to this project.");
            assigneeUserId = m.userId;
        }
        const permissions = await getUserPermissions(ctx.workspaceId, args.projectId, ctx.userId);
        const task = await TasksService.createTask({
            name: args.name,
            projectId: args.projectId,
            workspaceId: ctx.workspaceId,
            userId: ctx.userId,
            permissions,
            description: args.description ?? null,
            assigneeUserId,
            startDate: args.startDate ?? null,
            dueDate: args.dueDate ?? null,
            status: args.status ?? null,
        });
        const entity: EntityRef = {
            type: "task",
            id: task.id,
            label: task.name,
            route: taskRoute(task.id),
        };
        return {
            ok: true,
            data: { id: task.id, name: task.name },
            entities: [entity],
            navigation: { route: taskRoute(task.id), entity },
            summary: `Created “${task.name}”`,
        };
    },
});

// ---------------------------------------------------------------------------
// update_task / change_task_status / assign_task (all via TasksService.updateTask)
// ---------------------------------------------------------------------------

async function runTaskUpdate(
    ctx: TravisContext,
    taskId: string,
    projectId: string,
    data: Record<string, unknown>,
    summary: string
): Promise<ToolResult> {
    const permissions = await getUserPermissions(ctx.workspaceId, projectId, ctx.userId);
    const updated = await TasksService.updateTask({
        taskId,
        workspaceId: ctx.workspaceId,
        projectId,
        userId: ctx.userId,
        permissions,
        data: data as any,
    });
    const entity: EntityRef = {
        type: "task",
        id: updated.id,
        label: (updated as any).name ?? "Task",
        route: taskRoute(updated.id),
    };
    return {
        ok: true,
        data: { id: updated.id },
        entities: [entity],
        navigation: { route: taskRoute(updated.id), entity },
        summary,
    };
}

const updateTask = defineTool({
    name: "update_task",
    description:
        "Update a task's name, description, or due date. Always previews before applying.",
    access: "write",
    timeoutMs: 12000,
    policy: Policies.member,
    auditAction: "TASK_UPDATED",
    argsSchema: z.object({
        taskId: z.string().min(1),
        name: z.string().min(1).max(300).optional(),
        description: z.string().max(4000).optional(),
        dueDate: IsoDate.optional(),
    }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            taskId: { type: SchemaType.STRING, description: "Task id" },
            name: { type: SchemaType.STRING, description: "New title" },
            description: { type: SchemaType.STRING, description: "New description" },
            dueDate: { type: SchemaType.STRING, description: "New due date (YYYY-MM-DD)" },
        },
        required: ["taskId"],
    },
    async buildPreview(args, ctx) {
        const { task, error } = await loadAccessibleTask(ctx, args.taskId);
        if (error) throw new Error(error);
        const fields = [{ label: "Task", value: task!.name }];
        if (args.name) fields.push({ label: "New name", value: args.name });
        if (args.dueDate) fields.push({ label: "New due", value: args.dueDate });
        if (args.description) fields.push({ label: "New description", value: args.description });
        if (fields.length === 1) throw new Error("Nothing to update was provided.");
        return { title: "Update task", summary: `Update “${task!.name}”`, fields };
    },
    async execute(args, ctx) {
        const { task, error } = await loadAccessibleTask(ctx, args.taskId);
        if (error) return denied(error);
        const data: Record<string, unknown> = {};
        if (args.name) data.name = args.name;
        if (args.description !== undefined) data.description = args.description;
        if (args.dueDate !== undefined) data.dueDate = args.dueDate;
        return runTaskUpdate(ctx, task!.id, task!.projectId, data, `Updated “${task!.name}”`);
    },
});

const changeTaskStatus = defineTool({
    name: "change_task_status",
    description: "Change a task's status. Always previews before applying.",
    access: "write",
    timeoutMs: 12000,
    policy: Policies.member,
    auditAction: "TASK_UPDATED",
    argsSchema: z.object({ taskId: z.string().min(1), status: z.enum(TASK_STATUSES) }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            taskId: { type: SchemaType.STRING, description: "Task id" },
            status: {
                type: SchemaType.STRING,
                description: "TO_DO | IN_PROGRESS | REVIEW | HOLD | COMPLETED | CANCELLED",
            },
        },
        required: ["taskId", "status"],
    },
    async buildPreview(args, ctx) {
        const { task, error } = await loadAccessibleTask(ctx, args.taskId);
        if (error) throw new Error(error);
        const destructive = args.status === "CANCELLED";
        return {
            title: "Change task status",
            summary: `Set “${task!.name}” to ${args.status}`,
            fields: [
                { label: "Task", value: task!.name },
                { label: "From", value: task!.status ?? "—" },
                { label: "To", value: args.status },
            ],
            destructive,
            affectedEntity: destructive
                ? { type: "task", id: task!.id, label: task!.name, route: taskRoute(task!.id) }
                : undefined,
        };
    },
    async execute(args, ctx) {
        const { task, error } = await loadAccessibleTask(ctx, args.taskId);
        if (error) return denied(error);
        return runTaskUpdate(
            ctx,
            task!.id,
            task!.projectId,
            { status: args.status },
            `Status → ${args.status}`
        );
    },
});

const assignTask = defineTool({
    name: "assign_task",
    description: "Assign a task to a workspace member. Always previews before applying.",
    access: "write",
    timeoutMs: 12000,
    policy: Policies.member,
    auditAction: "TASK_UPDATED",
    argsSchema: z.object({
        taskId: z.string().min(1),
        assigneeWorkspaceMemberId: z.string().min(1),
    }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            taskId: { type: SchemaType.STRING, description: "Task id" },
            assigneeWorkspaceMemberId: {
                type: SchemaType.STRING,
                description: "Assignee workspace member id (resolve names via get_workspace_members)",
            },
        },
        required: ["taskId", "assigneeWorkspaceMemberId"],
    },
    async buildPreview(args, ctx) {
        const { task, error } = await loadAccessibleTask(ctx, args.taskId);
        if (error) throw new Error(error);
        const m = await resolveProjectMember(
            ctx,
            task!.projectId,
            args.assigneeWorkspaceMemberId
        );
        if (!m) throw new Error("Assignee does not have access to this project.");
        return {
            title: "Assign task",
            summary: `Assign “${task!.name}” to ${m.name}`,
            fields: [
                { label: "Task", value: task!.name },
                { label: "Assignee", value: m.name },
            ],
        };
    },
    async execute(args, ctx) {
        const { task, error } = await loadAccessibleTask(ctx, args.taskId);
        if (error) return denied(error);
        const m = await resolveProjectMember(
            ctx,
            task!.projectId,
            args.assigneeWorkspaceMemberId
        );
        if (!m) return denied("Assignee does not have access to this project.");
        return runTaskUpdate(
            ctx,
            task!.id,
            task!.projectId,
            { assigneeUserId: m.userId },
            `Assigned to ${m.name}`
        );
    },
});

// ---------------------------------------------------------------------------
// create_subtask
// ---------------------------------------------------------------------------

const createSubtask = defineTool({
    name: "create_subtask",
    description: "Create a subtask under an existing parent task. Always previews first.",
    access: "write",
    timeoutMs: 12000,
    policy: Policies.canManageTasks,
    auditAction: "SUBTASK_CREATED",
    argsSchema: z.object({
        parentTaskId: z.string().min(1),
        name: z.string().min(1).max(300),
        description: z.string().max(4000).optional(),
        assigneeWorkspaceMemberId: z.string().optional(),
        dueDate: IsoDate.optional(),
        status: z.enum(TASK_STATUSES).optional(),
    }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            parentTaskId: { type: SchemaType.STRING, description: "Parent task id" },
            name: { type: SchemaType.STRING, description: "Subtask title" },
            description: { type: SchemaType.STRING, description: "Optional details" },
            assigneeWorkspaceMemberId: { type: SchemaType.STRING, description: "Optional assignee member id" },
            dueDate: { type: SchemaType.STRING, description: "Optional due date (YYYY-MM-DD)" },
            status: { type: SchemaType.STRING, description: "Optional status" },
        },
        required: ["parentTaskId", "name"],
    },
    async buildPreview(args, ctx) {
        const { task, error } = await loadAccessibleTask(ctx, args.parentTaskId);
        if (error) throw new Error(error);
        let assigneeName: string | undefined;
        if (args.assigneeWorkspaceMemberId) {
            const m = await resolveProjectMember(
                ctx,
                task!.projectId,
                args.assigneeWorkspaceMemberId
            );
            if (!m) throw new Error("Assignee does not have access to this project.");
            assigneeName = m.name;
        }
        const fields = [
            { label: "Parent task", value: task!.name },
            { label: "Subtask", value: args.name },
        ];
        if (assigneeName) fields.push({ label: "Assignee", value: assigneeName });
        if (args.dueDate) fields.push({ label: "Due", value: args.dueDate });
        return { title: "Create subtask", summary: `Add subtask to “${task!.name}”`, fields };
    },
    async execute(args, ctx) {
        const { task, error } = await loadAccessibleTask(ctx, args.parentTaskId);
        if (error) return denied(error);
        let assigneeUserId: string | null = null;
        if (args.assigneeWorkspaceMemberId) {
            const m = await resolveProjectMember(
                ctx,
                task!.projectId,
                args.assigneeWorkspaceMemberId
            );
            if (!m) return denied("Assignee does not have access to this project.");
            assigneeUserId = m.userId;
        }
        const permissions = await getUserPermissions(ctx.workspaceId, task!.projectId, ctx.userId);
        const sub = await TasksService.createSubTask({
            name: args.name,
            description: args.description,
            projectId: task!.projectId,
            workspaceId: ctx.workspaceId,
            parentTaskId: task!.id,
            userId: ctx.userId,
            permissions,
            assigneeUserId,
            dueDate: args.dueDate ?? null,
            status: args.status ?? "TO_DO",
        });
        const entity: EntityRef = {
            type: "subtask",
            id: (sub as any).id,
            label: args.name,
            route: taskRoute(task!.id),
        };
        return {
            ok: true,
            data: { id: (sub as any).id },
            entities: [entity],
            navigation: { route: taskRoute(task!.id), entity },
            summary: `Created subtask “${args.name}”`,
        };
    },
});

// ---------------------------------------------------------------------------
// leave request
// ---------------------------------------------------------------------------

const LeaveArgs = z.object({
    type: z.enum(["CASUAL", "SICK"]),
    startDate: IsoDate,
    endDate: IsoDate,
    reason: z.string().min(1).max(1000),
});

function buildLeavePreview(title: string) {
    return async (args: z.infer<typeof LeaveArgs>): Promise<{ title: string; summary: string; fields: { label: string; value: string }[] }> => {
        if (Number.isNaN(Date.parse(args.startDate)) || Number.isNaN(Date.parse(args.endDate))) {
            throw new Error("Invalid leave dates.");
        }
        if (new Date(args.endDate) < new Date(args.startDate)) {
            throw new Error("End date cannot be before start date.");
        }
        return {
            title,
            summary: `${args.type} leave ${args.startDate} → ${args.endDate}`,
            fields: [
                { label: "Type", value: args.type },
                { label: "From", value: args.startDate },
                { label: "To", value: args.endDate },
                { label: "Reason", value: args.reason },
            ],
        };
    };
}

async function executeLeave(args: z.infer<typeof LeaveArgs>, ctx: TravisContext): Promise<ToolResult> {
    const leave = await LeaveService.submitLeaveRequest({
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        startDate: new Date(args.startDate),
        endDate: new Date(args.endDate),
        reason: args.reason,
        type: args.type as LeaveType,
    });
    const entity: EntityRef = {
        type: "leave",
        id: leave.id,
        label: `${args.type} leave`,
        sublabel: `${args.startDate} → ${args.endDate}`,
        status: "PENDING",
        route: `leave/${leave.id}`,
    };
    return {
        ok: true,
        data: { id: leave.id, status: "PENDING" },
        entities: [entity],
        navigation: { route: `leave/${leave.id}`, entity },
        summary: "Leave request submitted",
    };
}

const leaveParams: FunctionDeclaration["parameters"] = {
    type: SchemaType.OBJECT,
    properties: {
        type: { type: SchemaType.STRING, description: "CASUAL | SICK" },
        startDate: { type: SchemaType.STRING, description: "Start date (YYYY-MM-DD)" },
        endDate: { type: SchemaType.STRING, description: "End date (YYYY-MM-DD)" },
        reason: { type: SchemaType.STRING, description: "Reason for leave" },
    },
    required: ["type", "startDate", "endDate", "reason"],
};

const submitLeaveRequest = defineTool({
    name: "submit_leave_request",
    description:
        "Submit a leave request for the current user. Previews before submitting; on confirm it is created as PENDING.",
    access: "write",
    timeoutMs: 12000,
    policy: Policies.member,
    auditAction: "LEAVE_REQUEST_SUBMITTED",
    argsSchema: LeaveArgs,
    parameters: leaveParams,
    buildPreview: buildLeavePreview("Submit leave request"),
    execute: executeLeave,
});

// ---------------------------------------------------------------------------
// daily report
// ---------------------------------------------------------------------------

const DailyReportArgs = z.object({
    date: IsoDate.optional(),
    entries: z
        .array(z.object({ taskId: z.string().optional(), description: z.string().min(1).max(2000) }))
        .min(1)
        .max(30),
});

async function validateReportTasks(args: z.infer<typeof DailyReportArgs>, ctx: TravisContext) {
    const taskIds = args.entries
        .map((e) => e.taskId)
        .filter((id): id is string => !!id && id !== "other");
    if (taskIds.length === 0) return;
    const tasks = await prisma.task.findMany({
        where: { id: { in: taskIds }, workspaceId: ctx.workspaceId },
        select: { id: true, projectId: true },
    });
    const okIds = new Set(
        tasks.filter((t) => projectInScope(ctx, t.projectId)).map((t) => t.id)
    );
    for (const id of taskIds) {
        if (!okIds.has(id)) throw new Error("A referenced task is not accessible.");
    }
}

function buildReportPreview(title: string) {
    return async (args: z.infer<typeof DailyReportArgs>, ctx: TravisContext) => {
        await validateReportTasks(args, ctx);
        return {
            title,
            summary: `${args.entries.length} report entr${args.entries.length === 1 ? "y" : "ies"}${
                args.date ? ` for ${args.date}` : ""
            }`,
            fields: args.entries.map((e, i) => ({ label: `Entry ${i + 1}`, value: e.description })),
        };
    };
}

async function executeReport(args: z.infer<typeof DailyReportArgs>, ctx: TravisContext): Promise<ToolResult> {
    await validateReportTasks(args, ctx);
    await submitDailyReport({
        workspaceId: ctx.workspaceId,
        entries: args.entries.map((e) => ({ taskId: e.taskId ?? null, description: e.description })),
        date: args.date,
    } as any);
    return { ok: true, data: { submitted: true }, summary: "Daily report submitted" };
}

const reportParams: FunctionDeclaration["parameters"] = {
    type: SchemaType.OBJECT,
    properties: {
        date: { type: SchemaType.STRING, description: "Optional date (YYYY-MM-DD), defaults to today" },
        entries: {
            type: SchemaType.ARRAY,
            description: "Report entries",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    taskId: { type: SchemaType.STRING, description: "Optional related task id" },
                    description: { type: SchemaType.STRING, description: "What was done" },
                },
                required: ["description"],
            },
        },
    },
    required: ["entries"],
};

const submitDailyReportTool = defineTool({
    name: "submit_daily_report",
    description: "Submit today's daily report for the current user. Previews before submitting.",
    access: "write",
    timeoutMs: 12000,
    policy: Policies.member,
    auditAction: undefined,
    argsSchema: DailyReportArgs,
    parameters: reportParams,
    buildPreview: buildReportPreview("Submit daily report"),
    execute: executeReport,
});

// ---------------------------------------------------------------------------
// indents (draft = DRAFT status, submit = SUBMITTED status)
// ---------------------------------------------------------------------------

const IndentArgs = z.object({
    projectId: z.string().min(1),
    name: z.string().min(1).max(300),
    description: z.string().max(2000).optional(),
    expectedDelivery: IsoDate.optional(),
    assignedToWorkspaceMemberId: z.string().optional(),
    materials: z
        .array(
            z.object({
                materialName: z.string().min(1).max(200),
                quantity: z.number().min(0).max(1_000_000),
                unit: z.string().max(40).optional(),
            })
        )
        .max(50)
        .optional(),
});

const indentPolicy = (ctx: TravisContext): string | null =>
    ctx.isWorkspaceAdmin || ctx.isManager || ctx.isProcurement
        ? null
        : "Only managers, admins, or procurement can create indents.";

const indentParams: FunctionDeclaration["parameters"] = {
    type: SchemaType.OBJECT,
    properties: {
        projectId: { type: SchemaType.STRING, description: "Project id" },
        name: { type: SchemaType.STRING, description: "Indent name" },
        description: { type: SchemaType.STRING, description: "Optional description" },
        expectedDelivery: { type: SchemaType.STRING, description: "Optional date (YYYY-MM-DD)" },
        assignedToWorkspaceMemberId: { type: SchemaType.STRING, description: "Optional assignee member id" },
        materials: {
            type: SchemaType.ARRAY,
            description: "Optional line items",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    materialName: { type: SchemaType.STRING },
                    quantity: { type: SchemaType.NUMBER },
                    unit: { type: SchemaType.STRING },
                },
                required: ["materialName", "quantity"],
            },
        },
    },
    required: ["projectId", "name"],
};

function buildIndentPreview(title: string) {
    return async (args: z.infer<typeof IndentArgs>, ctx: TravisContext) => {
        if (!projectInScope(ctx, args.projectId)) throw new Error("You don't have access to that project.");
        const project = await prisma.project.findFirst({
            where: { id: args.projectId, workspaceId: ctx.workspaceId },
            select: { name: true },
        });
        if (!project) throw new Error("Project not found.");
        const fields = [
            { label: "Project", value: project.name },
            { label: "Indent", value: args.name },
        ];
        if (args.expectedDelivery) fields.push({ label: "Expected", value: args.expectedDelivery });
        if (args.materials?.length)
            fields.push({
                label: "Items",
                value: args.materials.map((m) => `${m.quantity} ${m.unit ?? "unit"} ${m.materialName}`).join(", "),
            });
        return { title, summary: `Indent “${args.name}” in ${project.name}`, fields };
    };
}

function executeIndent(status: IndentStatus) {
    return async (args: z.infer<typeof IndentArgs>, ctx: TravisContext): Promise<ToolResult> => {
        if (!projectInScope(ctx, args.projectId)) return denied("You don't have access to that project.");
        let assignedToId: string | null = null;
        if (args.assignedToWorkspaceMemberId) {
            const m = await prisma.workspaceMember.findFirst({
                where: { id: args.assignedToWorkspaceMemberId, workspaceId: ctx.workspaceId },
                select: { id: true },
            });
            if (!m) return denied("Assignee is not a member of this workspace.");
            assignedToId = m.id;
        }

        const last = await prisma.indent.findFirst({
            where: { workspaceId: ctx.workspaceId },
            orderBy: { createdAt: "desc" },
            select: { indentId: true },
        });
        let serial = 1;
        const match = last?.indentId?.match(/IND-(\d+)/);
        if (match) serial = parseInt(match[1], 10) + 1;
        const indentIdStr = `IND-${serial.toString().padStart(3, "0")}`;

        const created = await prisma.$transaction(async (tx) => {
            const ind = await tx.indent.create({
                data: {
                    id: randomUUID(),
                    indentId: indentIdStr,
                    workspaceId: ctx.workspaceId,
                    projectId: args.projectId,
                    name: args.name,
                    description: args.description ?? null,
                    expectedDelivery: args.expectedDelivery ? new Date(args.expectedDelivery) : null,
                    requestedById: ctx.workspaceMemberId,
                    assignedToId,
                    status,
                    submittedAt: status === IndentStatus.SUBMITTED ? new Date() : null,
                    updatedAt: new Date(),
                },
            });
            if (args.materials?.length) {
                await tx.indent_line_item.createMany({
                    data: args.materials.map((m) => ({
                        id: randomUUID(),
                        indentId: ind.id,
                        materialName: m.materialName,
                        unit: m.unit || "unit",
                        quantity: Math.trunc(m.quantity),
                        status: LineItemStatus.PENDING,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })),
                });
                for (const m of args.materials) {
                    await tx.material_catalog.upsert({
                        where: { workspaceId_name: { workspaceId: ctx.workspaceId, name: m.materialName } },
                        create: {
                            id: randomUUID(),
                            workspaceId: ctx.workspaceId,
                            name: m.materialName,
                            unit: m.unit || "unit",
                            source: "INDENT",
                            updatedAt: new Date(),
                        },
                        update: { unit: m.unit || "unit", updatedAt: new Date() },
                    });
                }
            }
            return ind;
        });

        const entity: EntityRef = {
            type: "indent",
            id: created.id,
            label: created.name,
            sublabel: indentIdStr,
            status,
            route: `indent/${created.id}`,
        };
        return {
            ok: true,
            data: { id: created.id, indentId: indentIdStr, status },
            entities: [entity],
            navigation: { route: `indent/${created.id}`, entity },
            summary: `Indent ${indentIdStr} ${status === IndentStatus.DRAFT ? "drafted" : "submitted"}`,
        };
    };
}

const submitIndentTool = defineTool({
    name: "submit_indent",
    description: "Create and submit an indent (procurement request). Previews before submitting.",
    access: "write",
    timeoutMs: 15000,
    policy: indentPolicy,
    auditAction: "TASK_CREATED",
    argsSchema: IndentArgs,
    parameters: indentParams,
    buildPreview: buildIndentPreview("Submit indent"),
    execute: executeIndent(IndentStatus.SUBMITTED),
});

const draftIndentTool = defineTool({
    name: "draft_indent",
    description: "Create an indent as a DRAFT for later submission. Previews before saving.",
    access: "write",
    timeoutMs: 15000,
    policy: indentPolicy,
    auditAction: "TASK_CREATED",
    argsSchema: IndentArgs,
    parameters: indentParams,
    buildPreview: buildIndentPreview("Save indent draft"),
    execute: executeIndent(IndentStatus.DRAFT),
});

export const WRITE_TOOLS: ToolDefinition<any>[] = [
    createTask,
    updateTask,
    changeTaskStatus,
    assignTask,
    createSubtask,
    submitLeaveRequest,
    submitDailyReportTool,
    submitIndentTool,
    draftIndentTool,
];
