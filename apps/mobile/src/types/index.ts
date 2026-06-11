/**
 * Trava Mobile Type Definitions
 */

// ─── Component Props ─────────────────────────────────────────────────────────

import { SharedValue } from "react-native-reanimated";

export interface User {
    id: string;
    email: string;
    name: string;
    displayName?: string;
    image?: string;
    surname?: string;
    phoneNumber?: string;
    jobTitle?: string;
    emailVerified: boolean;
    createdAt?: string;
}

export interface UserProfile {
    success: boolean;
    user: User;
    stats: {
        totalTasks: number;
        completedTasks: number;
        experienceDays: number;
        completionRate: number;
    };
}

export interface Session {
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
}

export interface AuthResponse {
    user: User;
    session: Session;
    token?: string;
}

export interface Workspace {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    workspaceRole?: string;
    isProjectManager?: boolean;
}

export interface Project {
    id: string;
    name: string;
    workspaceId: string;
    color?: string;
    description?: string;
    canManageMembers?: boolean;
    projectManagers?: Array<{
        id: string;
        name: string;
        surname?: string;
        image?: string;
        email?: string;
        projectRole?: string;
    }>;
}

export interface WorkspaceMember {
    id: string;
    workspaceId: string;
    userId: string;
    workspaceRole: string;
    user: {
        id: string;
        name: string;
        email: string;
        image?: string;
        surname?: string;
    };
}

export type TaskStatus = "TO_DO" | "IN_PROGRESS" | "REVIEW" | "HOLD" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface Task {
    id: string;
    name: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    startDate?: string;
    dueDate?: string;
    projectId: string;
    workspaceId: string;
    parentTaskId: string | null;
    isParent: boolean;
    tagId?: string;
    assigneeId?: string;
    reviewerId?: string;
    assignee?: {
        id: string;
        name: string;
        surname: string;
    };
    reviewer?: {
        id: string;
        name: string;
        surname: string;
    };
    tag?: {
        name: string;
    };
    tags?: Array<{
        id: string;
        name: string;
    }>;
    project?: {
        name: string;
        color?: string;
    };
    subTasks?: Task[];
    parentTask?: {
        id: string;
        name: string;
    };
    commentCount?: number;
    subtaskCount?: number;
    completedSubtaskCount?: number;
    _count?: {
        Activity: number;
        subTasks: number;
    };
    createdAt?: string;
    position?: number;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
    Landing: undefined;
    HelpCenter: undefined;
    SignIn: undefined;
    SignUp: undefined;
    ForgotPassword: { email?: string } | undefined;
    Main: undefined;
    Notifications: undefined;
    AI: undefined;
    ProjectDetail: {
        projectId: string;
        projectName: string;
        projectColor?: string;
        initialTab?: string;
    };
    ProjectSubTasks: {
        parentId: string;
        parentName: string;
        projectId: string;
    };
    TaskDetail: {
        taskId: string;
        taskName: string;
        openMessages?: boolean;
        notificationTitle?: string;
        notificationBody?: string;
        isSubtask?: boolean;
        taskData?: any;
    };
    ManageTags: undefined;
    ChangePassword: undefined;
    MyProfile: undefined;
    TeamList: undefined;
    MySpace: undefined;
    DirectChat: {
        conversationId?: string;
        otherUserId: string;
        otherUserName: string;
        otherUserRole?: string;
    };
    Procurement: undefined;
    CreateIndent: {
        indent?: any;
    };
    IndentDetail: {
        indentId: string;
    };
};

export type MainTabParamList = {
    Home: undefined | { screen: string };
    Projects: undefined | { screen: string };
    Attendance: undefined | { screen: string };
    Profile: undefined | { screen: string };
    Board: undefined;
    MyTasks: undefined;
    Create: undefined;
};

export interface RadialMenuProps {
    visible: boolean;
    type: string;
    onClose: () => void;
    onAction: (id: string) => void;
}

export interface RadialActionItem {
    id: string;
    label: string;
    icon: any;
    color: string;
}

export interface DirectMessage {
    id: string;
    content: string;
    createdAt: string;
    userId: string;
    user: {
        id: string;
        name: string;
        surname?: string;
        image?: string;
    };
}

export interface Conversation {
    id: string;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
    participants: User[];
    messages: DirectMessage[];
}

export interface LeaveBalance {
    casualLeaveBalance: number;
    sickLeaveBalance: number;
    accruedDaysCount: number;
    casualLeaveAccrualDays: number;
    reportingManager?: string;
}

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";
export type LeaveType = "CASUAL" | "SICK";

export interface LeaveRequest {
    id: string;
    workspaceId: string;
    workspaceMemberId: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: LeaveStatus;
    type: LeaveType;
    createdAt: string;
    WorkspaceMember: {
        id: string;
        casualLeaveBalance: number;
        sickLeaveBalance: number;
        user: {
            name: string;
            surname?: string;
            email: string;
            image?: string;
        };
    };
}
