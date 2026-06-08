
import { ProjectRole, WorkspaceRole } from"@prisma/client";
import { isWorkspaceAdmin } from "./workspace-access";

/**
 * Project Access Control System
 * 
 * Role Hierarchy (highest to lowest):
 * 1. PROJECT_MANAGER - Full project access, can manage all aspects including members
 * 2. LEAD - Limited execution authority, can manage tasks but NOT members
 * 3. MEMBER - Can create and manage own tasks
 * 4. VIEWER - Read-only access
 * 
 * CRITICAL RULES:
 * - Workspace roles (OWNER/ADMIN/MANAGER) do NOT automatically grant project access
 * - OWNER/ADMIN can see all projects but must be explicitly added as PROJECT_MANAGER to manage
 * - Workspace MANAGER can only see projects they created or are added to
 * - LEAD cannot manage project members (only PROJECT_MANAGER can)
 */

export type ProjectPermission =
    | "project:update"
    | "project:delete"
    | "project:manage-members"
    | "project:add-members"
    | "project:remove-members"
    | "project:update-member-roles"
    | "task:create"
    | "task:update-any"
    | "task:delete-any"
    | "task:assign"
    | "task:view-all"
    | "comment:create"
    | "comment:update-any"
    | "comment:delete-any";

/**
 * Check if a user has a specific project permission
 * Based ONLY on project role - workspace role does NOT override
 */
export function hasProjectPermission(
    projectRole: ProjectRole | null,
    permission: ProjectPermission
): boolean {
    // If no project role, no permissions
    if (!projectRole) {
        return false;
    }

    const permissions = getProjectPermissions(projectRole);
    return permissions.includes(permission);
}

/**
 * Get all permissions for a project role
 */
export function getProjectPermissions(role: ProjectRole): ProjectPermission[] {
    switch (role) {
        case "PROJECT_MANAGER":
            return [
                // Full project access
                "project:update",
                "project:delete",
                "project:manage-members",
                "project:add-members",
                "project:remove-members",
                "project:update-member-roles",
                // Task management
                "task:create",
                "task:update-any",
                "task:delete-any",
                "task:assign",
                "task:view-all",
                // Comments
                "comment:create",
                "comment:update-any",
                "comment:delete-any",
            ];

        case "LEAD":
            return [
                // Limited execution authority - NO member management
                "task:create",
                "task:update-any",
                "task:delete-any",
                "task:assign",
                "task:view-all",
                // Comments
                "comment:create",
                "comment:update-any",
                "comment:delete-any",
            ];

        case "MEMBER":
            return [
                // Task management (limited)
                "task:create",
                "task:view-all",
                // Comments
                "comment:create",
            ];

        case "VIEWER":
            return [
                // Read-only
                "task:view-all",
            ];

        default:
            return [];
    }
}

/**
 * Check if a user is a project admin (PROJECT_MANAGER)
 * Returns true ONLY if user has PROJECT_MANAGER role
 * Workspace roles do NOT grant automatic admin access
 */
export function isProjectAdmin(
    projectRole: ProjectRole | null
): boolean {
    return projectRole === "PROJECT_MANAGER";
}

/**
 * Check if a user can manage another project member
 * ONLY PROJECT_MANAGER can manage members
 * LEAD cannot manage members (limited execution authority)
 */
export function canManageProjectMember(
    managerProjectRole: ProjectRole | null,
    targetProjectRole: ProjectRole
): boolean {
    // Only PROJECT_MANAGER can manage members
    return managerProjectRole === "PROJECT_MANAGER";
}

/**
 * Check if a user can assign a project role
 * ONLY PROJECT_MANAGER can assign roles
 */
export function canAssignProjectRole(
    assignerProjectRole: ProjectRole | null,
    roleToAssign: ProjectRole
): boolean {
    // Only PROJECT_MANAGER can assign roles
    return assignerProjectRole === "PROJECT_MANAGER";
}

/**
 * Check if a user can remove a project member
 * ONLY PROJECT_MANAGER can remove members
 */
export function canRemoveProjectMember(
    removerProjectRole: ProjectRole | null,
    targetProjectRole: ProjectRole
): boolean {
    // Only PROJECT_MANAGER can remove members
    return removerProjectRole === "PROJECT_MANAGER";
}

/**
 * Get project role hierarchy level (higher number = more permissions)
 */
export function getProjectRoleLevel(role: ProjectRole): number {
    switch (role) {
        case "PROJECT_MANAGER":
            return 4;
        case "LEAD":
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
 * Check if a user can update a specific task
 * - PROJECT_MANAGER and LEAD can update any task
 * - MEMBER can update tasks they created or are assigned to
 * - VIEWER cannot update tasks
 */
export function canUpdateTask(
    projectRole: ProjectRole | null,
    isTaskCreator: boolean,
    isTaskAssignee: boolean
): boolean {
    // PROJECT_MANAGER and LEAD can update any task
    if (projectRole === "PROJECT_MANAGER" || projectRole === "LEAD") {
        return true;
    }

    // MEMBER can update their own tasks or assigned tasks
    if (projectRole === "MEMBER") {
        return isTaskCreator || isTaskAssignee;
    }

    return false;
}

/**
 * Check if a user can delete a specific task
 * - PROJECT_MANAGER and LEAD can delete any task
 * - MEMBER can delete tasks they created
 * - VIEWER cannot delete tasks
 */
export function canDeleteTask(
    projectRole: ProjectRole | null,
    isTaskCreator: boolean
): boolean {
    // PROJECT_MANAGER and LEAD can delete any task
    if (projectRole === "PROJECT_MANAGER" || projectRole === "LEAD") {
        return true;
    }

    // MEMBER can delete their own tasks
    if (projectRole === "MEMBER") {
        return isTaskCreator;
    }

    return false;
}

/**
 * Get display name for a project role
 */
export function getProjectRoleDisplayName(role: ProjectRole): string {
    switch (role) {
        case "PROJECT_MANAGER":
            return "Project Manager";
        case "LEAD":
            return "Lead";
        case "MEMBER":
            return "Member";
        case "VIEWER":
            return "Viewer";
        default:
            return "Unknown";
    }
}

/**
 * Get project role description
 */
export function getProjectRoleDescription(role: ProjectRole): string {
    switch (role) {
        case "PROJECT_MANAGER":
            return "Full project access, can manage all aspects including members";
        case "LEAD":
            return "Limited execution authority, can manage tasks but not members";
        case "MEMBER":
            return "Can create and manage own tasks";
        case "VIEWER":
            return "Read-only access to project";
        default:
            return "";
    }
}
