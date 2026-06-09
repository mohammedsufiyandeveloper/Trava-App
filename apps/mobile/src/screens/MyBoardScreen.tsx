import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Platform, Modal, Dimensions, TouchableWithoutFeedback, LayoutAnimation, UIManager, TextInput, Animated, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";

// View components
import TaskFilterSheet from "../components/TaskFilterSheet";
import ProjectGanttView from "./project/ProjectGanttView";
import CreateSubTaskModal from "../components/CreateSubTaskModal";
import StatusPickerModal from "../components/StatusPickerModal";
import ReviewCommentModal from "../components/ReviewCommentModal";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace, DEFAULT_FILTERS } from "../context/WorkspaceContext";
import { getTasks, getTasksCount, getCachedSession, updateTask } from "../services/api";
import { Task, User } from "../types";
import { getStatusHex, getStatusBgColor } from "../utils/taskColors";
import { useResponsive } from "../hooks/useResponsive";


const { width: SCREEN_W } = Dimensions.get("window");
const NAME_W = 210;  // frozen task-name column width
const COL_H = 36;
const SEC_H = 34;
const ROW_H = 58;

const COLS = [
    { key: "status", label: "STATUS", w: 100 },
    { key: "start", label: "START", w: 74 },
    { key: "due", label: "DUE", w: 74 },
    { key: "assignee", label: "ASSIGNEE", w: 105 },
    { key: "reviewer", label: "REVIEWER", w: 105 },
    { key: "urgency", label: "DEADLINE", w: 88 },
    { key: "tag", label: "TAG", w: 92 },
];
const DATA_W = COLS.reduce((a, c) => a + c.w, 0);
const TOTAL_W = NAME_W + DATA_W;

interface Section { key: string; title: string; color: string; data: Task[] }

function groupTasks(tasks: Task[]): Section[] {
    if (tasks.length === 0) return [];

    // Sort tasks: Overdue first, then by due date, then no date
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const t = now.getTime();

    const sorted = [...tasks].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return [{
        key: "all",
        title: "SUBTASKS",
        color: "#8b5cf6",
        data: sorted
    }];
}


// SC is replaced by getStatusHex and getStatusBgColor from taskColors utility
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString([], { month: "short", day: "numeric" }) : "—";

