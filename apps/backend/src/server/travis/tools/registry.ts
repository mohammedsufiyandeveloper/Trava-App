/**
 * Travis Tool Registry
 * --------------------
 * Central place tools are registered and the ONLY place they execute. The
 * executor enforces, in order: permission policy → argument validation →
 * timeout-bounded handler → audit (for writes). The model can never bypass
 * this path; it only emits a tool name + arguments which we re-validate.
 */
import type { FunctionDeclaration } from "@google/generative-ai";
import { z } from "zod";
import { recordActivity, type AuditAction } from "@/lib/audit";
import type { TravisContext } from "../context";
import type { WritePreview } from "./types";
import { READ_TOOLS } from "./read-tools";
import { WRITE_TOOLS } from "./write-tools";
import { navigateToEntity } from "./nav-tool";
import type { ToolDefinition, ToolResult } from "./types";

const ALL_TOOLS: ToolDefinition<any>[] = [...READ_TOOLS, navigateToEntity, ...WRITE_TOOLS];

const REGISTRY = new Map<string, ToolDefinition<any>>(
    ALL_TOOLS.map((t) => [t.name, t])
);

export function getTool(name: string): ToolDefinition<any> | undefined {
    return REGISTRY.get(name);
}

export function listTools(): ToolDefinition<any>[] {
    return [...REGISTRY.values()];
}

/** Static Gemini function declarations (cached at module load). */
const FUNCTION_DECLARATIONS: FunctionDeclaration[] = ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
}));

export function getFunctionDeclarations(): FunctionDeclaration[] {
    return FUNCTION_DECLARATIONS;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        p,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("TOOL_TIMEOUT")), ms)
        ),
    ]);
}

/**
 * Execute a tool the model requested. Always re-resolves and re-checks against
 * the server context; never trusts the model for authorization or ids.
 */
export async function executeTool(
    name: string,
    rawArgs: unknown,
    ctx: TravisContext
): Promise<ToolResult> {
    const tool = REGISTRY.get(name);
    if (!tool) return { ok: false, error: `Unknown tool: ${name}` };

    // Write/destructive tools never execute here — they require confirmation.
    if (tool.access !== "read" || !tool.handler) {
        return {
            ok: false,
            error: `'${name}' requires user confirmation and cannot run automatically.`,
        };
    }

    // 1. Permission policy.
    const denial = tool.policy(ctx);
    if (denial) return { ok: false, error: denial };

    // 2. Argument validation.
    const parsed = tool.argsSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
        return {
            ok: false,
            error: `Invalid arguments for ${name}: ${parsed.error.issues
                .map((i) => i.message)
                .join("; ")}`,
        };
    }

    // 3. Timeout-bounded execution.
    try {
        return await withTimeout(tool.handler(parsed.data, ctx), tool.timeoutMs);
    } catch (err: any) {
        const timedOut = err?.message === "TOOL_TIMEOUT";
        if (err instanceof z.ZodError) {
            return { ok: false, error: "Invalid tool arguments." };
        }
        if (process.env.NODE_ENV === "development") {
            console.error(`[Travis] tool '${name}' failed:`, err?.message);
        }
        return {
            ok: false,
            error: timedOut
                ? "That operation took too long. Please try again."
                : "The operation failed. Please try again.",
        };
    }
}

// ---------------------------------------------------------------------------
// Write tools: prepare (preview) and confirmed execution.
// ---------------------------------------------------------------------------

export type PrepareWriteResult =
    | { ok: true; preview: WritePreview; tool: string; validatedArgs: unknown }
    | { ok: false; error: string };

/**
 * Validate a model-proposed write and build its confirmation preview. NEVER
 * mutates. The returned validatedArgs are server-trusted and get embedded in
 * the signed confirmation token.
 */
export async function prepareWrite(
    name: string,
    rawArgs: unknown,
    ctx: TravisContext
): Promise<PrepareWriteResult> {
    const tool = REGISTRY.get(name);
    if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
    if (tool.access === "read" || !tool.buildPreview) {
        return { ok: false, error: `'${name}' is not a write operation.` };
    }
    const denial = tool.policy(ctx);
    if (denial) {
        recordToolAudit(tool, ctx, false, "permission_denied");
        return { ok: false, error: denial };
    }
    const parsed = tool.argsSchema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
        return {
            ok: false,
            error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
        };
    }
    try {
        const preview = await withTimeout(tool.buildPreview(parsed.data, ctx), tool.timeoutMs);
        return { ok: true, preview, tool: name, validatedArgs: parsed.data };
    } catch (err: any) {
        return { ok: false, error: err?.message || "Could not prepare that change." };
    }
}

/**
 * Execute a confirmed write. Caller (confirmation endpoint) has already
 * verified the token, re-resolved ctx, and matched user/workspace. We re-run
 * the policy + arg validation here as defense in depth, then mutate.
 */
export async function runConfirmedWrite(
    name: string,
    validatedArgs: unknown,
    ctx: TravisContext
): Promise<ToolResult> {
    const tool = REGISTRY.get(name);
    if (!tool || tool.access === "read" || !tool.execute) {
        return { ok: false, error: "Unknown write operation." };
    }
    const denial = tool.policy(ctx);
    if (denial) {
        recordToolAudit(tool, ctx, false, "permission_denied");
        return { ok: false, error: denial };
    }
    const parsed = tool.argsSchema.safeParse(validatedArgs);
    if (!parsed.success) return { ok: false, error: "Invalid stored arguments." };

    try {
        const result = await withTimeout(tool.execute(parsed.data, ctx), tool.timeoutMs);
        recordToolAudit(tool, ctx, result.ok, result.ok ? "ok" : "handler_error");
        return result;
    } catch (err: any) {
        const timedOut = err?.message === "TOOL_TIMEOUT";
        recordToolAudit(tool, ctx, false, timedOut ? "timeout" : "exception");
        if (process.env.NODE_ENV === "development") {
            console.error(`[Travis] write '${name}' failed:`, err?.message);
        }
        return {
            ok: false,
            error: err?.message?.includes("permission")
                ? err.message
                : "The operation could not be completed.",
        };
    }
}

export function isWriteTool(name: string): boolean {
    const t = REGISTRY.get(name);
    return !!t && t.access !== "read";
}

/** Record a write/destructive attempt (success or failure) to the audit log. */
function recordToolAudit(
    tool: ToolDefinition<any>,
    ctx: TravisContext,
    ok: boolean,
    outcome: string
) {
    if (!tool.auditAction) return;
    try {
        recordActivity({
            userId: ctx.userId,
            workspaceId: ctx.workspaceId,
            action: tool.auditAction as AuditAction,
            entityType: "TRAVIS_TOOL",
            customMessage: `Travis ${tool.name} (${ok ? "ok" : "failed"}: ${outcome})`,
        });
    } catch {
        /* audit must never break the request */
    }
}
