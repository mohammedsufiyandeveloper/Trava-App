import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { navigationRef } from "../navigation/navigationRef";
import {
    AuthResponse,
    Workspace,
    Project,
    Task,
    WorkspaceMember,
    LeaveBalance,
    LeaveRequest
} from "../types";

// ─── Config ────────────────────────────────────────────────────────────────
export const API_BASE = "https://backend-kohl-tau-56.vercel.app";
// export const API_BASE = "http://192.168.88.12:3000"; // Point to local dev server by default for testing
const SESSION_KEY = "better_auth_session";
const TOKEN_KEY = "better_auth_token";
const FETCH_TIMEOUT = 30000; // 30 seconds

// ─── Token Storage ───────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
}

async function saveToken(token: string): Promise<void> {
    if (token) {
        await AsyncStorage.setItem(TOKEN_KEY, token);
        DeviceEventEmitter.emit("session_changed");
    }
}

export async function clearToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(SESSION_KEY);
    DeviceEventEmitter.emit("session_changed");
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const token = await getToken();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
        const url = `${API_BASE}${path}`;
        if (__DEV__) {
            console.log(`[apiFetch] Calling ${url}`);
        }

        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(options.headers || {}),
            },
        });

        if (__DEV__) {
            const serverTiming = response.headers.get("server-timing");
            console.log(
                `[apiFetch] Response from ${url}: ${response.status}${serverTiming ? ` (${serverTiming})` : ""}`
            );
        }

        if (response.status === 401) {
            if (__DEV__) {
                console.log("[apiFetch] 401 Unauthorized encountered. Clearing token and redirecting to SignIn...");
            }
            await clearToken();
            try {
                if (navigationRef.isReady()) {
                    const currentRoute = navigationRef.getCurrentRoute();
                    if (currentRoute?.name !== "SignIn") {
                        navigationRef.reset({
                            index: 0,
                            routes: [{ name: "SignIn" }],
                        });
                    }
                }
            } catch (err) {
                console.error("[apiFetch] Global redirect failed:", err);
            }
        }

        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

/**
 * Sign in with email & password.
 * Better Auth returns: { user, session: { token, ... } }
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
    const res = await apiFetch("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.message || "Invalid email or password.");
    }

    const headerToken = res.headers.get("set-auth-token");
    const bodyToken = data?.session?.token ?? data?.token;
    let fallbackToken = null;

    // Attempt to extract from set-cookie
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
        const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
        if (match) {
            fallbackToken = match[1];
        } else {
            const match2 = setCookie.match(/__Secure-better-auth\.session_token=([^;]+)/);
            if (match2) fallbackToken = match2[1];
        }
    }

    const token = headerToken ?? bodyToken ?? fallbackToken;

    if (token) {
        await saveToken(token);
    }

    if (data?.user) {
        data.user.name = data.user.surname || data.user.name;
    }

    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(data));

    return data as AuthResponse;
}

export async function requestPasswordResetOtp(email: string): Promise<void> {
    const res = await apiFetch("/api/auth/forget-password/email-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || "Failed to send the password reset code.");
    }
}

export async function resetPasswordWithOtp(
    email: string,
    otp: string,
    password: string
): Promise<void> {
    const res = await apiFetch("/api/auth/email-otp/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, otp, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || "Invalid or expired reset code.");
    }
}

/**
 * Send OTP verification email.
 */
export async function requestEmailOtp(email: string): Promise<any> {
    const res = await apiFetch("/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        body: JSON.stringify({ email, type: "email-verification" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to send verification email.");
    return data;
}

/**
 * Verify OTP.
 */
export async function verifyEmailOtp(email: string, otp: string): Promise<any> {
    const res = await apiFetch("/api/auth/email-otp/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Invalid OTP.");
    return data;
}

/**
 * Validate session against the server.
 */
export async function getSession(): Promise<AuthResponse | null> {
    try {
        const res = await apiFetch("/api/auth/get-session");
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.user) {
            data.user.name = data.user.surname || data.user.name;
            await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(data));
        }
        return data?.user ? (data as AuthResponse) : null;
    } catch {
        return null;
    }
}

/**
 * Return cached session.
 */
export async function getCachedSession(): Promise<AuthResponse | null> {
    try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw) as AuthResponse;
        if (data?.user) {
            data.user.name = data.user.surname || data.user.name;
        }
        return data;
    } catch {
        return null;
    }
}

/**
 * Sign out.
 */
export async function signOut(): Promise<void> {
    try {
        // Clear push token so user doesn't get notifications after logout
        await apiFetch("/api/user/push-token", { method: "DELETE" }).catch(() => { });
        await apiFetch("/api/auth/sign-out", { method: "POST" });
    } catch (_) { }
    await clearToken();
}

/**
 * Change Password
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<any> {
    const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to change password. Please check your current password.");
    return data;
}

/**
 * Fetch workspaces.
 */
export async function getWorkspaces(): Promise<Workspace[]> {
    try {
        const res = await apiFetch("/api/workspaces");
        if (!res.ok) return [];
        const data = await res.json();
        return data?.workspaces ?? (Array.isArray(data) ? data : []);
    } catch {
        return [];
    }
}

export type WorkspaceBootstrapResponse = {
    workspaces: Workspace[];
    activeWorkspace: Workspace | null;
    projects: Project[];
    tags: any[];
    todayAttendance: any | null;
    teamAttendance: any[];
};

/**
 * Load the complete workspace shell in one HTTP request.
 */
