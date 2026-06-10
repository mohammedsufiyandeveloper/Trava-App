/**
 * Travis Context Resolver
 * -----------------------
 * Derives, entirely server-side, the security context for a Travis turn:
 *   - the authenticated user + their workspace membership/role
 *   - the exact set of project IDs the caller may read
 *   - the caller's workspace member id
 *   - the request clock/timezone
 *   - any selected entities, AFTER verifying the caller can access them
 *
 * The model never supplies any of this. IDs that arrive on the request
 * (selectedProjectId/selectedTaskId) are treated as untrusted and re-checked
 * against the resolved scope before being exposed to tools.
 */
import prisma from "@/lib/db";

export type WorkspaceRole =
    | "OWNER"
    | "ADMIN"
    | "MANAGER"
    | "MEMBER"
    | "VIEWER"
    | "PROCUREMENT";

export interface TravisContext {
    userId: string;
    workspaceId: string;
    workspaceMemberId: string;
    role: WorkspaceRole;
    /** OWNER/ADMIN — full workspace visibility. */
    isWorkspaceAdmin: boolean;
    /** MANAGER — elevated but still project-scoped for reads. */
    isManager: boolean;
    /** PROCUREMENT — elevated visibility for procurement entities only. */
    isProcurement: boolean;
    /**
     * Project IDs the caller may read. For admins this is every project in the
     * workspace; for everyone else it is exactly their project memberships.
     */
    accessibleProjectIds: string[];
    /** True when the caller can read across all workspace projects. */
    canSeeAllProjects: boolean;
    now: Date;
    timezone: string;
    locale: string;
    /** Verified selected entities (undefined if absent or inaccessible). */
    selectedProjectId?: string;
    selectedTaskId?: string;
}

function isValidTimezone(tz: string | undefined): tz is string {
    if (!tz) return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

export interface ResolveContextInput {
    userId: string;
    workspaceId: string;
    timezone?: string;
    locale?: string;
    selectedProjectId?: string;
    selectedTaskId?: string;
}

/**
 * Resolve the Travis context. Returns null when the caller is not a member of
 * the workspace — callers MUST treat null as "deny".
 */
export async function resolveTravisContext(
    input: ResolveContextInput
): Promise<TravisContext | null> {
    const { userId, workspaceId } = input;

    const member = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId } },
        select: { id: true, workspaceRole: true },
    });
    if (!member) return null;

    const role = (member.workspaceRole ?? "MEMBER") as WorkspaceRole;
    const isWorkspaceAdmin = role === "OWNER" || role === "ADMIN";
    const isManager = role === "MANAGER";
    const isProcurement = role === "PROCUREMENT";
    const canSeeAllProjects = isWorkspaceAdmin;

    // Resolve accessible project IDs.
    let accessibleProjectIds: string[];
    if (canSeeAllProjects) {
        const projects = await prisma.project.findMany({
            where: { workspaceId },
            select: { id: true },
        });
        accessibleProjectIds = projects.map((p) => p.id);
    } else {
        const memberships = await prisma.projectMember.findMany({
            where: {
                workspaceMemberId: member.id,
                hasAccess: true,
                project: { workspaceId },
            },
            select: { projectId: true },
        });
        accessibleProjectIds = Array.from(new Set(memberships.map((m) => m.projectId)));
    }
    const accessibleSet = new Set(accessibleProjectIds);

    // Verify selected project — only expose if in scope.
    let selectedProjectId: string | undefined;
    if (input.selectedProjectId && accessibleSet.has(input.selectedProjectId)) {
        selectedProjectId = input.selectedProjectId;
    }

    // Verify selected task — must belong to the workspace and an accessible project.
    let selectedTaskId: string | undefined;
    if (input.selectedTaskId) {
        const task = await prisma.task.findFirst({
            where: { id: input.selectedTaskId, workspaceId },
            select: { id: true, projectId: true },
        });
        if (task && (canSeeAllProjects || accessibleSet.has(task.projectId))) {
            selectedTaskId = task.id;
        }
    }

    const timezone = isValidTimezone(input.timezone) ? input.timezone : "UTC";

    return {
        userId,
        workspaceId,
        workspaceMemberId: member.id,
        role,
        isWorkspaceAdmin,
        isManager,
        isProcurement,
        accessibleProjectIds,
        canSeeAllProjects,
        now: new Date(),
        timezone,
        locale: input.locale || "en-US",
        selectedProjectId,
        selectedTaskId,
    };
}

/** Format a date for display in the caller's timezone (YYYY-MM-DD). */
export function formatDateInTz(date: Date, timezone: string): string {
    try {
        const fmt = new Intl.DateTimeFormat("en-CA", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        return fmt.format(date);
    } catch {
        return date.toISOString().split("T")[0];
    }
}

/**
 * The Prisma `where` fragment that restricts a workspace-scoped query to the
 * caller's accessible projects. Admins get an unconstrained workspace filter.
 */
export function projectScopeFilter(ctx: TravisContext): {
    workspaceId: string;
    projectId?: { in: string[] };
} {
    if (ctx.canSeeAllProjects) {
        return { workspaceId: ctx.workspaceId };
    }
    return {
        workspaceId: ctx.workspaceId,
        projectId: { in: ctx.accessibleProjectIds },
    };
}
