
import { WorkspaceRole } from"@prisma/client";

/**
 * Workspace Access Control System
 * 
 * Role Hierarchy (highest to lowest):
 * 1. OWNER - Full control, cannot be removed, can transfer ownership
 * 2. ADMIN - Can manage workspace, projects, and members (except owner)
 * 3. MEMBER - Can access assigned projects and tasks
 * 4. VIEWER - Read-only access to assigned projects
 */

export type WorkspacePermission =
    | "workspace:delete"
    | "workspace:update"
    | "workspace:transfer-ownership"
    | "workspace:manage-members"
    | "workspace:invite-members"
    | "workspace:remove-members"
    | "workspace:update-member-roles"
    | "project:create"
    | "project:delete"
    | "project:update"
    | "project:manage-members"
    | "project:view-all"
    | "project:access-all";

/**
 * Check if a workspace role has a specific permission
 */
export function hasWorkspacePermission(
    role: WorkspaceRole,
    permission: WorkspacePermission
): boolean {
    const permissions = getWorkspacePermissions(role);
    return permissions.includes(permission);
}

/**
 * Get all permissions for a workspace role
 */
export function getWorkspacePermissions(role: WorkspaceRole): WorkspacePermission[] {
    switch (role) {
        case "OWNER":
            return [
                // Workspace permissions
                "workspace:delete",
                "workspace:update",
                "workspace:transfer-ownership",
                "workspace:manage-members",
                "workspace:invite-members",
                "workspace:remove-members",
                "workspace:update-member-roles",
                // Project permissions
                "project:create",
                "project:delete",
                "project:update",
                "project:manage-members",
                "project:view-all",
                "project:access-all",
            ];

        case "ADMIN":
            return [
                // Workspace permissions (cannot delete workspace or transfer ownership)
                "workspace:update",
                "workspace:manage-members",
                "workspace:invite-members",
                "workspace:remove-members", // Can remove members but not owner
                "workspace:update-member-roles", // Can update roles but not to owner
                // Project permissions
                "project:create",
                "project:delete",
                "project:update",
                "project:manage-members",
                "project:view-all",
                "project:access-all",
            ];

        case "MANAGER":
            return [
                "project:create",
            ];

        case "MEMBER":
            return [
                // Limited permissions - can only work on assigned projects
            ];

        case "VIEWER":
            return [
                // Read-only access to assigned projects
            ];

        default:
            return [];
    }
}

/**
 * Check if a role can manage another role
 * OWNER can manage all roles
 * ADMIN can manage MANAGER, MEMBER and VIEWER, but not OWNER or other ADMINs
 * MANAGER can manage MEMBER and VIEWER
 * MEMBER and VIEWER cannot manage anyone
 */
export function canManageRole(
    managerRole: WorkspaceRole,
    targetRole: WorkspaceRole
): boolean {
    if (managerRole === "OWNER") {
        return true; // Owner can manage everyone
    }

    if (managerRole === "ADMIN") {
        // Admin can manage MANAGER, MEMBER and VIEWER, but not OWNER or other ADMINs
        return targetRole === "MANAGER" || targetRole === "MEMBER" || targetRole === "VIEWER";
    }

    if (managerRole === "MANAGER") {
        return targetRole === "MEMBER" || targetRole === "VIEWER";
    }

    return false; // MEMBER and VIEWER cannot manage anyone
}

/**
 * Check if a role can be assigned by another role
 * OWNER can assign any role including ADMIN
 * ADMIN can assign MANAGER, MEMBER and VIEWER
 * MANAGER can assign MEMBER and VIEWER
 */
export function canAssignRole(
    assignerRole: WorkspaceRole,
    roleToAssign: WorkspaceRole
): boolean {
    if (assignerRole === "OWNER") {
        // Owner can assign any role except OWNER (ownership must be transferred)
        return roleToAssign !== "OWNER";
    }

    if (assignerRole === "ADMIN") {
        // Admin can only assign MANAGER, MEMBER and VIEWER
        return roleToAssign === "MANAGER" || roleToAssign === "MEMBER" || roleToAssign === "VIEWER";
    }

    if (assignerRole === "MANAGER") {
        return roleToAssign === "MEMBER" || roleToAssign === "VIEWER";
    }

    return false;
}

/**
 * Check if a role can remove another role from workspace
 * OWNER can remove anyone except themselves
 * ADMIN can remove MANAGER, MEMBER and VIEWER only
 * MANAGER can remove MEMBER and VIEWER
 */
export function canRemoveMember(
    removerRole: WorkspaceRole,
    targetRole: WorkspaceRole,
    isRemovingSelf: boolean
): boolean {
    // Cannot remove owner (must transfer ownership first)
    if (targetRole === "OWNER") {
        return false;
    }

    if (removerRole === "OWNER") {
        return !isRemovingSelf; // Owner can remove anyone except themselves
    }

    if (removerRole === "ADMIN") {
        // Admin can remove MANAGER, MEMBER and VIEWER
        return targetRole === "MANAGER" || targetRole === "MEMBER" || targetRole === "VIEWER";
    }

    if (removerRole === "MANAGER") {
        return targetRole === "MEMBER" || targetRole === "VIEWER";
    }

    return false;
}

/**
 * Get role hierarchy level (higher number = more permissions)
 */
export function getRoleLevel(role: WorkspaceRole): number {
    switch (role) {
        case "OWNER":
            return 5;
        case "ADMIN":
            return 4;
        case "MANAGER":
            return 3;
        case "MEMBER":
            return 2;
        case "VIEWER":
            return 1;
        default:
            return 0;
    }
}

/**
 * Check if a role is admin-level (OWNER or ADMIN)
 */
export function isWorkspaceAdmin(role: WorkspaceRole): boolean {
    return role === "OWNER" || role === "ADMIN";
}

/**
 * Check if a role has full workspace access
 */
export function hasFullWorkspaceAccess(role: WorkspaceRole): boolean {
    return role === "OWNER" || role === "ADMIN";
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: WorkspaceRole): string {
    switch (role) {
        case "OWNER":
            return "Owner";
        case "ADMIN":
            return "Admin";
        case "MANAGER":
            return "Manager";
        case "MEMBER":
            return "Member";
        case "VIEWER":
            return "Viewer";
        default:
            return "Unknown";
    }
}

/**
 * Get role description
 */
export function getRoleDescription(role: WorkspaceRole): string {
    switch (role) {
        case "OWNER":
            return "Full control over workspace, can transfer ownership";
        case "ADMIN":
            return "Can manage workspace, projects, and members";
        case "MANAGER":
            return "Can create projects and manage members";
        case "MEMBER":
            return "Can access assigned projects and create tasks";
        case "VIEWER":
            return "Read-only access to assigned projects";
        default:
            return "";
    }
}
