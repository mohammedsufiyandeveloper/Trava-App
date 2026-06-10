/**
 * Travis Tool Registry — shared types.
 *
 * Every tool is declared once with: a unique name, a description, a Zod
 * argument schema, a Gemini parameter schema, a read/write/destructive
 * classification, a permission policy, a timeout, and audit metadata. The
 * executor (travis.service) is the ONLY place tools run, and it always:
 *   1. checks the policy against the resolved context,
 *   2. validates args with the Zod schema,
 *   3. runs the handler under the tool timeout,
 *   4. records audit metadata for write/destructive tools.
 *
 * Handlers never receive raw model output and never touch Prisma for writes
 * directly — write handlers delegate to existing application actions/services.
 */
import type { FunctionDeclaration } from "@google/generative-ai";
import type { z } from "zod";
import type { TravisContext } from "../context";
import type { EntityRef } from "../contract";

export type ToolAccess = "read" | "write" | "destructive";

export interface ToolResult {
    ok: boolean;
    /** Minimal structured data returned to the model. */
    data?: unknown;
    /** Present when ok=false. Safe, user-facing reason. */
    error?: string;
    /** Entity cards to surface to the client. */
    entities?: EntityRef[];
    /** When set, the client should navigate to this route. */
    navigation?: { route: string; entity?: EntityRef };
    /** One-line progress summary for the tool_completed event. */
    summary?: string;
}

/** Human-facing preview of a write/destructive operation (token added later). */
export interface WritePreview {
    title: string;
    summary: string;
    fields: { label: string; value: string }[];
    destructive?: boolean;
    affectedEntity?: import("../contract").EntityRef;
}

export interface ToolDefinition<A = unknown> {
    name: string;
    description: string;
    access: ToolAccess;
    /** Validates and types the model-supplied arguments. */
    argsSchema: z.ZodType<A>;
    /** Gemini FunctionDeclaration parameter schema. */
    parameters: FunctionDeclaration["parameters"];
    /** Max execution time for the handler/execute. */
    timeoutMs: number;
    /**
     * Permission policy. Returns null when allowed, or a short denial reason
     * when not. Evaluated against the server-resolved context before args.
     */
    policy: (ctx: TravisContext) => string | null;
    /**
     * READ tools: executes immediately and feeds data back to the model.
     * Not used for write/destructive tools.
     */
    handler?: (args: A, ctx: TravisContext) => Promise<ToolResult>;
    /**
     * WRITE/DESTRUCTIVE tools: builds the confirmation preview. Re-checks
     * entity ownership/scope here — this runs before any mutation.
     */
    buildPreview?: (args: A, ctx: TravisContext) => Promise<WritePreview>;
    /**
     * WRITE/DESTRUCTIVE tools: performs the mutation. Only invoked from the
     * confirmation endpoint, after token + policy + idempotency checks.
     */
    execute?: (args: A, ctx: TravisContext) => Promise<ToolResult>;
    /** Audit action recorded for write/destructive tools. */
    auditAction?: string;
}

/** Helper to declare a tool with inferred arg typing. */
export function defineTool<A>(def: ToolDefinition<A>): ToolDefinition<A> {
    return def;
}

// Common policy helpers ------------------------------------------------------

export const Policies = {
    /** Any workspace member. */
    member: (_ctx: TravisContext): string | null => null,
    /** OWNER/ADMIN only. */
    adminOnly: (ctx: TravisContext): string | null =>
        ctx.isWorkspaceAdmin ? null : "This action requires an admin or owner role.",
    /** OWNER/ADMIN/MANAGER. */
    managerOrAdmin: (ctx: TravisContext): string | null =>
        ctx.isWorkspaceAdmin || ctx.isManager
            ? null
            : "This action requires a manager or admin role.",
    /** Can create/manage tasks: admin, manager, or procurement excluded. */
    canManageTasks: (ctx: TravisContext): string | null =>
        ctx.isWorkspaceAdmin || ctx.isManager
            ? null
            : "Only managers and admins can create or modify tasks for others.",
} as const;
