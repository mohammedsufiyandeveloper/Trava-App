/**
 * navigate_to_entity — resolves and verifies an entity, then asks the client to
 * deep-link to it. Read-only: it never mutates. Access is always re-checked
 * against the caller's scope, so the model cannot deep-link to forbidden data.
 */
import { SchemaType } from "@google/generative-ai";
import { z } from "zod";
import prisma from "@/lib/db";
import type { TravisContext } from "../context";
import type { EntityRef } from "../contract";
import { defineTool, Policies } from "./types";

function inScope(ctx: TravisContext, projectId: string) {
    return ctx.canSeeAllProjects || ctx.accessibleProjectIds.includes(projectId);
}

export const navigateToEntity = defineTool({
    name: "navigate_to_entity",
    description:
        "Open a specific entity in the app (task, project, member, leave, indent, daily_report). Use after the user asks to open/view something you already found.",
    access: "read",
    timeoutMs: 6000,
    policy: Policies.member,
    argsSchema: z.object({
        entityType: z.enum(["task", "subtask", "project", "member", "leave", "indent", "daily_report"]),
        entityId: z.string().min(1),
    }),
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            entityType: {
                type: SchemaType.STRING,
                description: "task | subtask | project | member | leave | indent | daily_report",
            },
            entityId: { type: SchemaType.STRING, description: "The entity id to open" },
        },
        required: ["entityType", "entityId"],
    },
    async handler(args, ctx) {
        const notFound = { ok: false as const, error: "That item could not be opened." };
        let entity: EntityRef | null = null;

        switch (args.entityType) {
            case "task":
            case "subtask": {
                const t = await prisma.task.findFirst({
                    where: { id: args.entityId, workspaceId: ctx.workspaceId },
                    select: { id: true, name: true, projectId: true, status: true },
                });
                if (!t || !inScope(ctx, t.projectId)) return notFound;
                entity = { type: args.entityType, id: t.id, label: t.name, status: t.status ?? undefined, route: `task/${t.id}` };
                break;
            }
            case "project": {
                if (!inScope(ctx, args.entityId)) return notFound;
                const p = await prisma.project.findFirst({
                    where: { id: args.entityId, workspaceId: ctx.workspaceId },
                    select: { id: true, name: true },
                });
                if (!p) return notFound;
                entity = { type: "project", id: p.id, label: p.name, route: `project/${p.id}` };
                break;
            }
            case "member": {
                const m = await prisma.workspaceMember.findFirst({
                    where: { id: args.entityId, workspaceId: ctx.workspaceId },
                    select: { id: true, user: { select: { name: true, surname: true } } },
                });
                if (!m) return notFound;
                entity = { type: "member", id: m.id, label: m.user.surname || m.user.name || "Member", route: `member/${m.id}` };
                break;
            }
            case "leave": {
                const l = await prisma.leave_request.findFirst({
                    where: {
                        id: args.entityId,
                        workspaceId: ctx.workspaceId,
                        ...(ctx.isWorkspaceAdmin ? {} : { workspaceMemberId: ctx.workspaceMemberId }),
                    },
                    select: { id: true, type: true, status: true },
                });
                if (!l) return notFound;
                entity = { type: "leave", id: l.id, label: `${l.type} leave`, status: l.status ?? undefined, route: `leave/${l.id}` };
                break;
            }
            case "indent": {
                const i = await prisma.indent.findFirst({
                    where: {
                        id: args.entityId,
                        workspaceId: ctx.workspaceId,
                        ...(ctx.canSeeAllProjects || ctx.isProcurement
                            ? {}
                            : { projectId: { in: ctx.accessibleProjectIds } }),
                    },
                    select: { id: true, name: true, status: true },
                });
                if (!i) return notFound;
                entity = { type: "indent", id: i.id, label: i.name, status: i.status ?? undefined, route: `indent/${i.id}` };
                break;
            }
            case "daily_report": {
                const seesAll = ctx.isWorkspaceAdmin || ctx.isManager;
                const r = await prisma.dailyReport.findFirst({
                    where: {
                        id: args.entityId,
                        workspaceId: ctx.workspaceId,
                        ...(seesAll ? {} : { userId: ctx.userId }),
                    },
                    select: { id: true },
                });
                if (!r) return notFound;
                entity = { type: "daily_report", id: r.id, label: "Daily report", route: `daily-report/${r.id}` };
                break;
            }
        }

        if (!entity) return notFound;
        return {
            ok: true,
            data: { route: entity.route },
            entities: [entity],
            navigation: { route: entity.route!, entity },
            summary: `Open ${entity.label}`,
        };
    },
});