export async function getWorkspaceBootstrap(
    preferredWorkspaceId?: string,
    clientDateString?: string
): Promise<WorkspaceBootstrapResponse> {
    const query = new URLSearchParams();
    if (preferredWorkspaceId) query.set("workspaceId", preferredWorkspaceId);
    if (clientDateString) query.set("clientDateString", clientDateString);

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const res = await apiFetch(`/api/workspaces/bootstrap${suffix}`);
    const data = await res.json();
    if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to load workspace");
    }

    return {
        workspaces: data.workspaces ?? [],
        activeWorkspace: data.activeWorkspace ?? null,
        projects: data.projects ?? [],
        tags: data.tags ?? [],
        todayAttendance: data.todayAttendance ?? null,
        teamAttendance: data.teamAttendance ?? [],
    };
}

/**
 * Fetch projects.
 */
export async function getProjects(workspaceId: string, lite = false): Promise<Project[]> {
    try {
        const res = await apiFetch(`/api/projects?workspaceId=${workspaceId}${lite ? "&lite=true" : ""}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.projects ?? (Array.isArray(data) ? data : []);
    } catch {
        return [];
    }
}

/**
 * Fetch workspace members.
 */
export async function getWorkspaceMembers(workspaceId: string, role?: string): Promise<WorkspaceMember[]> {
    try {
        let url = `/api/workspaces/${workspaceId}/members`;
        if (role) {
            url += `?role=${role}`;
        }
        const res = await apiFetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.members ?? [];
    } catch {
        return [];
    }
}

/**
 * Fetch a single project by ID with full details
 */
export async function getProject(projectId: string): Promise<any | null> {
    try {
        const res = await apiFetch(`/api/projects?projectId=${projectId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.project ?? null;
    } catch {
        return null;
    }
}

// Helper to map complex backend relations to simple mobile types
function mapTask(t: any): Task {
    const normalize = (m: any) => {
        if (!m) return undefined;
        const wsMember = m.WorkspaceMember || m.workspaceMember;
        const user = wsMember?.user || m.user;

        const nameRaw = m.name || user?.name || "";
        const surnameRaw = m.surname || user?.surname || "";

        return {
            id: user?.id || m.id,
            name: nameRaw.trim(),
            surname: surnameRaw.trim(),
            displayName: m.displayName || surnameRaw.trim() || nameRaw.trim() || "Member",
            image: m.image || user?.image,
        };
    };

    const mappedParentTask = t.parentTask ? {
        ...t.parentTask,
        reviewer: normalize(t.parentTask.reviewer)
    } : undefined;

    const mappedAssignee = normalize(t.ProjectMember_Task_assigneeIdToProjectMember || t.assignee);
    const mappedReviewer = normalize(t.reviewer);
    const rawTags = [
        t.tag,
        ...(Array.isArray(t.Tag) ? t.Tag : []),
        ...(Array.isArray(t.tags) ? t.tags : []),
        t.taskTag
    ].filter(Boolean);

    // Deduplicate tags by ID or name
    const uniqueTags = Array.from(new Map(rawTags.map(tag => {
        const id = typeof tag === 'object' ? tag.id : tag;
        return [id, tag];
    })).values()).map(tag => {
        if (typeof tag === 'string') return { id: tag, name: tag };
        return tag;
    });

    const primaryTag = uniqueTags[0];
    const mappedTagId = t.tagId || primaryTag?.id;

    return {
        ...t,
        status: t.status ?? "TO_DO",
        priority: t.priority ?? "NORMAL",
        assignee: mappedAssignee,
        reviewer: mappedReviewer,
        assigneeId: mappedAssignee?.id || t.assigneeId,
        reviewerId: mappedReviewer?.id || t.reviewerId,
        parentTask: mappedParentTask,
        tag: primaryTag,
        tags: uniqueTags,
        tagId: mappedTagId,
        project: t.project ? {
            ...t.project,
            projectManagers: t.project.projectMembers
                ?.filter((m: any) => m.projectRole === "PROJECT_MANAGER" || m.projectRole === "LEAD")
                .map((m: any) => {
                    const norm = normalize(m);
                    if (norm) {
                        (norm as any).projectRole = m.projectRole;
                    }
                    return norm;
                })
                .filter(Boolean) || []
        } : undefined,
        commentCount: t._count?.Activity ?? 0,
    };
}

function flattenTasks(tasks: any[]): Task[] {
    const flat: Task[] = [];
    for (const t of tasks) {
        const mapped = mapTask(t);
        flat.push(mapped);
        if (t.subTasks && Array.isArray(t.subTasks)) {
            flat.push(...flattenTasks(t.subTasks));
        }
    }
    return flat;
}

/**
 * Fetch tasks with optional filters and cursor-based pagination.
 * Returns { tasks, hasMore, nextCursor } for paginated access.
 */
export async function getTasks(
    workspaceId: string,
    filters: {
        projectId?: string | string[];
        status?: string[];
        assigneeId?: string[];
        tagId?: string[];
        search?: string;
        hierarchyMode?: "parents" | "children" | "all";
        excludeParents?: boolean;
        parentId?: string;
        onlySubtasks?: boolean;
        includeSubTasks?: boolean;
        dueAfter?: string;
        dueBefore?: string;
        sorts?: Array<{ field: string; direction: "asc" | "desc" }>;
        view_mode?: string;
        limit?: number;
        cursor?: { id: string; createdAt: string } | null;
    } = {}
): Promise<{ tasks: Task[]; hasMore: boolean; nextCursor: { id: string; createdAt: string } | null }> {
    try {
        let url = `/api/tasks?workspaceId=${workspaceId}`;

        if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
        if (filters.limit) url += `&limit=${filters.limit}`;
        if (filters.dueAfter) url += `&dueAfter=${filters.dueAfter}`;
        if (filters.dueBefore) url += `&dueBefore=${filters.dueBefore}`;
        if (filters.parentId) url += `&parentId=${filters.parentId}`;

        // Cursor-based pagination
        if (filters.cursor) {
            url += `&cursorId=${encodeURIComponent(filters.cursor.id)}`;
            url += `&cursorCreatedAt=${encodeURIComponent(filters.cursor.createdAt)}`;
        }

        if (filters.sorts && filters.sorts.length > 0) {
            filters.sorts.forEach(s => {
                url += `&sorts=${s.field}:${s.direction}`;
            });
        }

        // Ensure hierarchyMode is set to children if we are explicitly excluding parents
        const actualHierarchyMode = filters.hierarchyMode || (filters.excludeParents ? "children" : undefined);
        if (actualHierarchyMode) url += `&hierarchyMode=${actualHierarchyMode}`;

        if (filters.excludeParents) url += `&excludeParents=true`;
        if (filters.onlySubtasks) url += `&onlySubtasks=true`;
        if (filters.includeSubTasks) url += `&includeSubTasks=true`;
        if (filters.view_mode) url += `&view_mode=${filters.view_mode}`;
        url += `&includeTag=true&includeTags=true&include=tag&include=Tag`;

        if (filters.projectId) {
            const projects = Array.isArray(filters.projectId) ? filters.projectId : [filters.projectId];
            projects.forEach((p: string) => url += `&projectId=${p}`);
        }
        if (filters.status) {
            const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
            statuses.forEach(s => url += `&status=${s}`);
        }
        if (filters.assigneeId) {
            const assignees = Array.isArray(filters.assigneeId) ? filters.assigneeId : [filters.assigneeId];
            assignees.forEach(a => url += `&assigneeId=${a}`);
        }
        if (filters.tagId) {
            const tags = Array.isArray(filters.tagId) ? filters.tagId : [filters.tagId];
            tags.forEach(t => url += `&tagId=${t}`);
        }

        const res = await apiFetch(url);
        if (!res.ok) return { tasks: [], hasMore: false, nextCursor: null };
        const data = await res.json();
        const rawTasks: any[] = data?.tasks ?? (Array.isArray(data) ? data : []);
        return {
            tasks: flattenTasks(rawTasks),
            hasMore: data?.hasMore ?? false,
            nextCursor: data?.nextCursor ?? null,
        };
    } catch {
        return { tasks: [], hasMore: false, nextCursor: null };
    }
}

export type KanbanColumnResponse = {
    tasks: Task[];
    totalCount: number;
    hasMore: boolean;
    nextCursor: { id: string; createdAt: string } | null;
};

export async function getKanbanBoard(
    workspaceId: string,
    filters: {
        projectId?: string[];
        assigneeId?: string[];
        tagId?: string[];
        search?: string;
        dueAfter?: string;
        dueBefore?: string;
        pageSize?: number;
    } = {}
): Promise<Record<string, KanbanColumnResponse>> {
    const params = new URLSearchParams({ workspaceId });
    params.set("pageSize", String(filters.pageSize ?? 10));
    if (filters.search) params.set("search", filters.search);
    if (filters.dueAfter) params.set("dueAfter", filters.dueAfter);
    if (filters.dueBefore) params.set("dueBefore", filters.dueBefore);
    filters.projectId?.forEach((id) => params.append("projectId", id));
    filters.assigneeId?.forEach((id) => params.append("assigneeId", id));
    filters.tagId?.forEach((id) => params.append("tagId", id));

    const res = await apiFetch(`/api/tasks/kanban?${params.toString()}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch Kanban board (${res.status})`);
    }

    const data = await res.json();
    const columns = data?.columns ?? {};
    return Object.fromEntries(
        Object.entries(columns).map(([status, column]: [string, any]) => [
            status,
            {
                ...column,
                tasks: (column.tasks ?? []).map(mapTask),
            },
        ])
    );
}

/**
 * Fetch the total count of tasks matching the given filters.
 * This is a lightweight COUNT query — no task data is fetched.
 * Used to display the grand-total badge independent of the current page cursor.
 */
export async function getTasksCount(
    workspaceId: string,
    filters: {
        projectId?: string | string[];
        status?: string[];
        assigneeId?: string[];
        tagId?: string[];
        search?: string;
        onlySubtasks?: boolean;
        excludeParents?: boolean;
        dueAfter?: string;
        dueBefore?: string;
    } = {}
): Promise<number> {
    try {
        let url = `/api/tasks/count?workspaceId=${workspaceId}`;

        if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
        if (filters.dueAfter) url += `&dueAfter=${filters.dueAfter}`;
        if (filters.dueBefore) url += `&dueBefore=${filters.dueBefore}`;
        if (filters.onlySubtasks) url += `&onlySubtasks=true`;
        if (filters.excludeParents) url += `&excludeParents=true`;

        if (filters.projectId) {
            const projects = Array.isArray(filters.projectId) ? filters.projectId : [filters.projectId];
            projects.forEach((p: string) => url += `&projectId=${p}`);
        }
        if (filters.status) {
            const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
            statuses.forEach(s => url += `&status=${s}`);
        }
        if (filters.assigneeId) {
            const assignees = Array.isArray(filters.assigneeId) ? filters.assigneeId : [filters.assigneeId];
            assignees.forEach(a => url += `&assigneeId=${a}`);
        }
        if (filters.tagId) {
            const tags = Array.isArray(filters.tagId) ? filters.tagId : [filters.tagId];
            tags.forEach(t => url += `&tagId=${t}`);
        }

        const res = await apiFetch(url);
        if (!res.ok) return 0;
        const data = await res.json();
        return data?.totalCount ?? 0;
    } catch {
        return 0;
    }
}

/**
 * Fetch subtasks for a specific parent task directly from the dedicated endpoint.
 */
export async function getSubTasks(
    parentTaskId: string,
    workspaceId: string,
    projectId?: string
): Promise<Task[]> {
    try {
        let url = `/api/tasks/${parentTaskId}/subtasks?workspaceId=${workspaceId}&includeTag=true&includeTags=true&include=tag&include=Tag`;
        if (projectId) url += `&projectId=${projectId}`;

        const res = await apiFetch(url);
        if (!res.ok) {
            console.error(`[getSubTasks] Failed with status: ${res.status}`);
            return [];
        }
        const data = await res.json();
        const subTasks: any[] = data?.subTasks ?? [];
        return subTasks.map(mapTask);
    } catch (e) {
        console.error(`[getSubTasks] Exception:`, e);
        return [];
    }
}

/**
 * Fetch a single task/subtask by its ID.
 */
export async function getTaskById(taskId: string): Promise<Task | null> {
    try {
        const res = await apiFetch(`/api/tasks/${taskId}?includeTag=true&includeTags=true&include=tag&include=Tag`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.task) return null;
        return mapTask(data.task);
    } catch {
        return null;
    }
}

export type TaskDetailResponse = {
    task: Task;
    subTasks: Task[];
    subTasksPage: {
        totalCount: number;
        hasMore: boolean;
        nextCursor: { id: string; createdAt: string } | null;
    };
    comments: any[];
    commentsPage: {
        hasMore: boolean;
        nextCursor: string | null;
    };
    activities: any[];
    activitiesPage: {
        hasMore: boolean;
        nextCursor: string | null;
    };
};

/**
 * Fetch everything required for the initial task-detail render in one request.
 */
export async function getTaskDetail(taskId: string): Promise<TaskDetailResponse> {
    const query = new URLSearchParams({
        subtaskLimit: "30",
        commentLimit: "20",
        activityLimit: "20",
    });
    const res = await apiFetch(`/api/tasks/${taskId}/detail?${query.toString()}`);
    const data = await res.json();
    if (!res.ok || !data?.task) {
        throw new Error(data?.error || "Failed to load task details");
    }

    return {
        task: mapTask(data.task),
        subTasks: (data.subTasks ?? []).map(mapTask),
        subTasksPage: data.subTasksPage,
        comments: data.comments ?? [],
        commentsPage: data.commentsPage,
        activities: data.activities ?? [],
        activitiesPage: data.activitiesPage,
    };
}

/**
 * Fetch task messages/comments mapped to the given task
 */
export async function getTaskComments(
    taskId: string,
    cursor?: string
): Promise<any[]> {
    try {
        const query = new URLSearchParams({ limit: "20" });
        if (cursor) query.set("cursor", cursor);
        const res = await apiFetch(`/api/tasks/${taskId}/comments?${query.toString()}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.comments ?? [];
    } catch {
        return [];
    }
}

/**
 * Fetch task/subtask activities from the database
 */
export async function getTaskActivities(
    taskId: string,
    cursor?: string
): Promise<any[]> {
    try {
        const query = new URLSearchParams({ limit: "20" });
        if (cursor) query.set("cursor", cursor);
        const res = await apiFetch(`/api/tasks/${taskId}/activities?${query.toString()}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.activities ?? [];
    } catch {
        return [];
    }
}

/**
 * Post a new message securely
 */
export async function postTaskComment(taskId: string, content: string): Promise<any> {
    const res = await apiFetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to post comment");
    return data;
}

/**
 * Create a new task securely
 */
export async function createProjectTask(projectId: string, name: string, data?: any): Promise<any> {
    const res = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
            projectId,
            name,
            ...data
        }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to create task");
    return result;
}

/**
 * Create a new subtask under a parent task with full metadata parity
 */
export async function createSubTask(
    parentTaskId: string,
    data: {
        name: string;
        description?: string;
        status?: string;
        assigneeUserId?: string;
        reviewerId?: string;
        tagId?: string;
        startDate?: string;
        dueDate?: string;
        days?: number;
    }
): Promise<any> {
    const res = await apiFetch(`/api/tasks/${parentTaskId}/subtasks`, {
        method: "POST",
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to create subtask");
    return result;
}

/**
 * Create a new project in the active workspace
 */
export async function createProject(
    workspaceId: string,
    name: string,
    projectManagerUserId: string,
    color?: string,
    description?: string,
    companyName?: string,
    registeredCompanyName?: string,
    directorName?: string,
    address?: string,
    gstNumber?: string,
    contactPersonName?: string,
    contactNumber?: string
): Promise<any> {
    const res = await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({
            name,
            workspaceId,
            color,
            projectManagerUserId,
            description,
            companyName,
            registeredCompanyName,
            directorName,
            address,
            gstNumber,
            contactPersonName,
            contactNumber
        }),
    });
    const text = await res.text();
    const result = text ? JSON.parse(text) : { success: res.ok };
    if (!res.ok) throw new Error(result.error || "Failed to create project");
    return result;
}

/**
 * Create a new tag in the active workspace
 */
export async function createTag(
    workspaceId: string,
    name: string,
    requirePurchase: boolean = false
): Promise<any> {
    const res = await apiFetch("/api/tags", {
        method: "POST",
        body: JSON.stringify({ name, workspaceId, requirePurchase }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create tag");
    return data;
}

/**
 * Fetch all tags for a workspace
 */
export async function getTags(workspaceId: string): Promise<any[]> {
    try {
        const res = await apiFetch(`/api/tags?workspaceId=${workspaceId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.tags ?? [];
    } catch {
        return [];
    }
}

/**
 * Update an existing tag
 */
export async function updateTag(
    workspaceId: string,
    tagId: string,
    data: { name?: string; requirePurchase?: boolean }
): Promise<any> {
    const res = await apiFetch("/api/tags", {
        method: "PATCH",
        body: JSON.stringify({ tagId, workspaceId, ...data }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to update tag");
    return result;
}

/**
 * Delete a tag
 */
export async function deleteTag(workspaceId: string, tagId: string): Promise<any> {
    const res = await apiFetch(`/api/tags?tagId=${tagId}&workspaceId=${workspaceId}`, {
        method: "DELETE",
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to delete tag");
    return result;
}

/**
 * Update task details (status, name, etc.)
 */
export async function updateTask(taskId: string, data: any): Promise<any> {
    const res = await apiFetch(`/api/tasks?taskId=${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ taskId, ...data }),
    });
    const text = await res.text();
    const result = text ? JSON.parse(text) : { success: res.ok };
    if (!res.ok) throw new Error(result.error || "Failed to update task");
    return result;
}

/**
 * Delete a task directly
 */
export async function deleteTask(taskId: string): Promise<any> {
    const res = await apiFetch(`/api/tasks?taskId=${taskId}`, {
        method: "DELETE",
    });
    const text = await res.text();
    const result = text ? JSON.parse(text) : { success: res.ok };
    if (!res.ok) throw new Error(result.error || "Failed to delete task");
    return result;
}

/**
 * Update project details
 */
export async function updateProject(projectId: string, data: any): Promise<any> {
    const res = await apiFetch("/api/projects", {
        method: "PATCH",
        body: JSON.stringify({ projectId, ...data }),
    });

    const text = await res.text();
    const result = text ? JSON.parse(text) : { success: res.ok };

    if (!res.ok) {
        const errorMsg = result.error || result.message || "Failed to update project";
        throw new Error(errorMsg);
    }
    return result;
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<any> {
    const res = await apiFetch(`/api/projects?projectId=${projectId}`, {
        method: "DELETE",
    });
    const text = await res.text();
    const result = text ? JSON.parse(text) : { success: res.ok };
    if (!res.ok) throw new Error(result.error || "Failed to delete project");
    return result;
}

/**
 * Fetch project members
 */
export async function getProjectMembers(projectId: string): Promise<any[]> {
    try {
        const res = await apiFetch(`/api/projects/${projectId}/members`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.members ?? [];
    } catch {
        return [];
    }
}

/**
 * Add members to a project
 */
export async function addProjectMembers(projectId: string, memberUserIds: string[]): Promise<any> {
    const res = await apiFetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ memberUserIds }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to add members");
    return result;
}

/**
 * Update project member role
 */
export async function updateProjectMember(projectId: string, userId: string, role: string): Promise<any> {
    const res = await apiFetch(`/api/projects/${projectId}/members`, {
        method: "PATCH",
        body: JSON.stringify({ userId, role }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to update member role");
    return result;
}

/**
 * Remove member from project
 */
export async function removeProjectMember(projectId: string, userId: string): Promise<any> {
    const res = await apiFetch(`/api/projects/${projectId}/members?userId=${userId}`, {
        method: "DELETE",
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to remove member");
    return result;
}

/**
 * Fetch today's attendance
 */
export async function getTodayAttendance(workspaceId: string, clientDateString: string): Promise<any | null> {
    try {
        const res = await apiFetch(`/api/attendance/today?workspaceId=${workspaceId}&clientDateString=${clientDateString}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data ?? null;
    } catch {
        return null;
    }
}

/**
 * Check-in 
 */
export async function submitCheckIn(workspaceId: string, latitude: number, longitude: number, address?: string, clientDateString?: string): Promise<any> {
    const res = await apiFetch("/api/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({ workspaceId, latitude, longitude, address, clientDateString }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to check in");
    return result.data;
}

/**
 * Check-out 
 */
export async function submitCheckOut(workspaceId: string, latitude: number, longitude: number, address?: string, clientDateString?: string): Promise<any> {
    const res = await apiFetch("/api/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({ workspaceId, latitude, longitude, address, clientDateString }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to check out");
    return result.data;
}

/**
 * Get Team Attendance Register
 */
export async function getTeamAttendance(workspaceId: string, clientDateString?: string): Promise<any> {
    try {
        let url = `/api/attendance/register?workspaceId=${workspaceId}`;
        if (clientDateString) {
            url += `&clientDateString=${clientDateString}`;
        }
        const res = await apiFetch(url);
        const data = await res.json();
        return data?.register ?? [];
    } catch {
        return [];
    }
}

/**
 * Get Historical member stats
 */
export async function getMemberAttendanceStats(workspaceId: string, memberId: string): Promise<{ daysWorked: number, daysLate: number } | null> {
    try {
        const res = await apiFetch(`/api/attendance/stats?workspaceId=${workspaceId}&memberId=${memberId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.stats ?? null;
    } catch {
        return null;
    }
}

/**
 * Get Workspace Attendance Logs (Web Parity)
 */
export async function getWorkspaceAttendanceLogs(workspaceId: string, startDate?: string, endDate?: string): Promise<any[]> {
    try {
        let url = `/api/attendance`;
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const res = await apiFetch(url, {
            headers: { "x-workspace-id": workspaceId }
        });
        const data = await res.json();
        return data.success ? data.data : [];
    } catch (e) {
        console.error("[api] getWorkspaceAttendanceLogs error:", e);
        return [];
    }
}

/**
 * Fetch leave balance for the current user
 */
export async function getLeaveBalance(workspaceId: string): Promise<LeaveBalance | null> {
    try {
        const res = await apiFetch(`/api/leaves/balance?workspaceId=${workspaceId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data ?? null;
    } catch (error) {
        console.error("[api] getLeaveBalance error:", error);
        return null;
    }
}

/**
 * Fetch leave requests (all or only current user's)
 */
export async function getLeaveRequestsPage(
    workspaceId: string,
    onlyMine: boolean = true,
    cursor?: string,
    search?: string
): Promise<{
    requests: LeaveRequest[];
    hasMore: boolean;
    nextCursor: string | null;
}> {
    try {
        const query = new URLSearchParams({
            workspaceId,
            onlyMine: String(onlyMine),
            limit: "25",
        });
        if (cursor) query.set("cursor", cursor);
        if (search) query.set("search", search);
        const res = await apiFetch(`/api/leaves?${query.toString()}`);
        if (!res.ok) {
            return { requests: [], hasMore: false, nextCursor: null };
        }
        const data = await res.json();
        return {
            requests: data?.data ?? [],
            hasMore: data?.hasMore ?? false,
            nextCursor: data?.nextCursor ?? null,
        };
    } catch (error) {
        console.error("[api] getLeaveRequests error:", error);
        return { requests: [], hasMore: false, nextCursor: null };
    }
}

export async function getLeaveRequests(
    workspaceId: string,
    onlyMine: boolean = true
): Promise<LeaveRequest[]> {
    const page = await getLeaveRequestsPage(workspaceId, onlyMine);
    return page.requests;
}

/**
 * Submit a new leave request
 */
export async function submitLeaveRequest(
    workspaceId: string,
    data: { startDate: string, endDate: string, reason: string, type: string }
): Promise<any> {
    const res = await apiFetch(`/api/leaves?workspaceId=${workspaceId}`, {
        method: "POST",
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to submit leave request");
    return result.data;
}

/**
 * Update leave request status (Approve/Reject)
 */
export async function updateLeaveStatus(workspaceId: string, leaveId: string, status: string): Promise<any> {
    const res = await apiFetch(`/api/leaves/${leaveId}?workspaceId=${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to update leave status");
    return result.data;
}

/**
 * Register the mobile device push token with the backend
 */
export async function registerPushToken(token: string) {
    try {
        return await apiFetch("/api/user/push-token", {
            method: "POST",
            body: JSON.stringify({ pushToken: token }),
        });
    } catch (e) {
        console.error("[api] registerPushToken error:", e);
        return null;
    }
}

/**
 * Fetch notification history
 */
export async function getNotifications(workspaceId: string, limit: number = 20, offset: number = 0): Promise<any> {
    try {
        const res = await apiFetch(`/api/notifications?workspaceId=${workspaceId}&limit=${limit}&offset=${offset}`);
        if (!res.ok) return { notifications: [], unreadCount: 0 };
        return await res.json();
    } catch {
        return { notifications: [], unreadCount: 0 };
    }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(id: string): Promise<boolean> {
    try {
        const res = await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Mark all notifications in a workspace as read
 */
export async function markAllNotificationsRead(workspaceId: string): Promise<boolean> {
    try {
        const res = await apiFetch(`/api/notifications/mark-all-read`, {
            method: "POST",
            body: JSON.stringify({ workspaceId }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ─── Board API ───────────────────────────────────────────────────────────────

export async function getWorkspaceBoard(workspaceId: string): Promise<any> {
    try {
        const res = await apiFetch(`/api/board?workspaceId=${workspaceId}`);
        if (!res.ok) return null;
        const result = await res.json();
        return result?.data ?? null;
    } catch (e) {
        console.error("[api] getWorkspaceBoard error:", e);
        return null;
    }
}

export async function createBoardItem(workspaceId: string, memberId: string, note: string): Promise<any> {
    const res = await apiFetch("/api/board", {
        method: "POST",
        body: JSON.stringify({ workspaceId, memberId, note }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || "Failed to create board item");
    return result;
}

export async function toggleBoardItemStatus(workspaceId: string, itemId: string, status: string): Promise<any> {
    const res = await apiFetch(`/api/board/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ workspaceId, status }),
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || "Failed to toggle status");
    return result;
}

export async function deleteBoardItem(workspaceId: string, itemId: string): Promise<any> {
    const res = await apiFetch(`/api/board/${itemId}?workspaceId=${workspaceId}`, {
        method: "DELETE",
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || "Failed to delete board item");
    return result;
}

// ─── User Profile API ─────────────────────────────────────────────────────────

export async function getProfile(): Promise<any> {
    try {
        const res = await apiFetch("/api/user/profile");
        if (!res.ok) return null;
        const data = await res.json();
        return data;
    } catch {
        return null;
    }
}

export async function updateProfile(data: {
    name?: string;
    surname?: string;
    phoneNumber?: string;
    jobTitle?: string;
    image?: string;
}): Promise<any> {
    const res = await apiFetch("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to update profile");
    return result;
}

/**
 * Fetch workspace settings
 */
export async function getWorkspaceSettings(workspaceId: string): Promise<any | null> {
    try {
        const res = await apiFetch(`/api/workspace/settings?workspaceId=${workspaceId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data ?? null;
    } catch {
        return null;
    }
}

/**
 * Update workspace settings
 */
export async function updateWorkspaceSettings(workspaceId: string, data: any): Promise<any> {
    const res = await apiFetch(`/api/workspace/settings?workspaceId=${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to update workspace settings");
    return result.data;
}

// ─── Messaging API ───────────────────────────────────────────────────────────

/**
 * Get all conversations for the user in a workspace
 */
export async function getConversations(workspaceId: string): Promise<any[]> {
    try {
        const res = await apiFetch(`/api/conversations?workspaceId=${workspaceId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.conversations ?? [];
    } catch {
        return [];
    }
}

/**
 * Get or create a 1-to-1 conversation
 */
export async function getOrCreateConversation(workspaceId: string, otherUserId: string): Promise<any | null> {
    try {
        const res = await apiFetch("/api/conversations", {
            method: "POST",
            body: JSON.stringify({ workspaceId, otherUserId }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.conversation ?? null;
    } catch {
        return null;
    }
}

/**
 * Get message history for a conversation
 */
export async function getDirectMessagesPage(
    conversationId: string,
    cursor?: string
): Promise<{ messages: any[]; hasMore: boolean; nextCursor: string | null }> {
    try {
        const query = new URLSearchParams({ limit: "30" });
        if (cursor) query.set("cursor", cursor);
        const res = await apiFetch(
            `/api/conversations/${conversationId}/messages?${query.toString()}`
        );
        if (!res.ok) return { messages: [], hasMore: false, nextCursor: null };
        const data = await res.json();
        return {
            messages: data?.messages ?? [],
            hasMore: data?.hasMore ?? false,
            nextCursor: data?.nextCursor ?? null,
        };
    } catch {
        return { messages: [], hasMore: false, nextCursor: null };
    }
}

export async function getDirectMessages(conversationId: string): Promise<any[]> {
    const page = await getDirectMessagesPage(conversationId);
    return page.messages;
}

/**
 * Send a direct message
 */
export async function sendDirectMessage(conversationId: string, content: string): Promise<any | null> {
    try {
        const res = await apiFetch(`/api/conversations/${conversationId}/messages`, {
            method: "POST",
            body: JSON.stringify({ content }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.message ?? null;
    } catch {
        return null;
    }
}

/**
 * Send typing indicator status
 */
export async function sendTypingIndicator(conversationId: string, isTyping: boolean): Promise<boolean> {
    try {
        const res = await apiFetch(`/api/conversations/${conversationId}/typing`, {
            method: "POST",
            body: JSON.stringify({ isTyping }),
        });
        return res.ok;
    } catch {
        return false;
    }
}


// ─── Activity API ────────────────────────────────────────────────────────────

/**
 * Fetch recent activities for a project
 */
export async function getActivities(workspaceId: string, projectId?: string, onlyMine: boolean = false): Promise<any[]> {
    try {
        const query = new URLSearchParams({ workspaceId });
        if (projectId) query.append("projectId", projectId);
        if (onlyMine) query.append("onlyMine", "true");

        const res = await apiFetch(`/api/activities?${query.toString()}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.activities ?? [];
    } catch (e) {
        console.error("[api] getActivities error:", e);
        return [];
    }
}

/**
 * Fetch personal todos for a member in a workspace
 */
export async function getMySpaceTodos(workspaceId: string): Promise<any[]> {
    try {
        const res = await apiFetch(`/api/myspace?workspaceId=${workspaceId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.todos ?? [];
    } catch (e) {
        console.error("[api] getMySpaceTodos error:", e);
        return [];
    }
}

/**
 * Sync (add/toggle/delete) personal todos for the member in the workspace
 */
export async function syncMySpaceTodos(workspaceId: string, todos: any[]): Promise<any[]> {
    try {
        const res = await apiFetch("/api/myspace", {
            method: "POST",
            body: JSON.stringify({ workspaceId, todos }),
        });
        if (!res.ok) return todos; // fallback to local on fail
        const data = await res.json();
        return data?.todos ?? todos;
    } catch (e) {
        console.error("[api] syncMySpaceTodos error:", e);
        return todos;
    }
}

/**
 * Create a new personal todo in the database (DB generates the ID)
 */
export async function createMySpaceTodo(workspaceId: string, text: string): Promise<any[]> {
    try {
        const res = await apiFetch("/api/myspace", {
            method: "POST",
            body: JSON.stringify({ workspaceId, text }),
        });
        if (!res.ok) {
            const errText = await res.text().catch(() => "No body");
            console.error(`[api] createMySpaceTodo failed with status ${res.status}:`, errText);
            throw new Error(`Failed to create todo (Status ${res.status}): ${errText}`);
        }
        const data = await res.json();
        return data?.todos ?? [];
    } catch (e) {
        console.error("[api] createMySpaceTodo error:", e);
        throw e;
    }
}

/**
 * Toggle completed status of a personal todo in the database
 */
export async function toggleMySpaceTodo(workspaceId: string, todoId: string, completed: boolean): Promise<any[]> {
    try {
        const res = await apiFetch("/api/myspace", {
            method: "POST",
            body: JSON.stringify({ workspaceId, todoId, completed }),
        });
        if (!res.ok) {
            const errText = await res.text().catch(() => "No body");
            console.error(`[api] toggleMySpaceTodo failed with status ${res.status}:`, errText);
            throw new Error(`Failed to toggle todo (Status ${res.status}): ${errText}`);
        }
        const data = await res.json();
        return data?.todos ?? [];
    } catch (e) {
        console.error("[api] toggleMySpaceTodo error:", e);
        throw e;
    }
}

/**
 * Delete a personal todo from the database
 */
export async function deleteMySpaceTodo(workspaceId: string, deleteTodoId: string): Promise<any[]> {
    try {
        const res = await apiFetch("/api/myspace", {
            method: "POST",
            body: JSON.stringify({ workspaceId, deleteTodoId }),
        });
        if (!res.ok) {
            const errText = await res.text().catch(() => "No body");
            console.error(`[api] deleteMySpaceTodo failed with status ${res.status}:`, errText);
            throw new Error(`Failed to delete todo (Status ${res.status}): ${errText}`);
        }
        const data = await res.json();
        return data?.todos ?? [];
    } catch (e) {
        console.error("[api] deleteMySpaceTodo error:", e);
        throw e;
    }
}

// ─── Procurement & Indents API ───────────────────────────────────────────────

/**
 * Fetch all indents for a workspace
 */
export async function getIndentRequestsPage(
    workspaceId: string,
    cursor?: string,
    search?: string
): Promise<{ indents: any[]; hasMore: boolean; nextCursor: string | null }> {
    try {
        const query = new URLSearchParams({ workspaceId, limit: "25" });
        if (cursor) query.set("cursor", cursor);
        if (search) query.set("search", search);
        const res = await apiFetch(`/api/procurement/indents?${query.toString()}`);
        if (!res.ok) {
            return { indents: [], hasMore: false, nextCursor: null };
        }
        const data = await res.json();
        return {
            indents: data?.indents ?? [],
            hasMore: data?.hasMore ?? false,
            nextCursor: data?.nextCursor ?? null,
        };
    } catch (e) {
        console.error("[api] getIndentRequests error:", e);
        return { indents: [], hasMore: false, nextCursor: null };
    }
}

export async function getIndentRequests(workspaceId: string): Promise<any[]> {
    const page = await getIndentRequestsPage(workspaceId);
    return page.indents;
}

export async function getIndentRequest(
    workspaceId: string,
    indentId: string
): Promise<any | null> {
    try {
        const query = new URLSearchParams({ workspaceId, indentId });
        const res = await apiFetch(`/api/procurement/indents?${query.toString()}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.indent ?? null;
    } catch (error) {
        console.error("[api] getIndentRequest error:", error);
        return null;
    }
}
/**
 * Fetch projects that allow indent procurement
 */
export async function getProcurableProjects(workspaceId: string): Promise<any[]> {
    try {
        const res = await apiFetch(`/api/procurement/procurable-projects?workspaceId=${workspaceId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.projects ?? [];
    } catch (e) {
        console.error("[api] getProcurableProjects error:", e);
        return [];
    }
}

/**
 * Fetch workspace vendors
 */
export async function getVendors(workspaceId: string): Promise<any[]> {
    try {
        const res = await apiFetch(`/api/procurement/vendors?workspaceId=${workspaceId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.vendors ?? [];
    } catch (e) {
        console.error("[api] getVendors error:", e);
        return [];
    }
}

/**
 * Fetch material catalog for auto-completion
 */
export async function getMaterialsCatalog(workspaceId: string): Promise<any[]> {
    try {
        const res = await apiFetch(`/api/procurement/materials?workspaceId=${workspaceId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data?.materials ?? [];
    } catch (e) {
        console.error("[api] getMaterialsCatalog error:", e);
        return [];
    }
}

/**
 * Create a new indent request
 */
export async function createIndent(workspaceId: string, payload: any): Promise<any> {
    const res = await apiFetch(`/api/procurement/indents?workspaceId=${workspaceId}`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || "Failed to create indent request");
    }
    return data;
}

/**
 * Edit an existing indent
 */
export async function editIndent(workspaceId: string, id: string, payload: any): Promise<any> {
    const res = await apiFetch(`/api/procurement/indents/${id}?workspaceId=${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || "Failed to update indent request");
    }
    return data;
}

/**
 * Delete an indent
 */
export async function deleteIndent(workspaceId: string, id: string): Promise<any> {
    const res = await apiFetch(`/api/procurement/indents/${id}?workspaceId=${workspaceId}`, {
        method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || "Failed to delete indent");
    }
    return data;
}

/**
 * Approve requested quantity for an indent line item (Admins only)
 */
export async function approveIndentQuantity(workspaceId: string, itemId: string): Promise<any> {
    const res = await apiFetch(`/api/procurement/items/${itemId}/approve-quantity?workspaceId=${workspaceId}`, {
        method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || "Failed to approve quantity");
    }
    return data;
}

/**
 * Add a vendor quote for an indent line item (Leads/Admins)
 */
export async function addVendorQuote(
    workspaceId: string,
    itemId: string,
    payload: { vendorId: string; unitPrice: number; quantity: number; leadTimeDays?: number; notes?: string }
): Promise<any> {
    const res = await apiFetch(`/api/procurement/items/${itemId}/add-quote?workspaceId=${workspaceId}`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || "Failed to add vendor quote");
    }
    return data;
}

/**
 * Approve a quote for an indent line item (Admins only)
 */
export async function approveQuote(workspaceId: string, itemId: string, quoteId: string): Promise<any> {
    const res = await apiFetch(`/api/procurement/items/${itemId}/approve-quote?workspaceId=${workspaceId}`, {
        method: "POST",
        body: JSON.stringify({ quoteId }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || "Failed to approve quote");
    }
    return data;
}

/**
 * Reject an indent line item (Admins only)
 */
export async function rejectIndentLineItem(workspaceId: string, itemId: string, reason: string): Promise<any> {
    const res = await apiFetch(`/api/procurement/items/${itemId}/reject?workspaceId=${workspaceId}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || "Failed to reject item");
    }
    return data;
}
