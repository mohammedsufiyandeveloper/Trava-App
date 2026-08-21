import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Platform, Modal, Dimensions, TouchableWithoutFeedback, LayoutAnimation, UIManager, TextInput, Animated, Alert, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
// View components
import TaskFilterSheet from "../components/TaskFilterSheet";
import ProjectGanttView from "./project/ProjectGanttView";
import CreateSubTaskModal from "../components/CreateSubTaskModal";
import StatusPickerModal from "../components/StatusPickerModal";
import ReviewCommentModal from "../components/ReviewCommentModal";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace, DEFAULT_FILTERS } from "../context/WorkspaceContext";
import { getTasks, getTasksCount, getKanbanBoard, getCachedSession, updateTask } from "../services/api";
import { Task, User } from "../types";
import { getStatusHex, getStatusBgColor } from "../utils/taskColors";
import { useResponsive } from "../hooks/useResponsive";
import EmptyState from "../components/EmptyState";
import PressableScale from "../components/PressableScale";


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
    // Keep backend sort order (createdAt desc) — do NOT re-sort client-side
    // to avoid re-layouts on every page append.
    return [{
        key: "all",
        title: "SUBTASKS",
        color: "#8b5cf6",
        data: tasks
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
    const isFetchingMoreRef = useRef(false);

    const filters = globalFilters;
    const activeFilterCount = Object.values(filters).filter(v => Array.isArray(v) ? v.length > 0 : !!v).length;

    // Removable filter-chip descriptors for the active-filters row. Kept local
    // to this screen (does not mutate WorkspaceContext shape).
    const activeFilterChips = useMemo(() => {
        const chips: { key: string; label: string; onRemove: () => void }[] = [];
        if (filters.search) {
            chips.push({
                key: "search",
                label: `Search: ${filters.search}`,
                onRemove: () => setGlobalFilters({ ...filters, search: "" }),
            });
        }
        (filters.status || []).forEach((st: string) => {
            chips.push({
                key: `status-${st}`,
                label: st.replace("_", " "),
                onRemove: () => setGlobalFilters({ ...filters, status: filters.status.filter((s: string) => s !== st) }),
            });
        });
        (filters.projectId || []).forEach((pid: string) => {
            const proj = projects.find(p => p.id === pid);
            chips.push({
                key: `project-${pid}`,
                label: proj?.name || "Project",
                onRemove: () => setGlobalFilters({ ...filters, projectId: (filters.projectId || []).filter((p: string) => p !== pid) }),
            });
        });
        (filters.tagId || []).forEach((tid: string) => {
            const tag = tags.find((t: any) => t.id === tid);
            chips.push({
                key: `tag-${tid}`,
                label: tag?.name || "Tag",
                onRemove: () => setGlobalFilters({ ...filters, tagId: filters.tagId.filter((t: string) => t !== tid) }),
            });
        });
        (filters.assigneeId || []).forEach((aid: string) => {
            const isMe = currentUser?.id === aid;
            chips.push({
                key: `assignee-${aid}`,
                label: isMe ? "Assignee: Me" : "Assignee",
                onRemove: () => setGlobalFilters({ ...filters, assigneeId: filters.assigneeId.filter((a: string) => a !== aid) }),
            });
        });
        if (filters.dueAfter || filters.dueBefore) {
            chips.push({
                key: "dateRange",
                label: "Date range",
                onRemove: () => setGlobalFilters({ ...filters, dueAfter: undefined, dueBefore: undefined }),
            });
        }
        return chips;
    }, [filters, projects, tags, currentUser, setGlobalFilters]);

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
                const isMyTasksMode = ownerViewMode === "Personal";

                const PAGE_SIZE = 15;

                // Build common filter params for both data and count
                const buildFilters = (extra: object = {}) => ({
                    ...filters,
                    onlySubtasks: true,
                    view_mode: filters.search ? "search" : "list",
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
                } else {
                    // Universal mode is authorized by the backend. It returns
                    // every subtask in projects the user manages and only the
                    // user's assigned work in restricted member projects.
                    if (isFirstPage) {
                        [result, count] = await Promise.all([
                            getTasks(activeWorkspace.id, buildFilters()),
                            getTasksCount(activeWorkspace.id, buildCountFilters()),
                        ]);
                    } else {
                        result = await getTasks(activeWorkspace.id, buildFilters());
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
    }, [activeWorkspace?.id, filters, ownerViewMode, currentUser]);

    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore || !nextCursor || isFetchingMoreRef.current) return;
        isFetchingMoreRef.current = true;
        setLoadingMore(true);
        try {
            await fetchData(false, nextCursor);
        } finally {
            setLoadingMore(false);
            isFetchingMoreRef.current = false;
        }
    }, [hasMore, loadingMore, nextCursor, fetchData]);

    // ── Per-column Kanban fetch ──────────────────────────────────────────────
    const fetchKanbanColumn = useCallback(async (status: KanbanStatus) => {
        if (!activeWorkspace || !currentUser) return;

        setKanbanCols(prev => ({
            ...prev,
            [status]: { ...prev[status], loadingMore: true }
        }));

        const cursor = kanbanCols[status].nextCursor ?? undefined;
        const KANBAN_PAGE = 10;
        const isMyTasksMode = ownerViewMode === "Personal";

        const baseFilters: Parameters<typeof getTasks>[1] = {
            ...filters,
            onlySubtasks: true,
            status: [status],
            view_mode: "kanban",
            limit: KANBAN_PAGE,
            cursor: cursor ?? undefined,
            assigneeId: isMyTasksMode && currentUser.id
                ? [currentUser.id]
                : filters.assigneeId,
        };

        try {
            const result = await getTasks(activeWorkspace.id, baseFilters);

            setKanbanCols(prev => ({
                ...prev,
                [status]: {
                    tasks: [
                        ...prev[status].tasks,
                        ...result.tasks.filter(
                            t => !t.isParent && !prev[status].tasks.find(p => p.id === t.id)
                        ),
                    ],
                    hasMore: result.hasMore,
                    nextCursor: result.nextCursor,
                    loadingMore: false,
                    initialized: true,
                    totalCount: prev[status].totalCount,
                }
            }));
        } catch (e) {
            console.error(`[Kanban] Failed to fetch column ${status}:`, e);
            setKanbanCols(prev => ({ ...prev, [status]: { ...prev[status], loadingMore: false, initialized: true } }));
        }
    }, [activeWorkspace, currentUser, ownerViewMode, filters, kanbanCols]);

    const refreshKanbanCols = useCallback(async () => {
        if (!activeWorkspace || !currentUser) return;
        setKanbanRefreshing(true);
        try {
            const isMyTasksMode = ownerViewMode === "Personal";
            const columns = await getKanbanBoard(activeWorkspace.id, {
                projectId: filters.projectId?.length ? filters.projectId : undefined,
                assigneeId: isMyTasksMode && currentUser.id
                    ? [currentUser.id]
                    : filters.assigneeId,
                tagId: filters.tagId,
                search: filters.search || undefined,
                dueAfter: filters.dueAfter || undefined,
                dueBefore: filters.dueBefore || undefined,
                pageSize: 10,
            });

            setKanbanCols((previous) => {
                const next = { ...previous };
                KANBAN_STATUSES.forEach((status) => {
                    const column = columns[status];
                    next[status] = {
                        tasks: column?.tasks ?? [],
                        totalCount: column?.totalCount ?? 0,
                        hasMore: column?.hasMore ?? false,
                        nextCursor: column?.nextCursor ?? null,
                        loadingMore: false,
                        initialized: true,
                    };
                });
                return next;
            });
        } catch (error) {
            console.error("[Kanban] Failed to refresh board:", error);
        } finally {
            setKanbanRefreshing(false);
        }
    }, [activeWorkspace, currentUser, ownerViewMode, filters]);

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
            const isMyTasksMode = ownerViewMode === "Personal";
            const GANTT_LIMIT = 150; // generous limit for Gantt chart to show all workspace tasks

            const buildGanttFilters = (extra: object = {}) => ({
                ...filters,
                hierarchyMode: "parents" as const,
                view_mode: "gantt",
                limit: GANTT_LIMIT,
                ...extra,
            });

            let result: { tasks: Task[]; hasMore: boolean; nextCursor: any };

            if (isMyTasksMode) {
                const assigneeFilter = { assigneeId: currentUser.id ? [currentUser.id] : undefined };
                result = await getTasks(activeWorkspace.id, buildGanttFilters(assigneeFilter));
            } else {
                // Server-side permission scoping already combines full-access
                // projects with assigned-only projects for managers/members.
                result = await getTasks(activeWorkspace.id, buildGanttFilters());
            }

            setGanttTasks(result.tasks);
        } catch (e) {
            console.error("[Gantt] Failed to fetch Gantt tasks:", e);
        } finally {
            setGanttLoading(false);
            setGanttRefreshing(false);
        }
    }, [activeWorkspace?.id, filters, ownerViewMode, currentUser]);

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

    const toggle = useCallback((k: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsed(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
    }, []);

    const handleNavigateToTask = useCallback((taskId: string, taskName: string) => {
        nav.navigate("TaskDetail", { taskId, taskName });
    }, [nav]);

    const handleOpenAddTask = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setCreateSubTaskVisible(true);
    }, []);

    const projName = "All Projects";
    const projColor = colors.primary;

    // Cell and NameCol are defined as stable module-level memoized components
    // below (outside this component body) to avoid remounting on every render.

    // Extracted scroll-bottom checker so it can be called from multiple scroll events.
    // Uses refs/state directly so it's always up-to-date even without re-renders.
    const checkAndLoadMore = useCallback((e: any) => {
        const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
        const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
        if (distanceFromBottom < 200 && hasMore && !loadingMore && nextCursor && !isFetchingMoreRef.current) {
            loadMore();
        }
    }, [hasMore, loadingMore, nextCursor, loadMore]);

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
                            <Text style={{ fontSize: 16, fontFamily: FONTS.bold, color: colors.text, flex: 1 }}>{col.title}</Text>
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
        const GANTT_TOTAL_W = GANTT_NAME_W;
        const GANTT_HEADER_H = 44;
        const GANTT_ROW_H = 52;

        return (
            <View style={{ flex: 1, backgroundColor: isDark ? "#0a0a0a" : colors.background }}>
                <View style={{ width: GANTT_TOTAL_W }}>
                    {/* Header */}
                    <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, height: GANTT_HEADER_H, borderBottomColor: colors.border, backgroundColor: isDark ? "#111" : colors.surface }}>
                        <View style={{ width: GANTT_NAME_W, paddingLeft: 12 }}>
                            <Text style={{ fontSize: 9, fontFamily: FONTS.extrabold, letterSpacing: 1.2, color: colors.primary }}>TASK NAME</Text>
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
            const COL_ICONS: Record<string, string> = {
                status: "flag-outline",
                start: "calendar-outline",
                due: "alarm-outline",
                assignee: "person-outline",
                reviewer: "eye-outline",
                urgency: "alert-circle-outline",
                tag: "pricetag-outline",
            };

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
                                <View style={[s.colHRow, { height: COL_H, backgroundColor: isDark ? "rgba(30,30,30,0.9)" : "rgba(255,255,255,0.9)", borderBottomColor: colors.border }]}>
                                    <View style={{ width: NAME_W }} />
                                    {COLS.map(col => {
                                        const iconName = COL_ICONS[col.key];
                                        return (
                                            <View key={col.key} style={[s.colHCell, { width: col.w, borderRightColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }]}>
                                                {iconName && <Ionicons name={iconName as any} size={11} color={colors.textDim} />}
                                                <Text style={[s.colHTxt, { color: colors.textDim }]}>{col.label}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        </ScrollView>
                        {/* Frozen Header (Top Left Corner) */}
                        <View style={[s.frozenHeader, { width: NAME_W, height: COL_H, backgroundColor: isDark ? "rgba(30,30,30,0.9)" : "rgba(255,255,255,0.9)", borderBottomColor: colors.border, borderRightColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 4 }]}>
                            <Ionicons name="document-text-outline" size={11} color={colors.textDim} />
                            <Text style={[s.colHTxt, { color: colors.textDim }]}>TASK NAME</Text>
                        </View>
                    </View>

                    {/* SCROLLABLE CONTENT */}
                    <ScrollView
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); fetchData(true); }} tintColor={colors.primary} />}
                        scrollEventThrottle={16}
                        onScroll={checkAndLoadMore}
                        onMomentumScrollEnd={checkAndLoadMore}
                        onScrollEndDrag={checkAndLoadMore}
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
                                        <View style={[s.secRow, { height: SEC_H, backgroundColor: isDark ? "#181818" : "#f9fafb", borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)" }]}>
                                            <View style={{ width: NAME_W }} />
                                            <View style={{ flex: 1 }} />
                                        </View>
                                        {!collapsed.has(section.key) && section.data.map((task, rowIndex) => (
                                            <View key={task.id} style={[s.row, { height: ROW_H, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)", backgroundColor: rowIndex % 2 === 0 ? colors.surface : (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.012)") }]}>
                                                <View style={{ width: NAME_W }} />
                                                {COLS.map(col => (
                                                    <View key={col.key} style={[s.dataCell, { width: col.w, borderRightColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)" }]}>
                                                        <BoardCell task={task} col={col} colors={colors} tags={tags} />
                                                    </View>
                                                ))}
                                            </View>
                                        ))}
                                    </View>
                                ))}
                                {hasMore && (
                                    <View style={{ height: 50 }} />
                                )}
                                <View style={{ height: 20 }} />
                            </View>
                        </ScrollView>

                        {/* Frozen Name Column (scrolls vertically with this ScrollView) */}
                        <View style={[s.frozenCol, { width: "100%", top: 0 }]} pointerEvents="box-none">
                            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: NAME_W, backgroundColor: colors.background }} pointerEvents="none" />
                            <BoardNameCol
                                sections={sections}
                                collapsed={collapsed}
                                totalCount={totalCount}
                                hasMore={hasMore}
                                loadingMore={loadingMore}
                                colors={colors}
                                isDark={isDark}
                                onToggle={toggle}
                                onNavigate={handleNavigateToTask}
                                onAddTask={handleOpenAddTask}
                            />
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
                                <Text style={{ fontSize: 10, fontFamily: FONTS.bold, textTransform: "uppercase", color: colors.textDim }}>
                                    {(task.project?.name || "No Project").toUpperCase()}
                                </Text>
                                {task.parentTaskId && (
                                    <>
                                        <Text style={{ fontSize: 10, color: colors.textDim, opacity: 0.3 }}>/</Text>
                                        <Text style={{ fontSize: 10, fontFamily: FONTS.medium, color: colors.textDim, opacity: 0.8 }}>
                                            {task.parentTask?.name?.toUpperCase()}
                                        </Text>
                                    </>
                                )}
                            </View>
                            {/* Manager avatar */}
                            <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
                                <View style={{ alignItems: "flex-end", marginRight: 6 }}>
                                    <Text style={{ fontSize: 8, fontFamily: FONTS.bold, textTransform: "uppercase", color: colors.statusReview, opacity: 0.6, marginBottom: 1 }}>Manager</Text>
                                    <Text style={{ fontSize: 11, fontFamily: FONTS.bold, color: colors.text }}>
                                        {manager?.surname || manager?.name || "None"}
                                    </Text>
                                </View>
                                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, backgroundColor: colors.statusReview + "30", borderColor: colors.statusReview, justifyContent: "center", alignItems: "center" }}>
                                    {manager ? (
                                        <Text style={{ fontSize: 10, fontFamily: FONTS.extrabold, color: colors.statusReview }}>
                                            {(manager.surname?.[0] || manager.name?.[0] || "?").toUpperCase()}
                                        </Text>
                                    ) : (
                                        <Ionicons name="person-outline" size={10} color={colors.textDim} />
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Task Name */}
                        <Text style={{ fontSize: 14, fontFamily: FONTS.semibold, lineHeight: 20, color: colors.text, marginBottom: 12 }}>
                            {task.name}
                        </Text>

                        {/* Card Footer */}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Ionicons name="chatbubble-outline" size={12} color={colors.textDim} />
                                    <Text style={{ fontSize: 11, fontFamily: FONTS.semibold, color: colors.textDim }}>{task.commentCount || 0}</Text>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                    <Ionicons name="calendar-outline" size={12} color={isOverdue ? colors.error : colors.textDim} />
                                    <Text style={{ fontSize: 11, fontFamily: FONTS.semibold, color: isOverdue ? colors.error : colors.textDim }}>
                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" }) : "No date"}
                                    </Text>
                                </View>
                            </View>
                            {/* Assignee avatar */}
                            <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
                                <View style={{ alignItems: "flex-end", marginRight: 6 }}>
                                    <Text style={{ fontSize: 8, fontFamily: FONTS.bold, textTransform: "uppercase", color: colors.textDim, opacity: 0.6, marginBottom: 1 }}>Assignee</Text>
                                    <Text style={{ fontSize: 11, fontFamily: FONTS.bold, color: colors.text }}>
                                        {task.assignee?.surname || task.assignee?.name || "None"}
                                    </Text>
                                </View>
                                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, backgroundColor: colors.surfaceHighlight, borderColor: colors.border, justifyContent: "center", alignItems: "center" }}>
                                    {task.assignee ? (
                                        <Text style={{ fontSize: 10, fontFamily: FONTS.extrabold, color: colors.textDim }}>
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
                                    <Text style={{ fontSize: 15, fontFamily: FONTS.bold, color: colors.text, flex: 1 }}>{col.title}</Text>
                                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: statusBg }}>
                                        <Text style={{ fontSize: 11, fontFamily: FONTS.bold, color: statusColor }}>
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
                                    refreshControl={
                                        <RefreshControl refreshing={kanbanRefreshing} onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); refreshKanbanCols(); }} tintColor={colors.primary} />
                                    }
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
                            <TouchableOpacity onPress={() => { setIsSearchMode(false); setGlobalFilters({ ...filters, search: "" }); }} accessibilityRole="button" accessibilityLabel="Close search">
                                <Ionicons name="close-circle" size={20} color={colors.textDim} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={s.headerTitleArea}>
                            <View style={s.headerTextCol}>
                                <View style={s.headerTitleRow}>
                                    <Text style={[s.headerTitle, { color: colors.text }]} numberOfLines={1}>Tasks</Text>

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
                                accessibilityRole="button"
                                accessibilityLabel="Search tasks"
                            >
                                <Ionicons name="search" size={18} color={colors.textDim} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[s.actionBtn, { backgroundColor: colors.surfaceHighlight }, activeFilterCount > 0 && { backgroundColor: isDark ? colors.activeTab : "#e0e7ff" }]}
                            onPress={() => setFilterVisible(true)}
                            accessibilityRole="button"
                            accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
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

            {/* View Mode Switcher Row — segmented-pill control */}
            <View style={[s.viewSwitcher, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                <View style={{ maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center', height: '100%', justifyContent: 'center' }}>
                    <View
                        style={[s.segmentedControl, { backgroundColor: colors.surfaceHighlight }]}
                        accessibilityRole="tablist"
                    >
                        {[
                            { id: "List", label: "List", icon: "list" },
                            { id: "Kanban", label: "Kanban", icon: "apps" },
                            { id: "Gantt", label: "Gantt", icon: "layers" }
                        ].map((opt) => {
                            const active = viewMode === opt.id;
                            return (
                                <PressableScale
                                    key={opt.id}
                                    haptic="selection"
                                    style={[
                                        s.segmentPill,
                                        active && {
                                            backgroundColor: colors.primary,
                                            shadowColor: "#000",
                                            shadowOffset: { width: 0, height: 1 },
                                            shadowOpacity: 0.15,
                                            shadowRadius: 3,
                                            elevation: 2
                                        }
                                    ]}
                                    onPress={() => setViewMode(opt.id as any)}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected: active }}
                                    accessibilityLabel={`${opt.label} view`}
                                >
                                    <Ionicons
                                        name={opt.icon as any}
                                        size={15}
                                        color={active ? colors.textInverse : colors.textDim}
                                    />
                                    <Text style={[
                                        s.viewTabLabel,
                                        { color: active ? colors.textInverse : colors.textDim },
                                        active && { fontFamily: FONTS.bold }
                                    ]}>
                                        {opt.label}
                                    </Text>
                                </PressableScale>
                            );
                        })}
                    </View>
                </View>
            </View>

            {/* Active filter chips — removable */}
            {activeFilterChips.length > 0 && (
                <View style={[s.activeFiltersBar, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ maxWidth: MAX_CONTENT_WIDTH, alignItems: "center", gap: 8 }}>
                        {activeFilterChips.map(chip => (
                            <TouchableOpacity
                                key={chip.key}
                                style={[s.removableChip, { backgroundColor: isDark ? colors.activeTab : "#e0e7ff", borderColor: colors.primary + "30" }]}
                                onPress={chip.onRemove}
                                accessibilityRole="button"
                                accessibilityLabel={`Remove filter: ${chip.label}`}
                            >
                                <Text style={[s.removableChipText, { color: colors.primary }]} numberOfLines={1}>{chip.label}</Text>
                                <Ionicons name="close-circle" size={14} color={colors.primary} />
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            onPress={() => setGlobalFilters(DEFAULT_FILTERS)}
                            accessibilityRole="button"
                            accessibilityLabel="Clear all filters"
                            style={{ marginLeft: 4 }}
                        >
                            <Text style={{ color: colors.error, fontSize: 12, fontFamily: FONTS.bold }}>Clear All</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            )}

            <TaskFilterSheet
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                showProjectFilter={true}
            />

            {viewMode === "List" ? (
                loading && !refreshing ? (
                    renderSkeleton()
                ) : tasks.length === 0 ? (
                    activeFilterCount > 0 ? (
                        <EmptyState
                            icon="funnel-outline"
                            title="No tasks match your filters"
                            message="Try removing a filter or two to see more results."
                            actionLabel="Clear filters"
                            onAction={() => setGlobalFilters(DEFAULT_FILTERS)}
                        />
                    ) : (
                        <EmptyState
                            icon="checkmark-done-circle-outline"
                            title="All caught up!"
                            message="No projects or tasks found in this workspace."
                        />
                    )
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
    emptyT: { fontSize: 18, fontFamily: FONTS.bold },

    appHeader: { justifyContent: "center", height: 60, borderBottomWidth: 1, ...Platform.select({ ios: { zIndex: 10 }, android: { elevation: 4 } }) },
    headerTitleArea: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
    headerIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    headerTextCol: { flex: 1, justifyContent: "center" },
    headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    headerTitle: { fontSize: 20, fontFamily: FONTS.bold, letterSpacing: -0.3 },
    headerSubtitle: { fontSize: 10, fontFamily: FONTS.medium, marginTop: -1 },

    checkboxContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
    checkbox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
    checkboxLabel: { fontSize: 11, fontFamily: FONTS.bold, textTransform: "uppercase", letterSpacing: 0.3 },

    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    actionBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: "center", alignItems: "center", position: "relative" },
    filterBadge: { position: "absolute", top: -2, right: -2, minWidth: 14, height: 14, borderRadius: 7, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
    filterBadgeText: { color: "#fff", fontSize: 7, fontFamily: FONTS.extrabold },
    searchBarArea: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f615", borderRadius: 10, paddingHorizontal: 10, height: 36, marginRight: 8 },
    headerSearchInput: { flex: 1, fontSize: 14, paddingHorizontal: 8, height: "100%" },

    // Column header row
    colHRow: { flexDirection: "row", borderBottomWidth: 1 },
    colHCell: { justifyContent: "center", alignItems: "center", paddingHorizontal: 8, borderRightWidth: StyleSheet.hairlineWidth },
    colHTxt: { fontSize: 9, fontFamily: FONTS.bold, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" },

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
    secTitle: { fontSize: 10, fontFamily: FONTS.bold, textTransform: "uppercase", letterSpacing: 0.5, flex: 1 },
    secBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
    secBadgeTxt: { fontSize: 9, fontFamily: FONTS.bold },
    nameCell: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 10, paddingVertical: 6, gap: 7, borderBottomWidth: StyleSheet.hairlineWidth },
    statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 5 },
    taskName: { fontSize: 12, fontFamily: FONTS.semibold, lineHeight: 17 },
    projRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
    projDot: { width: 5, height: 5, borderRadius: 3 },
    projTxt: { fontSize: 10, fontFamily: FONTS.semibold },

    // Data cells
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    badgeTxt: { fontSize: 9, fontFamily: FONTS.extrabold, textTransform: "uppercase" },
    dateTxt: { fontSize: 11 },
    mem: { flexDirection: "row", alignItems: "center", gap: 4 },
    av: { width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    avTxt: { fontSize: 8, fontFamily: FONTS.bold },
    memTxt: { fontSize: 10, fontFamily: FONTS.medium, flexShrink: 1 },
    urgB: { flexDirection: "row", alignItems: "center", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, gap: 3 },
    urgDot: { width: 5, height: 5, borderRadius: 3 },
    urgTxt: { fontSize: 9, fontFamily: FONTS.bold },
    tagB: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, minWidth: 40, alignItems: "center" },
    tagTxt: { fontSize: 8, fontFamily: FONTS.bold, textTransform: "uppercase" },
    dash: { fontSize: 13 },

    // Picker
    dropdown: { position: "absolute", width: 248, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, padding: SPACING.sm, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 10 },
    pItem: { flexDirection: "row", alignItems: "center", padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginBottom: 2, gap: 10 },
    pIcon: { width: 27, height: 27, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    pInit: { fontSize: 12, fontFamily: FONTS.bold },
    pTxt: { flex: 1, fontSize: 14, fontFamily: FONTS.medium },

    viewSwitcher: {
        height: 56,
        borderBottomWidth: 1,
        justifyContent: "center",
    },
    viewSwitcherContent: {
        height: "100%",
        gap: 20,
        alignItems: "center",
    },
    segmentedControl: {
        flexDirection: "row",
        borderRadius: BORDER_RADIUS.lg,
        padding: 3,
        width: "100%",
    },
    segmentPill: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        minHeight: TOUCH_TARGET.min - 6,
        paddingHorizontal: 14,
        borderRadius: BORDER_RADIUS.md,
        gap: 6,
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
        fontFamily: FONTS.semibold,
    },
    activeFiltersBar: {
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
    },
    removableChip: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
        borderWidth: 1,
        maxWidth: 180,
    },
    removableChipText: {
        fontSize: 11,
        fontFamily: FONTS.semibold,
        flexShrink: 1,
    },
});

// ─────────────────────────────────────────────────────────────────────────────
// STABLE MODULE-LEVEL COMPONENTS
// These MUST be defined outside any other component function so React treats
// them as the same component type across renders (prevents unmount/remount on
// every state update which caused the scroll-jump/glitch bug).
// ─────────────────────────────────────────────────────────────────────────────

interface BoardCellProps {
    task: Task;
    col: typeof COLS[0];
    colors: any;
    tags: any[];
}

const BoardCell = React.memo(function BoardCell({ task, col, colors, tags }: BoardCellProps) {
    const sc = getStatusHex(task.status);
    const bg = getStatusBgColor(task.status);
    const urg = getUrg(task.dueDate);

    switch (col.key) {
        case "status":
            return (
                <View style={[s.badge, { backgroundColor: bg }]}>
                    <Text style={[s.badgeTxt, { color: sc }]} numberOfLines={1}>
                        {task.status.replace("_", " ")}
                    </Text>
                </View>
            );
        case "start":
            return <Text style={[s.dateTxt, { color: colors.text }]}>{fmtDate(task.startDate)}</Text>;
        case "due":
            return <Text style={[s.dateTxt, { color: colors.text, fontFamily: FONTS.bold }]}>{fmtDate(task.dueDate)}</Text>;
        case "assignee":
            return task.assignee ? (
                <View style={s.mem}>
                    <View style={[s.av, { backgroundColor: colors.surfaceHighlight }]}>
                        <Text style={[s.avTxt, { color: colors.text }]}>
                            {(task.assignee.surname?.[0] || task.assignee.name[0]).toUpperCase()}
                        </Text>
                    </View>
                    <Text style={[s.memTxt, { color: colors.text }]} numberOfLines={1}>
                        {task.assignee.surname ? task.assignee.surname.split(" ")[0] : task.assignee.name}
                    </Text>
                </View>
            ) : <Text style={[s.dash, { color: colors.textDim }]}>—</Text>;
        case "reviewer":
            return task.reviewer ? (
                <View style={s.mem}>
                    <View style={[s.av, { backgroundColor: colors.surfaceHighlight }]}>
                        <Text style={[s.avTxt, { color: colors.text }]}>
                            {(task.reviewer.surname?.[0] || task.reviewer.name[0]).toUpperCase()}
                        </Text>
                    </View>
                    <Text style={[s.memTxt, { color: colors.text }]} numberOfLines={1}>
                        {task.reviewer.surname ? task.reviewer.surname.split(" ")[0] : task.reviewer.name}
                    </Text>
                </View>
            ) : <Text style={[s.dash, { color: colors.textDim }]}>—</Text>;
        case "urgency":
            return urg ? (
                <View style={[s.urgB, { backgroundColor: urg.color + "18" }]}>
                    <View style={[s.urgDot, { backgroundColor: urg.color }]} />
                    <Text style={[s.urgTxt, { color: urg.color }]}>{urg.text}</Text>
                </View>
            ) : <Text style={[s.dash, { color: colors.textDim }]}>—</Text>;
        case "tag": {
            const tagObj = task.tag || (Array.isArray(task.tags) && task.tags[0]) || (task as any).Tag || (task as any).taskTag || (Array.isArray((task as any).tags) ? (task as any).tags[0] : null);
            const tagId = task.tagId || (tagObj && typeof tagObj === "object" ? tagObj.id : null);
            const tagName =
                (typeof tagObj === "string" ? tagObj : null) ||
                (tagObj && typeof tagObj === "object" ? tagObj.name : null) ||
                (tagId ? tags.find((t: any) => String(t.id) === String(tagId))?.name : null) ||
                (task as any).tagName;
            return tagName ? (
                <View style={[s.tagB, { backgroundColor: colors.surfaceHighlight }]}>
                    <Text style={[s.tagTxt, { color: colors.textDim }]} numberOfLines={1} adjustsFontSizeToFit>
                        {tagName}
                    </Text>
                </View>
            ) : <Text style={[s.dash, { color: colors.textDim }]}>—</Text>;
        }
        default:
            return null;
    }
});

interface BoardNameColProps {
    sections: Section[];
    collapsed: Set<string>;
    totalCount: number | null;
    hasMore: boolean;
    loadingMore: boolean;
    colors: any;
    isDark: boolean;
    onToggle: (key: string) => void;
    onNavigate: (taskId: string, taskName: string) => void;
    onAddTask: () => void;
}

const BoardNameCol = React.memo(function BoardNameCol({
    sections,
    collapsed,
    totalCount,
    hasMore,
    loadingMore,
    colors,
    isDark,
    onToggle,
    onNavigate,
    onAddTask,
}: BoardNameColProps) {
    return (
        <View pointerEvents="box-none">
            {sections.map(section => (
                <View key={section.key} pointerEvents="box-none">
                    {/* Section header */}
                    <View style={{ flexDirection: "row", width: "100%", alignItems: "center" }} pointerEvents="box-none">
                        <TouchableOpacity
                            style={[s.secFrozen, { width: NAME_W, height: SEC_H, backgroundColor: isDark ? "#181818" : "#f9fafb", borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)", borderTopWidth: 1, borderTopColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }]}
                            onPress={() => onToggle(section.key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[s.secTitle, { color: colors.text }]}>{section.title}</Text>
                            <View style={[s.secBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }]}>
                                <Text style={[s.secBadgeTxt, { color: colors.textDim }]}>
                                    {section.key === sections[0]?.key && totalCount !== null
                                        ? totalCount
                                        : section.data.length}
                                </Text>
                            </View>
                            <Ionicons
                                name={collapsed.has(section.key) ? "chevron-forward" : "chevron-down"}
                                size={12}
                                color={colors.textDim}
                                style={{ marginLeft: "auto" }}
                            />
                        </TouchableOpacity>

                        {/* Add task button */}
                        <View style={{ flex: 1, height: SEC_H, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingRight: SPACING.md, backgroundColor: isDark ? "#181818" : "#f9fafb", borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)", borderBottomWidth: StyleSheet.hairlineWidth }} pointerEvents="box-none">
                            <TouchableOpacity onPress={onAddTask} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Add task">
                                <Ionicons name="add" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Name cells */}
                    {!collapsed.has(section.key) && section.data.map((task, rowIndex) => (
                        <TouchableOpacity
                            key={task.id}
                            style={[s.nameCell, { width: NAME_W, height: ROW_H, backgroundColor: rowIndex % 2 === 0 ? colors.surface : (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.012)"), borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)", borderLeftWidth: 3, borderLeftColor: getStatusHex(task.status), paddingHorizontal: 8 }]}
                            activeOpacity={0.65}
                            onPress={() => onNavigate(task.id, task.name)}
                        >
                            <View style={{ flex: 1 }}>
                                {(task.project?.name || task.parentTask?.name) ? (
                                    <Text
                                        style={{ fontSize: 10, fontFamily: FONTS.medium, color: colors.textDim }}
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
                                    style={{
                                        fontSize: 13,
                                        fontFamily: FONTS.bold,
                                        color: colors.text,
                                        marginTop: (task.project?.name || task.parentTask?.name) ? 2 : 0,
                                    }}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {task.name}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            ))}

            {/* Loading indicator at bottom */}
            {hasMore && (
                <View style={{ height: 50, alignItems: "center", justifyContent: "center", width: NAME_W, backgroundColor: colors.background }}>
                    {loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                </View>
            )}
            <View style={{ height: 20 }} pointerEvents="none" />
        </View>
    );
});