function getUrg(due?: string) {
    if (!due) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const d = new Date(due); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d late`, color: "#ef4444" };
    if (diff === 0) return { text: "Today", color: "#f59e0b" };
    if (diff <= 3) return { text: `${diff}d left`, color: "#3b82f6" };
    return { text: `${diff} days`, color: "#9ca3af" };
}

export default function MyBoardScreen() {
    const { colors, isDark } = useTheme();
    const { activeWorkspace, projects, workspaces, tags, refreshData } = useWorkspace();
    const nav = useNavigation<any>();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [viewMode, setViewMode] = useState<"List" | "Kanban" | "Gantt">("List");
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [filterVisible, setFilterVisible] = useState(false);
    const [createSubTaskVisible, setCreateSubTaskVisible] = useState(false);
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [ownerViewMode, setOwnerViewMode] = useState<"Universal" | "Personal">("Universal");

    // Kanban status picker states
    const [statusPickerVisible, setStatusPickerVisible] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);

    // Cursor-based pagination state (List view)
    const [hasMore, setHasMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<{ id: string; createdAt: string } | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [totalCount, setTotalCount] = useState<number | null>(null);

    // Per-column Kanban pagination state
    const KANBAN_STATUSES = ["TO_DO", "IN_PROGRESS", "REVIEW", "COMPLETED", "HOLD", "CANCELLED"] as const;
    type KanbanStatus = typeof KANBAN_STATUSES[number];
    interface KanbanColState {
        tasks: Task[];
        hasMore: boolean;
        nextCursor: { id: string; createdAt: string } | null;
        loadingMore: boolean;
        initialized: boolean;
        totalCount: number | null;
    }
    const initKanbanCols = (): Record<KanbanStatus, KanbanColState> =>
        Object.fromEntries(KANBAN_STATUSES.map(s => [s, { tasks: [], hasMore: false, nextCursor: null, loadingMore: false, initialized: false, totalCount: null }])) as any;
    const [kanbanCols, setKanbanCols] = useState<Record<KanbanStatus, KanbanColState>>(initKanbanCols);
    const [kanbanRefreshing, setKanbanRefreshing] = useState(false);

    // Dedicated state for Gantt view
    const [ganttTasks, setGanttTasks] = useState<Task[]>([]);
    const [ganttLoading, setGanttLoading] = useState(true);
    const [ganttRefreshing, setGanttRefreshing] = useState(false);

    const shimmerAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        let animation: Animated.CompositeAnimation | null = null;
        if (loading && !refreshing) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(shimmerAnim, {
                        toValue: 1.0,
                        duration: 850,
                        useNativeDriver: true,
                    }),
                    Animated.timing(shimmerAnim, {
                        toValue: 0.3,
                        duration: 850,
                        useNativeDriver: true,
                    })
                ])
            );
            animation.start();
        } else {
            shimmerAnim.setValue(0.3);
        }
        return () => {
            if (animation) {
                animation.stop();
            }
        };
    }, [loading, refreshing, shimmerAnim]);

    const ShimmerBlock = useCallback(({ width, height, borderRadius = 4, style }: { width: any; height: any; borderRadius?: number; style?: any }) => (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: isDark ? "#ffffff12" : "#e5e7eb",
                    opacity: shimmerAnim,
                },
                style,
            ]}
        />
    ), [isDark, shimmerAnim]);


    const isWorkspaceAdmin = useMemo(() => {
        const wsFromList = workspaces.find(w => w.id === activeWorkspace?.id);
        const role = activeWorkspace?.workspaceRole || (activeWorkspace as any)?.role || wsFromList?.workspaceRole || (wsFromList as any)?.role;

        const wsOwnerId = activeWorkspace?.ownerId || wsFromList?.ownerId;
        const currentUserId = currentUser?.id;

        // Comprehensive check: role string or being the workspace owner
        const isOwner = !!(wsOwnerId && currentUserId && wsOwnerId === currentUserId);
        const isAdmin = role === "ADMIN" || role === "OWNER";

        return isAdmin || isOwner;
    }, [activeWorkspace, workspaces, currentUser]);
    const { globalFilters, setGlobalFilters } = useWorkspace();
    const headerScrollRef = useRef<ScrollView>(null);
    const dataScrollRef = useRef<ScrollView>(null);
    const headerSkeletonScrollRef = useRef<ScrollView>(null);
    const dataSkeletonScrollRef = useRef<ScrollView>(null);

    const filters = globalFilters;
    const activeFilterCount = Object.values(filters).filter(v => Array.isArray(v) ? v.length > 0 : !!v).length;

    const managedProjectIds = useMemo(() => {
        if (!currentUser) return [];
        return projects
            .filter(p => p.projectManagers?.some(m => m.id === currentUser.id))
            .map(p => p.id);
    }, [projects, currentUser]);

    useEffect(() => {
        const loadUser = async () => {
            const session = await getCachedSession();
            if (session?.user) setCurrentUser(session.user);
        };
        loadUser();
    }, []);

    const fetchData = useCallback(async (isRefresh = false, cursor?: { id: string; createdAt: string } | null) => {
        if (!activeWorkspace) return;
        if (!currentUser) return;

        const isFirstPage = !cursor;

        if (isFirstPage) {
            if (isRefresh) setRefreshing(true); else setLoading(true);
        }

        try {
            if (activeWorkspace) {
                const isPM = managedProjectIds.length > 0;
                const isMyTasksMode = ownerViewMode === "Personal";

                const PAGE_SIZE = 15;

                // Build common filter params for both data and count
                const buildFilters = (extra: object = {}) => ({
                    ...filters,
                    onlySubtasks: true,
                    limit: PAGE_SIZE,
                    cursor: cursor ?? undefined,
                    ...extra,
                });

                const buildCountFilters = (extra: object = {}) => ({
                    ...filters,
                    onlySubtasks: true,
                    ...extra,
                });

                let result: { tasks: Task[]; hasMore: boolean; nextCursor: { id: string; createdAt: string } | null };
                let count = 0;

                if (isMyTasksMode) {
                    const assigneeFilter = { assigneeId: currentUser.id ? [currentUser.id] : undefined };
                    if (isFirstPage) {
                        [result, count] = await Promise.all([
                            getTasks(activeWorkspace.id, buildFilters(assigneeFilter)),
                            getTasksCount(activeWorkspace.id, buildCountFilters(assigneeFilter)),
                        ]);
                    } else {
                        result = await getTasks(activeWorkspace.id, buildFilters(assigneeFilter));
                    }
                } else if (isWorkspaceAdmin) {
                    if (isFirstPage) {
                        [result, count] = await Promise.all([
                            getTasks(activeWorkspace.id, buildFilters()),
                            getTasksCount(activeWorkspace.id, buildCountFilters()),
                        ]);
                    } else {
                        result = await getTasks(activeWorkspace.id, buildFilters());
                    }
                } else if (isPM) {
                    // PM mode: merge managed + assigned (paginate each, dedupe)
                    const selectedProjectIds = filters.projectId && filters.projectId.length > 0 ? filters.projectId : null;
                    const pmManagedProjectIds = selectedProjectIds
                        ? managedProjectIds.filter(id => selectedProjectIds.includes(id))
                        : managedProjectIds;

                    const managedFilter = { projectId: pmManagedProjectIds };
                    const assigneeFilter = {
                        assigneeId: currentUser.id ? [currentUser.id] : undefined,
                        projectId: selectedProjectIds || undefined
                    };

                    if (isFirstPage) {
                        const [managedResult, assignedResult, managedCount, assignedCount] = await Promise.all([
                            pmManagedProjectIds.length > 0
                                ? getTasks(activeWorkspace.id, buildFilters(managedFilter))
                                : Promise.resolve({ tasks: [], hasMore: false, nextCursor: null }),
                            getTasks(activeWorkspace.id, buildFilters(assigneeFilter)),
                            pmManagedProjectIds.length > 0
                                ? getTasksCount(activeWorkspace.id, buildCountFilters(managedFilter))
                                : Promise.resolve(0),
                            getTasksCount(activeWorkspace.id, buildCountFilters(assigneeFilter)),
                        ]);
                        const seen = new Set<string>();
                        const merged: Task[] = [];
                        for (const t of [...(managedResult?.tasks || []), ...assignedResult.tasks]) {
                            if (!seen.has(t.id)) { seen.add(t.id); merged.push(t); }
                        }
                        result = {
                            tasks: merged.slice(0, PAGE_SIZE),
                            hasMore: (managedResult?.hasMore || false) || assignedResult.hasMore,
                            nextCursor: (managedResult?.nextCursor || null) || assignedResult.nextCursor,
                        };
                        count = managedCount;
                    } else {
                        const [managedResult, assignedResult] = await Promise.all([
                            pmManagedProjectIds.length > 0
                                ? getTasks(activeWorkspace.id, buildFilters(managedFilter))
                                : Promise.resolve({ tasks: [], hasMore: false, nextCursor: null }),
                            getTasks(activeWorkspace.id, buildFilters(assigneeFilter)),
                        ]);
                        const seen = new Set<string>();
                        const merged: Task[] = [];
                        for (const t of [...(managedResult?.tasks || []), ...assignedResult.tasks]) {
                            if (!seen.has(t.id)) { seen.add(t.id); merged.push(t); }
                        }
                        result = {
                            tasks: merged.slice(0, PAGE_SIZE),
                            hasMore: (managedResult?.hasMore || false) || assignedResult.hasMore,
                            nextCursor: (managedResult?.nextCursor || null) || assignedResult.nextCursor,
                        };
                    }
                } else {
                    const assigneeFilter = { assigneeId: currentUser.id ? [currentUser.id] : undefined };
                    if (isFirstPage) {
                        [result, count] = await Promise.all([
                            getTasks(activeWorkspace.id, buildFilters(assigneeFilter)),
                            getTasksCount(activeWorkspace.id, buildCountFilters(assigneeFilter)),
                        ]);
                    } else {
                        result = await getTasks(activeWorkspace.id, buildFilters(assigneeFilter));
                    }
                }

                if (isFirstPage) {
                    setTasks(result.tasks);
                    setTotalCount(count);
                } else {
                    setTasks(prev => {
                        const seen = new Set(prev.map(t => t.id));
                        const newTasks = result.tasks.filter(t => !seen.has(t.id));
                        return [...prev, ...newTasks];
                    });
                }
                setHasMore(result.hasMore);
                setNextCursor(result.nextCursor);
            }
        } catch (e) { console.error(e); }
        finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeWorkspace?.id, isWorkspaceAdmin, managedProjectIds, filters, ownerViewMode, currentUser]);

    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore || !nextCursor) return;
        setLoadingMore(true);
        try {
            await fetchData(false, nextCursor);
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, nextCursor, fetchData]);

    // ── Per-column Kanban fetch ──────────────────────────────────────────────
    const fetchKanbanColumn = useCallback(async (status: KanbanStatus, reset = false) => {
        if (!activeWorkspace || !currentUser) return;

        setKanbanCols(prev => ({
            ...prev,
            [status]: { ...prev[status], loadingMore: !reset, initialized: !reset ? prev[status].initialized : false }
        }));

        const cursor = reset ? undefined : (kanbanCols[status].nextCursor ?? undefined);
        const KANBAN_PAGE = 10;

        const isPM = managedProjectIds.length > 0;
        const isMyTasksMode = ownerViewMode === "Personal";

        const baseFilters: Parameters<typeof getTasks>[1] = {
            ...filters,
            onlySubtasks: true,
            status: [status],
            limit: KANBAN_PAGE,
            cursor: cursor ?? undefined,
        };

        try {
            let result: { tasks: Task[]; hasMore: boolean; nextCursor: { id: string; createdAt: string } | null };
            let columnTotal = 0;

            if (isMyTasksMode) {
                const assigneeFilter = { assigneeId: currentUser.id ? [currentUser.id] : undefined };
                const countFilters = { ...filters, onlySubtasks: true, status: [status], ...assigneeFilter };
                [result, columnTotal] = await Promise.all([
                    getTasks(activeWorkspace.id, { ...baseFilters, ...assigneeFilter }),
                    reset ? getTasksCount(activeWorkspace.id, countFilters) : Promise.resolve(kanbanCols[status].totalCount ?? 0),
                ]);
            } else if (isWorkspaceAdmin) {
                const countFilters = { ...filters, onlySubtasks: true, status: [status] };
                [result, columnTotal] = await Promise.all([
                    getTasks(activeWorkspace.id, baseFilters),
                    reset ? getTasksCount(activeWorkspace.id, countFilters) : Promise.resolve(kanbanCols[status].totalCount ?? 0),
                ]);
            } else if (isPM) {
                const selectedProjectIds = filters.projectId && filters.projectId.length > 0 ? filters.projectId : null;
                const pmManagedProjectIds = selectedProjectIds
                    ? managedProjectIds.filter(id => selectedProjectIds.includes(id))
                    : managedProjectIds;

                const managedFilter = { projectId: pmManagedProjectIds };
                const assigneeFilter = {
                    assigneeId: currentUser.id ? [currentUser.id] : undefined,
                    projectId: selectedProjectIds || undefined
                };

                const [managed, assigned, managedCount] = await Promise.all([
                    pmManagedProjectIds.length > 0
                        ? getTasks(activeWorkspace.id, { ...baseFilters, ...managedFilter })
                        : Promise.resolve({ tasks: [], hasMore: false, nextCursor: null }),
                    getTasks(activeWorkspace.id, { ...baseFilters, ...assigneeFilter }),
                    (reset && pmManagedProjectIds.length > 0)
                        ? getTasksCount(activeWorkspace.id, { ...filters, onlySubtasks: true, status: [status], ...managedFilter })
                        : Promise.resolve(kanbanCols[status].totalCount ?? 0),
                ]);
                const seen = new Set<string>();
                const merged: Task[] = [];
                for (const t of [...(managed?.tasks || []), ...assigned.tasks]) {
                    if (!seen.has(t.id)) { seen.add(t.id); merged.push(t); }
                }
                result = { tasks: merged, hasMore: (managed?.hasMore || false) || assigned.hasMore, nextCursor: (managed?.nextCursor || null) || assigned.nextCursor };
                columnTotal = managedCount;
            } else {
                const assigneeFilter = { assigneeId: currentUser.id ? [currentUser.id] : undefined };
                const countFilters = { ...filters, onlySubtasks: true, status: [status], ...assigneeFilter };
                [result, columnTotal] = await Promise.all([
                    getTasks(activeWorkspace.id, { ...baseFilters, ...assigneeFilter }),
                    reset ? getTasksCount(activeWorkspace.id, countFilters) : Promise.resolve(kanbanCols[status].totalCount ?? 0),
                ]);
            }

            setKanbanCols(prev => ({
                ...prev,
                [status]: {
                    tasks: reset ? result.tasks.filter(t => !t.isParent) : [...prev[status].tasks, ...result.tasks.filter(t => !t.isParent && !prev[status].tasks.find(p => p.id === t.id))],
                    hasMore: result.hasMore,
                    nextCursor: result.nextCursor,
                    loadingMore: false,
                    initialized: true,
                    totalCount: reset ? columnTotal : prev[status].totalCount,
                }
            }));
        } catch (e) {
            console.error(`[Kanban] Failed to fetch column ${status}:`, e);
            setKanbanCols(prev => ({ ...prev, [status]: { ...prev[status], loadingMore: false, initialized: true } }));
        }
    }, [activeWorkspace, currentUser, isWorkspaceAdmin, managedProjectIds, ownerViewMode, filters, kanbanCols]);

    const refreshKanbanCols = useCallback(async () => {
        setKanbanRefreshing(true);
        await Promise.all(KANBAN_STATUSES.map(s => fetchKanbanColumn(s, true)));
        setKanbanRefreshing(false);
    }, [fetchKanbanColumn]);

    const handleLongPress = (task: Task) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedTask(task);
        setStatusPickerVisible(true);
    };

    const handleStatusUpdate = async (taskId: string, newStatus: string, comment?: string, attachmentData?: any) => {
        const fromStatus = selectedTask?.status;
        const toStatus = newStatus;

        // Transitions that REQUIRE a popup (comment/attachment)
        const isMovingToReview = toStatus === "REVIEW";
        const isMovingFromReviewToOthers = fromStatus === "REVIEW" && toStatus !== "COMPLETED";
        const isMovingFromTodoToSpecial = fromStatus === "TO_DO" && (toStatus === "HOLD" || toStatus === "CANCELLED");
        const isMovingFromInProgress = fromStatus === "IN_PROGRESS" && (toStatus === "TO_DO" || toStatus === "REVIEW" || toStatus === "HOLD" || toStatus === "CANCELLED");
        const isMovingFromCompleted = fromStatus === "COMPLETED" && toStatus !== "COMPLETED";
        const isMovingFromHoldOrCancelled = (fromStatus === "HOLD" || fromStatus === "CANCELLED") && toStatus !== fromStatus;

        if ((isMovingToReview || isMovingFromReviewToOthers || isMovingFromTodoToSpecial || isMovingFromInProgress || isMovingFromCompleted || isMovingFromHoldOrCancelled) && !comment && !attachmentData) {
            setPendingStatus(newStatus);
            setReviewModalVisible(true);
            setStatusPickerVisible(false);
            return;
        }

        try {
            const updateData: any = { status: newStatus };
            if (comment) updateData.comment = comment;
            if (attachmentData) updateData.attachmentData = attachmentData;

            // Optimistic update local tasks
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));

            await updateTask(taskId, updateData);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Re-fetch active view data
            if (viewMode === "List") {
                fetchData(true);
            } else if (viewMode === "Kanban") {
                refreshKanbanCols();
            } else if (viewMode === "Gantt") {
                fetchGanttData(true);
            }

            setReviewModalVisible(false);
            setPendingStatus(null);
        } catch (error: any) {
            console.error("Error updating task status:", error);
            if (viewMode === "List") fetchData(true);
            else if (viewMode === "Kanban") refreshKanbanCols();
            else if (viewMode === "Gantt") fetchGanttData(true);
            Alert.alert("Access Denied", error.message || "Failed to update status. Please try again.");
        }
    };

    const handleReviewSubmit = async (comment: string, attachmentData?: any) => {
        if (selectedTask && pendingStatus) {
            await handleStatusUpdate(selectedTask.id, pendingStatus, comment, attachmentData);
        }
    };

    const fetchGanttData = useCallback(async (isRefresh = false) => {
        if (!activeWorkspace || !currentUser) return;

        if (isRefresh) {
            setGanttRefreshing(true);
        } else {
            setGanttLoading(true);
        }

        try {
            const isPM = managedProjectIds.length > 0;
            const isMyTasksMode = ownerViewMode === "Personal";
            const GANTT_LIMIT = 150; // generous limit for Gantt chart to show all workspace tasks

            const buildGanttFilters = (extra: object = {}) => ({
                ...filters,
                hierarchyMode: "parents" as const,
                limit: GANTT_LIMIT,
                ...extra,
            });

            let result: { tasks: Task[]; hasMore: boolean; nextCursor: any };

            if (isMyTasksMode) {
                const assigneeFilter = { assigneeId: currentUser.id ? [currentUser.id] : undefined };
                result = await getTasks(activeWorkspace.id, buildGanttFilters(assigneeFilter));
            } else if (isWorkspaceAdmin) {
                result = await getTasks(activeWorkspace.id, buildGanttFilters());
            } else if (isPM) {
                // PM mode: merge managed + assigned
                const selectedProjectIds = filters.projectId && filters.projectId.length > 0 ? filters.projectId : null;
                const pmManagedProjectIds = selectedProjectIds
                    ? managedProjectIds.filter(id => selectedProjectIds.includes(id))
                    : managedProjectIds;

                const managedFilter = { projectId: pmManagedProjectIds };
                const assigneeFilter = {
                    assigneeId: currentUser.id ? [currentUser.id] : undefined,
                    projectId: selectedProjectIds || undefined
                };

                const [managedResult, assignedResult] = await Promise.all([
                    pmManagedProjectIds.length > 0
                        ? getTasks(activeWorkspace.id, buildGanttFilters(managedFilter))
                        : Promise.resolve({ tasks: [], hasMore: false, nextCursor: null }),
                    getTasks(activeWorkspace.id, buildGanttFilters(assigneeFilter)),
                ]);
                const seen = new Set<string>();
                const merged: Task[] = [];
                for (const t of [...(managedResult?.tasks || []), ...assignedResult.tasks]) {
                    if (!seen.has(t.id)) {
                        seen.add(t.id);
                        merged.push(t);
                    }
                }
                result = {
                    tasks: merged.slice(0, GANTT_LIMIT),
                    hasMore: (managedResult?.hasMore || false) || assignedResult.hasMore,
                    nextCursor: (managedResult?.nextCursor || null) || assignedResult.nextCursor,
                };
            } else {
                const assigneeFilter = { assigneeId: currentUser.id ? [currentUser.id] : undefined };
                result = await getTasks(activeWorkspace.id, buildGanttFilters(assigneeFilter));
            }

            setGanttTasks(result.tasks);
        } catch (e) {
            console.error("[Gantt] Failed to fetch Gantt tasks:", e);
        } finally {
            setGanttLoading(false);
            setGanttRefreshing(false);
        }
    }, [activeWorkspace?.id, isWorkspaceAdmin, managedProjectIds, filters, ownerViewMode, currentUser]);

    // Unified layout synchronization effect
    useEffect(() => {
        if (!activeWorkspace || !currentUser) return;

        if (viewMode === "List") {
            fetchData();
        } else if (viewMode === "Kanban") {
            refreshKanbanCols();
        } else if (viewMode === "Gantt") {
            fetchGanttData();
        }
    }, [viewMode, activeWorkspace?.id, currentUser?.id, filters, ownerViewMode]);

    // Reset filters when the tab is switched/blurred
    useEffect(() => {
        const tabNavigation = nav.getParent();
        if (tabNavigation) {
            const unsubscribe = tabNavigation.addListener("blur", () => {
                console.log("[MyBoardScreen] Tab blurred. Resetting global filters...");
                setGlobalFilters(DEFAULT_FILTERS);
            });
            return unsubscribe;
        }
    }, [nav, setGlobalFilters]);

    const sections = useMemo(() => {
        // Show all tasks that are not parent containers (actual work items)
        const subTasksOnly = tasks.filter(t => !t.isParent);
        return groupTasks(subTasksOnly);
    }, [tasks]);

    const toggle = (k: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsed(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
    };

    const projName = "All Projects";
    const projColor = colors.primary;

    // ── Cell ──────────────────────────────────────────────────────────────────
    const Cell = ({ task, col }: { task: Task; col: typeof COLS[0] }) => {
        const sc = getStatusHex(task.status);
        const bg = getStatusBgColor(task.status);
        const urg = getUrg(task.dueDate);
        switch (col.key) {
            case "status": return (
                <View style={[s.badge, { backgroundColor: bg }]}>
                    <Text style={[s.badgeTxt, { color: sc }]} numberOfLines={1}>{task.status.replace("_", " ")}</Text>
                </View>
            );
            case "start": return <Text style={[s.dateTxt, { color: colors.text }]}>{fmtDate(task.startDate)}</Text>;
            case "due": return <Text style={[s.dateTxt, { color: colors.text, fontWeight: "700" }]}>{fmtDate(task.dueDate)}</Text>;
            case "assignee": return task.assignee ? (
                <View style={s.mem}><View style={[s.av, { backgroundColor: colors.surfaceHighlight }]}><Text style={[s.avTxt, { color: colors.text }]}>{(task.assignee.surname?.[0] || task.assignee.name[0]).toUpperCase()}</Text></View><Text style={[s.memTxt, { color: colors.text }]} numberOfLines={1}>{task.assignee.surname ? task.assignee.surname.split(" ")[0] : task.assignee.name}</Text></View>
            ) : <Text style={[s.dash, { color: colors.textDim }]}>—</Text>;
            case "reviewer": return task.reviewer ? (
                <View style={s.mem}><View style={[s.av, { backgroundColor: colors.surfaceHighlight }]}><Text style={[s.avTxt, { color: colors.text }]}>{(task.reviewer.surname?.[0] || task.reviewer.name[0]).toUpperCase()}</Text></View><Text style={[s.memTxt, { color: colors.text }]} numberOfLines={1}>{task.reviewer.surname ? task.reviewer.surname.split(" ")[0] : task.reviewer.name}</Text></View>
            ) : <Text style={[s.dash, { color: colors.textDim }]}>—</Text>;
            case "urgency": return urg ? (
                <View style={[s.urgB, { backgroundColor: urg.color + "18" }]}><View style={[s.urgDot, { backgroundColor: urg.color }]} /><Text style={[s.urgTxt, { color: urg.color }]}>{urg.text}</Text></View>
            ) : <Text style={[s.dash, { color: colors.textDim }]}>—</Text>;
            case "tag": {
                // Check multiple potential tag sources, prioritized by normalized data
                const tagObj = task.tag || (Array.isArray(task.tags) && task.tags[0]) || (task as any).Tag || (task as any).taskTag || (Array.isArray((task as any).tags) ? (task as any).tags[0] : null);
                const tagId = task.tagId || (tagObj && typeof tagObj === 'object' ? tagObj.id : null);

                const tagName = (typeof tagObj === 'string' ? tagObj : null) ||
                    (tagObj && typeof tagObj === 'object' ? tagObj.name : null) ||
                    (tagId ? tags.find(t => String(t.id) === String(tagId))?.name : null) ||
                    (task as any).tagName;

                return tagName ? (
                    <View style={[s.tagB, { backgroundColor: colors.surfaceHighlight }]}>
                        <Text style={[s.tagTxt, { color: colors.textDim }]} numberOfLines={1} adjustsFontSizeToFit>{tagName}</Text>
                    </View>
                ) : <Text style={[s.dash, { color: colors.textDim }]}>—</Text>;
            }
            default: return null;
        }
    };

    // ── Name column cell (frozen, rendered absolutely) ────────────────────────
    const NameCol = () => (
        <View pointerEvents="box-none">
            {sections.map(section => (
                <View key={section.key} pointerEvents="box-none">
                    {/* Section header (frozen side) */}
                    <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center' }} pointerEvents="box-none">
                        <TouchableOpacity
                            style={[s.secFrozen, { width: NAME_W, height: SEC_H, backgroundColor: colors.background, borderBottomColor: colors.border }]}
                            onPress={() => toggle(section.key)} activeOpacity={0.7}
                        >
                            <Text style={[s.secTitle, { color: colors.text }]}>{section.title}</Text>
                            <View style={s.secBadge}>
                                <Text style={[s.secBadgeTxt, { color: colors.textDim }]}>
                                    {section.key === sections[0]?.key && totalCount !== null
                                        ? totalCount
                                        : section.data.length}
                                </Text>
                            </View>
                            <Ionicons name={collapsed.has(section.key) ? "chevron-forward" : "chevron-down"} size={12} color={colors.textDim} style={{ marginLeft: "auto" }} />
                        </TouchableOpacity>

                        {/* Add icon on the far right of the screen */}
                        <View style={{ flex: 1, height: SEC_H, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingRight: SPACING.md }} pointerEvents="box-none">
                            <TouchableOpacity
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCreateSubTaskVisible(true); }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="add" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {/* Name cells */}
                    {!collapsed.has(section.key) && section.data.map(task => {
                        const sc = getStatusHex(task.status);
                        return (
                            <TouchableOpacity
                                key={task.id}
                                style={[s.nameCell, { width: NAME_W, height: ROW_H, backgroundColor: colors.background, borderBottomColor: colors.border }]}
                                activeOpacity={0.65}
                                onPress={() => nav.navigate("TaskDetail", { taskId: task.id, taskName: task.name })}
                            >
                                <View style={{ flex: 1 }}>
                                    {(task.project?.name || task.parentTask?.name) ? (
                                        <Text
                                            style={{ fontSize: 10, fontWeight: "500", color: colors.textDim }}
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                        >
                                            {task.project?.name ? (
                                                <Text>
                                                    <Text style={{ color: task.project.color || colors.textDim, fontSize: 9 }}>●</Text>
                                                    {` ${task.project.name}`}
                                                </Text>
                                            ) : null}
                                            {task.parentTask?.name ? (
                                                <Text>
                                                    {task.project?.name ? " / " : ""}
                                                    {task.parentTask.name}
                                                </Text>
                                            ) : null}
                                        </Text>
                                    ) : null}
                                    <Text
                                        style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginTop: (task.project?.name || task.parentTask?.name) ? 2 : 0 }}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {task.name}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ))}
            {/* Infinite Scroll loading indicator */}
            {hasMore && loadingMore && (
                <View
                    style={{
                        paddingVertical: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: NAME_W,
                    }}
                >
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            )}
            <View style={{ height: 20 }} pointerEvents="none" />
        </View>
    );

    const renderListSkeleton = () => {
        const rows = [1, 2, 3, 4, 5, 6];
        return (
            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                {/* STATIC HEADER ROW (Vertically static, horizontally synced) */}
                <View style={{ height: COL_H, zIndex: 100 }}>
                    <ScrollView
                        ref={headerSkeletonScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        scrollEnabled={false}
                        bounces={false}
                    >
                        <View style={{ width: TOTAL_W, height: COL_H }}>
                            <View style={[s.colHRow, { height: COL_H, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                                <View style={{ width: NAME_W }} />
                                {COLS.map(col => (
                                    <View key={col.key} style={[s.colHCell, { width: col.w, borderRightColor: colors.border }]}>
                                        <Text style={[s.colHTxt, { color: colors.textDim }]}>{col.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </ScrollView>
                    {/* Frozen Header (Top Left Corner) */}
                    <View style={[s.frozenHeader, { width: NAME_W, height: COL_H, backgroundColor: colors.surface, borderBottomColor: colors.border, borderRightColor: colors.border }]}>
                        <Text style={[s.colHTxt, { color: colors.textDim }]}>TASK NAME</Text>
                    </View>
                </View>

                {/* SCROLLABLE CONTENT */}
                <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={false}
                >
                    <ScrollView
                        ref={dataSkeletonScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        bounces={false}
                        scrollEventThrottle={16}
                        onScroll={(e) => {
                            headerSkeletonScrollRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
                        }}
                    >
                        <View style={{ width: TOTAL_W }}>
                            <View style={[s.secRow, { height: SEC_H, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                                <View style={{ width: NAME_W }} />
                                <View style={{ flex: 1 }} />
                            </View>
                            {rows.map((rowId) => (
                                <View key={rowId} style={[s.row, { height: ROW_H, borderBottomColor: colors.border }]}>
                                    <View style={{ width: NAME_W }} />
                                    {COLS.map(col => (
                                        <View key={col.key} style={[s.dataCell, { width: col.w, borderRightColor: colors.border, alignItems: "center", justifyContent: "center" }]}>
                                            {col.key === "status" && <ShimmerBlock width={70} height={18} borderRadius={4} />}
                                            {(col.key === "start" || col.key === "due") && <ShimmerBlock width={48} height={12} borderRadius={3} />}
                                            {(col.key === "assignee" || col.key === "reviewer") && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <ShimmerBlock width={20} height={20} borderRadius={10} />
                                                    <ShimmerBlock width={45} height={10} borderRadius={2} />
                                                </View>
                                            )}
                                            {col.key === "urgency" && <ShimmerBlock width={64} height={18} borderRadius={8} />}
                                            {col.key === "tag" && <ShimmerBlock width={55} height={16} borderRadius={6} />}
                                        </View>
                                    ))}
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Frozen Name Column */}
                    <View style={[s.frozenCol, { width: "100%", top: 0 }]} pointerEvents="box-none">
                        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: NAME_W, backgroundColor: colors.background }} pointerEvents="none" />
                        <View pointerEvents="none">
                            {/* Section header (frozen side) */}
                            <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center' }}>
                                <View style={[s.secFrozen, { width: NAME_W, height: SEC_H, backgroundColor: colors.background, borderBottomColor: colors.border, alignItems: "center" }]}>
                                    <ShimmerBlock width={80} height={12} borderRadius={3} />
                                    <ShimmerBlock width={20} height={14} borderRadius={7} style={{ marginLeft: 6 }} />
                                </View>
                            </View>
                            {/* Name cells */}
                            {rows.map((rowId) => (
                                <View
                                    key={rowId}
                                    style={[s.nameCell, { width: NAME_W, height: ROW_H, backgroundColor: colors.background, borderBottomColor: colors.border, justifyContent: "center" }]}
                                >
                                    <View style={{ flex: 1, gap: 5, justifyContent: "center" }}>
                                        <ShimmerBlock width={60} height={8} borderRadius={2} />
                                        <ShimmerBlock width={120} height={14} borderRadius={4} />
                                    </View>
                                </View>
                            ))}
                        </View>
                        <View style={[s.edgeShadow, { left: NAME_W, right: "auto" }]} pointerEvents="none" />
                    </View>
                </ScrollView>
            </View>
        );
    };

    const renderKanbanSkeleton = () => {
        const columns = [
            { title: "To Do", icon: "list" },
            { title: "In Progress", icon: "play-circle" },
            { title: "Review", icon: "eye" },
        ];
        return (
            <ScrollView
                horizontal
                scrollEnabled={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: SPACING.md, gap: SPACING.md }}
                showsHorizontalScrollIndicator={false}
            >
                {columns.map((col, idx) => (
                    <View
                        key={idx}
                        style={{
                            width: SCREEN_W * 0.82,
                            borderRadius: BORDER_RADIUS.lg,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surface + "50",
                            overflow: "hidden",
                            height: "100%",
                        }}
                    >
                        {/* Column Header */}
                        <View style={{ flexDirection: "row", alignItems: "center", padding: SPACING.md, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHighlight, justifyContent: "center", alignItems: "center" }}>
                                <Ionicons name={col.icon as any} size={14} color={colors.textDim} />
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, flex: 1 }}>{col.title}</Text>
                            <ShimmerBlock width={24} height={18} borderRadius={10} />
                        </View>

                        {/* Column Cards */}
                        <ScrollView style={{ padding: SPACING.sm }} scrollEnabled={false} showsVerticalScrollIndicator={false}>
                            {[1, 2, 3].map((cardId) => (
                                <View
                                    key={cardId}
                                    style={{
                                        padding: SPACING.md,
                                        borderRadius: BORDER_RADIUS.md,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        backgroundColor: colors.surface,
                                        borderLeftWidth: 4,
                                        borderLeftColor: colors.border,
                                        marginBottom: SPACING.sm,
                                    }}
                                >
                                    {/* Card Header */}
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                                            <ShimmerBlock width={60} height={10} borderRadius={2} />
                                        </View>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                            <ShimmerBlock width={18} height={18} borderRadius={9} />
                                        </View>
                                    </View>

                                    {/* Task Name Shimmer */}
                                    <ShimmerBlock width="90%" height={14} borderRadius={3} style={{ marginBottom: 12 }} />

                                    {/* Task Footer Shimmer */}
                                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                            <ShimmerBlock width={50} height={12} borderRadius={3} />
                                        </View>
                                        <ShimmerBlock width={22} height={22} borderRadius={11} />
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ))}
            </ScrollView>
        );
    };

    const renderGanttSkeleton = () => {
        const rows = [1, 2, 3, 4, 5, 6, 7];
        const GANTT_NAME_W = 180;
        const GANTT_ASSIGNEE_W = 100;
        const GANTT_DAYS_W = 60;
        const GANTT_DATES_W = 130;
        const GANTT_TOTAL_W = GANTT_NAME_W + GANTT_ASSIGNEE_W + GANTT_DAYS_W + GANTT_DATES_W;
        const GANTT_HEADER_H = 44;
        const GANTT_ROW_H = 52;

        return (
            <View style={{ flex: 1, backgroundColor: isDark ? "#0a0a0a" : colors.background }}>
                <View style={{ width: GANTT_TOTAL_W }}>
                    {/* Header */}
                    <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, height: GANTT_HEADER_H, borderBottomColor: colors.border, backgroundColor: isDark ? "#111" : colors.surface }}>
                        <View style={{ width: GANTT_NAME_W, paddingLeft: 12 }}>
                            <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1.2, color: colors.primary }}>TASK NAME</Text>
                        </View>
                        <View style={{ width: GANTT_ASSIGNEE_W, justifyContent: "center", paddingLeft: 8 }}>
                            <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1.2, color: colors.textDim }}>ASSIGNEE</Text>
                        </View>
                        <View style={{ width: GANTT_DAYS_W, justifyContent: "center", paddingLeft: 8 }}>
                            <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1.2, color: colors.textDim }}>DAYS</Text>
                        </View>
                        <View style={{ width: GANTT_DATES_W, justifyContent: "center", paddingLeft: 8 }}>
                            <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1.2, color: colors.textDim }}>DATES</Text>
                        </View>
                    </View>

                    {/* Shimmering rows */}
                    <ScrollView style={{ flex: 1 }} scrollEnabled={false} showsVerticalScrollIndicator={false}>
                        {rows.map((rowId) => {
                            const isSub = rowId > 2;
                            return (
                                <View
                                    key={rowId}
                                    style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        borderBottomWidth: StyleSheet.hairlineWidth,
                                        height: GANTT_ROW_H,
                                        backgroundColor: isDark
                                            ? isSub ? "#181818" : "#111"
                                            : isSub ? "#f9f9f9" : colors.surface,
                                        borderBottomColor: colors.border + "33",
                                    }}
                                >
                                    {/* Task Name Cell */}
                                    <View style={{ width: GANTT_NAME_W, flexDirection: "row", alignItems: "center", paddingLeft: isSub ? 26 : 12 }}>
                                        {isSub && (
                                            <Ionicons name="return-down-forward-outline" size={11} color={colors.textDim} style={{ marginRight: 4 }} />
                                        )}
                                        <ShimmerBlock width={isSub ? 80 : 120} height={12} borderRadius={3} />
                                    </View>
                                    {/* Assignee Cell */}
                                    <View style={{ width: GANTT_ASSIGNEE_W, justifyContent: "center", paddingLeft: 8 }}>
                                        <ShimmerBlock width={60} height={12} borderRadius={3} />
                                    </View>
                                    {/* Days Cell */}
                                    <View style={{ width: GANTT_DAYS_W, justifyContent: "center", paddingLeft: 8 }}>
                                        {isSub && <ShimmerBlock width={20} height={12} borderRadius={3} />}
                                    </View>
                                    {/* Dates Cell */}
                                    <View style={{ width: GANTT_DATES_W, justifyContent: "center", paddingLeft: 8 }}>
                                        {isSub && <ShimmerBlock width={70} height={12} borderRadius={3} />}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        );
    };

    const renderSkeleton = () => {
        if (viewMode === "List") return renderListSkeleton();
        if (viewMode === "Kanban") return renderKanbanSkeleton();
        if (viewMode === "Gantt") return renderGanttSkeleton();
        return null;
    };

    const renderContent = () => {
        if (viewMode === "List") {
            return (
                <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                    {/* STATIC HEADER ROW (Vertically static, horizontally synced) */}
                    <View style={{ height: COL_H, zIndex: 100 }}>
                        <ScrollView
                            ref={headerScrollRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            scrollEnabled={false}
                            bounces={false}
                        >
                            <View style={{ width: TOTAL_W, height: COL_H }}>
                                <View style={[s.colHRow, { height: COL_H, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                                    <View style={{ width: NAME_W }} />
                                    {COLS.map(col => (
                                        <View key={col.key} style={[s.colHCell, { width: col.w, borderRightColor: colors.border }]}>
                                            <Text style={[s.colHTxt, { color: colors.textDim }]}>{col.label}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>
                        {/* Frozen Header (Top Left Corner) */}
                        <View style={[s.frozenHeader, { width: NAME_W, height: COL_H, backgroundColor: colors.surface, borderBottomColor: colors.border, borderRightColor: colors.border }]}>
                            <Text style={[s.colHTxt, { color: colors.textDim }]}>TASK NAME</Text>
                        </View>
                    </View>

                    {/* SCROLLABLE CONTENT */}
                    <ScrollView
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); fetchData(true); }} tintColor={colors.primary} />}
                        scrollEventThrottle={16}
                        onScroll={(e) => {
                            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                            const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 150;
                            if (isCloseToBottom && hasMore && !loadingMore && nextCursor) {
                                loadMore();
                            }
                        }}
                    >
                        <ScrollView
                            ref={dataScrollRef}
                            horizontal
                            showsHorizontalScrollIndicator={true}
                            bounces={false}
                            scrollEventThrottle={16}
                            onScroll={(e) => {
                                headerScrollRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
                            }}
                        >
                            <View style={{ width: TOTAL_W }}>
                                {sections.map(section => (
                                    <View key={section.key}>
                                        <View style={[s.secRow, { height: SEC_H, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                                            <View style={{ width: NAME_W }} />
                                            <View style={{ flex: 1 }} />
                                        </View>
                                        {!collapsed.has(section.key) && section.data.map(task => (
                                            <View key={task.id} style={[s.row, { height: ROW_H, borderBottomColor: colors.border }]}>
                                                <View style={{ width: NAME_W }} />
                                                {COLS.map(col => (
                                                    <View key={col.key} style={[s.dataCell, { width: col.w, borderRightColor: colors.border }]}>
                                                        <Cell task={task} col={col} />
                                                    </View>
                                                ))}
                                            </View>
                                        ))}
                                    </View>
                                ))}
                                <View style={{ height: 20 }} />
                            </View>
                        </ScrollView>

                        {/* Frozen Name Column (scrolls vertically with this ScrollView) */}
                        <View style={[s.frozenCol, { width: "100%", top: 0 }]} pointerEvents="box-none">
                            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: NAME_W, backgroundColor: colors.background }} pointerEvents="none" />
                            <NameCol />
                            <View style={[s.edgeShadow, { left: NAME_W, right: "auto" }]} pointerEvents="none" />
                        </View>
                    </ScrollView>
                </View>
            );
        }
        if (viewMode === "Kanban") {
            const KANBAN_COLUMNS_DEF = [
                { status: "TO_DO" as KanbanStatus, title: "To Do", icon: "list" as const },
                { status: "IN_PROGRESS" as KanbanStatus, title: "In Progress", icon: "play-circle" as const },
                { status: "REVIEW" as KanbanStatus, title: "Review", icon: "eye" as const },
                { status: "COMPLETED" as KanbanStatus, title: "Completed", icon: "checkmark-circle" as const },
                { status: "HOLD" as KanbanStatus, title: "Hold", icon: "pause-circle" as const },
                { status: "CANCELLED" as KanbanStatus, title: "Cancelled", icon: "close-circle" as const },
            ];

            const getStatusColor = (status: string) => getStatusHex(status as any);
            const getStatusBg = (status: string) => getStatusBgColor(status as any);

            const resolveManager = (task: Task) => {
                const taskManagers = (task.project as any)?.projectManagers;
                const contextManagers = projects.find(
                    p => p.id === task.projectId || p.name?.toLowerCase() === task.project?.name?.toLowerCase()
                )?.projectManagers;
                const resolve = (list?: any[] | null) => {
                    if (!list || list.length === 0) return null;
                    return list.find((m: any) => m?.projectRole === "PROJECT_MANAGER") ||
                           list.find((m: any) => m?.projectRole === "LEAD") ||
                           list[0];
                };
                const normalize = (candidate: any) => {
                    if (!candidate) return null;
                    const wm = candidate.WorkspaceMember || candidate.workspaceMember;
                    const u = wm?.user || candidate.user || candidate;
                    return { name: u?.name || candidate.name || "", surname: u?.surname || candidate.surname || "" };
                };
                return normalize(resolve(taskManagers)) || normalize(resolve(contextManagers));
            };

            const renderKanbanCard = (task: Task) => {
                const isOverdue = task.dueDate && new Date() > new Date(task.dueDate);
                const statusColor = getStatusHex(task.status);
                const manager = resolveManager(task);

                return (
                    <TouchableOpacity
                        key={task.id}
                        style={{
                            backgroundColor: colors.surface,
                            borderRadius: BORDER_RADIUS.md,
                            borderWidth: 1,
                            borderLeftWidth: 4,
                            borderColor: colors.border,
                            borderLeftColor: statusColor,
                            padding: SPACING.md,
                            marginBottom: SPACING.sm,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.05,
                            shadowRadius: 4,
                            elevation: 2,
                        }}
                        activeOpacity={0.7}
                        onPress={() => nav.navigate("TaskDetail", { taskId: task.id, taskName: task.name })}
                        onLongPress={() => handleLongPress(task)}
                        delayLongPress={300}
                    >
                        {/* Card Header: Breadcrumb + Manager */}
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
                                <Text style={{ fontSize: 10, fontWeight: "700", textTransform: "uppercase", color: colors.textDim }}>
                                    {(task.project?.name || "No Project").toUpperCase()}
                                </Text>
                                {task.parentTaskId && (
                                    <>
                                        <Text style={{ fontSize: 10, color: colors.textDim, opacity: 0.3 }}>/</Text>
                                        <Text style={{ fontSize: 10, fontWeight: "500", color: colors.textDim, opacity: 0.8 }}>
                                            {task.parentTask?.name?.toUpperCase()}
                                        </Text>
                                    </>
                                )}
                            </View>
                            {/* Manager avatar */}
                            <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
                                <View style={{ alignItems: "flex-end", marginRight: 6 }}>
                                    <Text style={{ fontSize: 8, fontWeight: "700", textTransform: "uppercase", color: colors.statusReview, opacity: 0.6, marginBottom: 1 }}>Manager</Text>
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>
                                        {manager?.surname || manager?.name || "None"}
                                    </Text>
                                </View>
                                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, backgroundColor: colors.statusReview + "30", borderColor: colors.statusReview, justifyContent: "center", alignItems: "center" }}>
                                    {manager ? (
                                        <Text style={{ fontSize: 10, fontWeight: "800", color: colors.statusReview }}>
                                            {(manager.surname?.[0] || manager.name?.[0] || "?").toUpperCase()}
                                        </Text>
                                    ) : (
                                        <Ionicons name="person-outline" size={10} color={colors.textDim} />
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Task Name */}
                        <Text style={{ fontSize: 14, fontWeight: "600", lineHeight: 20, color: colors.text, marginBottom: 12 }}>
                            {task.name}
                        </Text>

                        {/* Card Footer */}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Ionicons name="chatbubble-outline" size={12} color={colors.textDim} />
                                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textDim }}>{task.commentCount || 0}</Text>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Ionicons name="calendar-outline" size={12} color={isOverdue ? colors.error : colors.textDim} />
                                    <Text style={{ fontSize: 11, fontWeight: "600", color: isOverdue ? colors.error : colors.textDim }}>
                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" }) : "No date"}
                                    </Text>
                                </View>
                            </View>
                            {/* Assignee avatar */}
                            <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
                                <View style={{ alignItems: "flex-end", marginRight: 6 }}>
                                    <Text style={{ fontSize: 8, fontWeight: "700", textTransform: "uppercase", color: colors.textDim, opacity: 0.6, marginBottom: 1 }}>Assignee</Text>
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text }}>
                                        {task.assignee?.surname || task.assignee?.name || "None"}
                                    </Text>
                                </View>
                                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, backgroundColor: colors.surfaceHighlight, borderColor: colors.border, justifyContent: "center", alignItems: "center" }}>
                                    {task.assignee ? (
                                        <Text style={{ fontSize: 10, fontWeight: "800", color: colors.textDim }}>
                                            {(task.assignee.surname?.[0] || task.assignee.name?.[0] || "?").toUpperCase()}
                                        </Text>
                                    ) : (
                                        <Ionicons name="person-outline" size={10} color={colors.textDim} />
                                    )}
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>
                );
            };

            return (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: SPACING.md, gap: SPACING.md }}
                    refreshControl={
                        <RefreshControl refreshing={kanbanRefreshing} onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refreshKanbanCols(); }} tintColor={colors.primary} />
                    }
                >
                    {KANBAN_COLUMNS_DEF.map(col => {
                        const colState = kanbanCols[col.status];
                        const statusColor = getStatusColor(col.status);
                        const statusBg = getStatusBg(col.status);
                        return (
                            <View
                                key={col.status}
                                style={{
                                    width: SCREEN_W * 0.82,
                                    borderRadius: BORDER_RADIUS.lg,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    backgroundColor: isDark ? "rgba(26,26,26,0.5)" : "rgba(255,255,255,0.7)",
                                    overflow: "hidden",
                                    height: "100%",
                                }}
                            >
                                {/* Column header */}
                                <View style={{ flexDirection: "row", alignItems: "center", padding: SPACING.md, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: statusBg, justifyContent: "center", alignItems: "center" }}>
                                        <Ionicons name={col.icon} size={14} color={statusColor} />
                                    </View>
                                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 }}>{col.title}</Text>
                                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: statusBg }}>
                                        <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor }}>
                                            {colState.totalCount ?? colState.tasks.length}
                                        </Text>
                                    </View>
                                </View>

                                {/* Column cards */}
                                <ScrollView
                                    style={{ flex: 1 }}
                                    contentContainerStyle={{ padding: SPACING.sm, paddingBottom: SPACING.xl }}
                                    showsVerticalScrollIndicator={false}
                                    scrollEventThrottle={200}
                                    onScroll={(e) => {
                                        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                                        const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;
                                        if (nearBottom && colState.hasMore && !colState.loadingMore && colState.initialized) {
                                            fetchKanbanColumn(col.status);
                                        }
                                    }}
                                >
                                    {!colState.initialized ? (
                                        // Column loading skeleton
                                        [1, 2, 3].map(i => (
                                            <View key={i} style={{ backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: colors.border, padding: SPACING.md, marginBottom: SPACING.sm, opacity: 0.5 }}>
                                                <View style={{ height: 10, width: 80, backgroundColor: colors.border, borderRadius: 3, marginBottom: 8 }} />
                                                <View style={{ height: 14, width: "85%", backgroundColor: colors.border, borderRadius: 3, marginBottom: 12 }} />
                                                <View style={{ height: 10, width: 60, backgroundColor: colors.border, borderRadius: 3 }} />
                                            </View>
                                        ))
                                    ) : colState.tasks.length === 0 ? (
                                        <View style={{ alignItems: "center", paddingTop: 32, gap: 8 }}>
                                            <Ionicons name="document-text-outline" size={28} color={colors.textDim} />
                                            <Text style={{ color: colors.textDim, fontSize: 13 }}>No tasks</Text>
                                        </View>
                                    ) : (
                                        colState.tasks.map(renderKanbanCard)
                                    )}
                                    {/* Load more indicator */}
                                    {colState.loadingMore && (
                                        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
                                    )}
                                </ScrollView>
                            </View>
                        );
                    })}
                </ScrollView>
            );
        }
        if (viewMode === "Gantt") {
            return (
                <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                    <ProjectGanttView
                        projectId=""
                        tasks={ganttTasks}
                        loading={ganttLoading}
                        refreshData={() => fetchGanttData(true)}
                        navigation={nav}
                    />
                </View>
            );
        }
        return null;
    };

    return (
        <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.surface} />

            <View style={[s.appHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                <View style={{ maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {isSearchMode ? (
                        <View style={s.searchBarArea}>
                            <Ionicons name="search" size={18} color={colors.textDim} />
                            <TextInput
                                style={[s.headerSearchInput, { color: colors.text }]}
                                placeholder="Search all tasks..."
                                placeholderTextColor={colors.textDim}
                                value={filters.search || ""}
                                autoFocus
                                onChangeText={(t) => setGlobalFilters({ ...filters, search: t })}
                            />
                            <TouchableOpacity onPress={() => { setIsSearchMode(false); setGlobalFilters({ ...filters, search: "" }); }}>
                                <Ionicons name="close-circle" size={20} color={colors.textDim} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={s.headerTitleArea}>
                            <View style={[s.headerIcon, { backgroundColor: colors.primary + "15" }]}>
                                <Ionicons name="grid" size={16} color={colors.primary} />
                            </View>
                            <View style={s.headerTextCol}>
                                <View style={s.headerTitleRow}>
                                    <Text style={[s.headerTitle, { color: colors.text }]} numberOfLines={1}>All Projects</Text>

                                    {/* "My Tasks" Checkbox for Owners/PMs */}
                                    {(isWorkspaceAdmin || managedProjectIds.length > 0) && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                setOwnerViewMode(p => p === "Universal" ? "Personal" : "Universal");
                                            }}
                                            style={[s.checkboxContainer, { marginLeft: 12 }]}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[
                                                s.checkbox,
                                                { borderColor: colors.primary },
                                                ownerViewMode === "Personal" && { backgroundColor: colors.primary }
                                            ]}>
                                                {ownerViewMode === "Personal" && <Ionicons name="checkmark" size={10} color="#fff" />}
                                            </View>
                                            <Text style={[s.checkboxLabel, { color: ownerViewMode === "Personal" ? colors.primary : colors.textDim }]}>My Tasks</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}

                    <View style={s.headerActions}>
                        {!isSearchMode && (
                            <TouchableOpacity
                                style={[s.actionBtn, { backgroundColor: colors.surfaceHighlight }]}
                                onPress={() => setIsSearchMode(true)}
                            >
                                <Ionicons name="search" size={18} color={colors.textDim} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[s.actionBtn, { backgroundColor: colors.surfaceHighlight }, activeFilterCount > 0 && { backgroundColor: isDark ? colors.activeTab : "#e0e7ff" }]}
                            onPress={() => setFilterVisible(true)}
                        >
                            <Ionicons
                                name="filter"
                                size={18}
                                color={activeFilterCount > 0 ? colors.primary : colors.textDim}
                            />
                            {activeFilterCount > 0 && (
                                <View style={[s.filterBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                                    <Text style={s.filterBadgeText}>{activeFilterCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* View Mode Switcher Row */}
            <View style={[s.viewSwitcher, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                <View style={{ maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center', height: '100%', justifyContent: 'center' }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.viewSwitcherContent}>
                        {[
                            { id: "List", label: "List", icon: "list" },
                            { id: "Kanban", label: "Kanban", icon: "apps" },
                            { id: "Gantt", label: "Gantt", icon: "layers" }
                        ].map((opt) => {
                            const active = viewMode === opt.id;
                            return (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={[
                                        s.viewTab,
                                        active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
                                    ]}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        setViewMode(opt.id as any);
                                    }}
                                >
                                    <Ionicons
                                        name={opt.icon as any}
                                        size={16}
                                        color={active ? colors.primary : colors.textDim}
                                    />
                                    <Text style={[
                                        s.viewTabLabel,
                                        { color: active ? colors.primary : colors.textDim },
                                        active && { fontWeight: "700" }
                                    ]}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>

            <TaskFilterSheet
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                showProjectFilter={true}
            />

            {viewMode === "List" ? (
                loading && !refreshing ? (
                    renderSkeleton()
                ) : tasks.length === 0 ? (
                    <View style={s.center}>
                        <Ionicons name="checkmark-done-circle-outline" size={52} color={colors.primary} />
                        <Text style={[s.emptyT, { color: colors.text }]}>All caught up!</Text>
                        <Text style={[{ color: colors.textDim, fontSize: 13, textAlign: "center" }]}>
                            No projects or tasks found in this workspace.
                        </Text>
                    </View>
                ) : (
                    renderContent()
                )
            ) : viewMode === "Gantt" ? (
                ganttLoading && !ganttRefreshing ? (
                    renderSkeleton()
                ) : (
                    renderContent()
                )
            ) : (
                // Kanban view handles its own skeletons per status column
                renderContent()
            )}


            <CreateSubTaskModal
                visible={createSubTaskVisible}
                onClose={() => {
                    setCreateSubTaskVisible(false);
                    if (viewMode === "List") {
                        fetchData(true);
                    } else if (viewMode === "Kanban") {
                        refreshKanbanCols();
                    } else if (viewMode === "Gantt") {
                        fetchGanttData(true);
                    }
                }}
            />

            <StatusPickerModal
                visible={statusPickerVisible}
                onClose={() => setStatusPickerVisible(false)}
                onSelect={(status) => handleStatusUpdate(selectedTask?.id || "", status)}
                currentStatus={selectedTask?.status || ""}
            />

            <ReviewCommentModal
                visible={reviewModalVisible}
                onClose={() => setReviewModalVisible(false)}
                onSubmit={handleReviewSubmit}
                taskName={selectedTask?.name || ""}
            />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, padding: SPACING.xl },
    emptyT: { fontSize: 18, fontWeight: "700" },

    appHeader: { justifyContent: "center", height: 60, borderBottomWidth: 1, ...Platform.select({ ios: { zIndex: 10 }, android: { elevation: 4 } }) },
    headerTitleArea: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
    headerIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    headerTextCol: { flex: 1, justifyContent: "center" },
    headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    headerTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 10, fontWeight: "500", marginTop: -1 },

    checkboxContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
    checkbox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
    checkboxLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3 },

    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    actionBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center", position: "relative" },
    filterBadge: { position: "absolute", top: -2, right: -2, minWidth: 14, height: 14, borderRadius: 7, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
    filterBadgeText: { color: "#fff", fontSize: 7, fontWeight: "800" },
    searchBarArea: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f615", borderRadius: 10, paddingHorizontal: 10, height: 36, marginRight: 8 },
    headerSearchInput: { flex: 1, fontSize: 14, paddingHorizontal: 8, height: "100%" },

    // Column header row
    colHRow: { flexDirection: "row", borderBottomWidth: 1 },
    colHCell: { justifyContent: "center", alignItems: "center", paddingHorizontal: 8, borderRightWidth: StyleSheet.hairlineWidth },
    colHTxt: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" },

    // Section row (data side)
    secRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },

    // Task row
    row: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
    dataCell: { justifyContent: "center", alignItems: "center", paddingHorizontal: 6, borderRightWidth: StyleSheet.hairlineWidth },

    // Frozen col header
    frozenHeader: {
        position: "absolute", top: 0, left: 0,
        justifyContent: "center", alignItems: "center", paddingHorizontal: 12,
        borderBottomWidth: 1, borderRightWidth: StyleSheet.hairlineWidth,
        zIndex: 20,
        ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 3, height: 0 }, shadowOpacity: 0.1, shadowRadius: 6 }, android: { elevation: 5 } }),
    },

    // Frozen name column
    frozenCol: {
        position: "absolute", left: 0, bottom: 0,
        zIndex: 10,
        ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 4 } }),
    },
    edgeShadow: {
        position: "absolute", top: 0, bottom: 0, right: -8, width: 8,
        backgroundColor: "transparent",
        ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.08, shadowRadius: 4 } }),
    },

    // Frozen name cells
    secFrozen: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 5, borderBottomWidth: StyleSheet.hairlineWidth },
    secDot: { width: 7, height: 7, borderRadius: 4 },
    secTitle: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, flex: 1 },
    secBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
    secBadgeTxt: { fontSize: 9, fontWeight: "700" },
    nameCell: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 10, paddingVertical: 6, gap: 7, borderBottomWidth: StyleSheet.hairlineWidth },
    statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 5 },
    taskName: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
    projRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
    projDot: { width: 5, height: 5, borderRadius: 3 },
    projTxt: { fontSize: 10, fontWeight: "600" },

    // Data cells
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    badgeTxt: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
    dateTxt: { fontSize: 11 },
    mem: { flexDirection: "row", alignItems: "center", gap: 4 },
    av: { width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    avTxt: { fontSize: 8, fontWeight: "700" },
    memTxt: { fontSize: 10, fontWeight: "500", flexShrink: 1 },
    urgB: { flexDirection: "row", alignItems: "center", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, gap: 3 },
    urgDot: { width: 5, height: 5, borderRadius: 3 },
    urgTxt: { fontSize: 9, fontWeight: "700" },
    tagB: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, minWidth: 40, alignItems: "center" },
    tagTxt: { fontSize: 8, fontWeight: "700", textTransform: "uppercase" },
    dash: { fontSize: 13 },

    // Picker
    dropdown: { position: "absolute", width: 248, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, padding: SPACING.sm, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 10 },
    pItem: { flexDirection: "row", alignItems: "center", padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginBottom: 2, gap: 10 },
    pIcon: { width: 27, height: 27, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    pInit: { fontSize: 12, fontWeight: "700" },
    pTxt: { flex: 1, fontSize: 14, fontWeight: "500" },

    viewSwitcher: {
        height: 44,
        borderBottomWidth: 1,
        justifyContent: "center",
    },
    viewSwitcherContent: {
        height: "100%",
        gap: 20,
        alignItems: "center",
    },
    viewTab: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        paddingHorizontal: 4,
        gap: 6,
    },
    viewTabLabel: {
        fontSize: 13,
        fontWeight: "600",
    },
});
