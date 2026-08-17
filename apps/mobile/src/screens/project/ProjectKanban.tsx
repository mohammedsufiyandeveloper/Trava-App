import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    Alert
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET, ThemeColors, FONTS } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { updateTask, getTasks, deleteTask, getProject } from "../../services/api";
import { Task, TaskStatus } from "../../types";
import { useWorkspace } from "../../context/WorkspaceContext";
import StatusPickerModal from "../../components/StatusPickerModal";
import ReviewCommentModal from "../../components/ReviewCommentModal";
import CreateSubTaskModal from "../../components/CreateSubTaskModal";
import PressableScale from "../../components/PressableScale";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COLUMN_WIDTH = SCREEN_WIDTH * 0.82;

const STATUS_COLOR_MAP: Record<string, keyof ThemeColors> = {
    TO_DO: "statusTodo",
    IN_PROGRESS: "statusInProgress",
    REVIEW: "statusReview",
    HOLD: "statusHold",
    COMPLETED: "statusCompleted",
    CANCELLED: "statusCancelled",
};

/** Resolve a task/column status to its themed hex color, reusing the shared map above. */
function statusThemeColor(status: string | undefined, colors: ThemeColors): string {
    const key = STATUS_COLOR_MAP[status ?? "TO_DO"] ?? "statusTodo";
    return colors[key];
}

interface ProjectKanbanProps {
    projectId: string;
    navigation: any;
    refreshData: () => void;
    parentId?: string;
    tasks?: Task[];
}

interface KanbanColumn {
    title: string;
    status: string;
    icon: keyof typeof Ionicons.glyphMap;
}

function normalizeManager(candidate: any) {
    if (!candidate) return null;

    const workspaceMember = candidate.WorkspaceMember || candidate.workspaceMember;
    const user = workspaceMember?.user || candidate.user || candidate;

    return {
        id: user?.id || candidate.id || workspaceMember?.userId,
        userId: candidate.userId || workspaceMember?.userId || user?.id,
        name: user?.name || candidate.name || "",
        surname: user?.surname || candidate.surname || "",
        image: user?.image || candidate.image,
        projectRole: candidate.projectRole,
    };
}

const resolveProjectManager = (managersList?: any[] | null) => {
    if (!managersList || managersList.length === 0) return null;
    // Prioritize PROJECT_MANAGER over LEAD
    const pm = managersList.find((m: any) => m?.projectRole === "PROJECT_MANAGER") ||
        managersList.find((m: any) => m?.projectRole === "LEAD") ||
        managersList[0];
    return pm;
};

export default function ProjectKanban({ projectId, navigation, refreshData, parentId, tasks }: ProjectKanbanProps) {
    const { colors } = useTheme();
    const { activeWorkspace, projects, refreshData: refreshWorkspaceData } = useWorkspace();

    // Removed redundant refreshWorkspaceData loop that caused infinite refreshes

    React.useEffect(() => {
        console.log(`[ProjectKanban] Props ID: "${projectId}"`);
        console.log("[ProjectKanban] Context Projects:", JSON.stringify(projects.map(p => ({ id: p.id, name: p.name, hasManagers: (p as any).projectManagers?.length > 0 })), null, 2));
    }, [projectId, projects]);

    const [localTasks, setLocalTasks] = React.useState<Task[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);

    const [statusPickerVisible, setStatusPickerVisible] = React.useState(false);
    const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);

    const [reviewModalVisible, setReviewModalVisible] = React.useState(false);
    const [pendingStatus, setPendingStatus] = React.useState<string | null>(null);

    const [createSubTaskVisible, setCreateSubTaskVisible] = React.useState(false);
    const [editingTask, setEditingTask] = React.useState<Task | null>(null);
    const [projectManager, setProjectManager] = React.useState<any>(null);

    const fetchKanbanTasks = React.useCallback(async (isRefreshing = false) => {
        if (!activeWorkspace || !projectId) return;

        if (isRefreshing) setRefreshing(true);
        else setLoading(true);

        try {
            // Fetch ALL tasks in this project but exclude parents to get only card-level subtasks
            // We use a flat fetch (no hierarchyMode) to match the web's Kanban behavior
            const result = await getTasks(activeWorkspace.id, {
                projectId,
                excludeParents: !parentId, // If parentId is provided, we want specifically those subtasks
                onlySubtasks: true,
                parentId: parentId,
                view_mode: "kanban",
                // This project-local board still groups one bounded response on
                // device. The workspace board uses the consolidated endpoint.
                limit: 200,
            });
            setLocalTasks(result.tasks);
        } catch (error) {
            console.error("[ProjectKanban] Fetch error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeWorkspace, projectId]);

    React.useEffect(() => {
        if (tasks) {
            setLocalTasks(tasks);
            setLoading(false);
        } else {
            fetchKanbanTasks();
        }
    }, [fetchKanbanTasks, tasks]);

    React.useEffect(() => {
        let cancelled = false;

        const loadProjectManager = async () => {
            if (!projectId) return;

            try {
                const project = await getProject(projectId);
                if (cancelled || !project) return;

                const explicitManager = normalizeManager(resolveProjectManager(project.projectManagers));
                const memberManager = normalizeManager(
                    resolveProjectManager(
                        project.projectMembers?.filter(
                            (member: any) =>
                                member.projectRole === "PROJECT_MANAGER" || member.projectRole === "LEAD"
                        )
                    )
                );

                setProjectManager(explicitManager || memberManager || null);
            } catch (error) {
                if (!cancelled) {
                    console.error("[ProjectKanban] Failed to load project manager:", error);
                    setProjectManager(null);
                }
            }
        };

        loadProjectManager();

        return () => {
            cancelled = true;
        };
    }, [projectId]);

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
            const updateData: any = { status: newStatus as TaskStatus };
            if (comment) updateData.comment = comment;
            if (attachmentData) updateData.attachmentData = attachmentData;

            // Optimistic update
            setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));

            await updateTask(taskId, updateData);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Re-fetch to be sure
            fetchKanbanTasks();
            if (refreshData) refreshData();

            setReviewModalVisible(false);
            setPendingStatus(null);
        } catch (error: any) {
            console.error("Error updating task status:", error);
            // Revert on error
            fetchKanbanTasks();
            Alert.alert("Access Denied", error.message || "Failed to update status. Please try again.");
        }
    };

    const handleReviewSubmit = async (comment: string, attachmentData?: any) => {
        if (selectedTask && pendingStatus) {
            await handleStatusUpdate(selectedTask.id, pendingStatus, comment, attachmentData);
        }
    };

    const handleMoreOptions = (task: Task) => {
        Alert.alert(
            task.name,
            "Manage Task",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Edit Task",
                    onPress: () => {
                        setEditingTask(task);
                        setCreateSubTaskVisible(true);
                    }
                },
                {
                    text: "Delete Task",
                    style: "destructive",
                    onPress: () => confirmDelete(task)
                }
            ]
        );
    };

    const handleLongPress = (task: Task) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedTask(task);
        setStatusPickerVisible(true);
    };

    const confirmDelete = (task: Task) => {
        Alert.alert(
            "Delete Task",
            `Are you sure you want to delete "${task.name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteTask(task.id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            fetchKanbanTasks();
                            if (refreshData) refreshData();
                        } catch (error: any) {
                            Alert.alert("Error", error.message || "Failed to delete task");
                        }
                    }
                }
            ]
        );
    };

    const columns: KanbanColumn[] = [
        { title: "To Do", status: "TO_DO", icon: "list" },
        { title: "In Progress", status: "IN_PROGRESS", icon: "play-circle" },
        { title: "Review", status: "REVIEW", icon: "eye" },
        { title: "Completed", status: "COMPLETED", icon: "checkmark-circle" },
        { title: "Hold", status: "HOLD", icon: "pause-circle" },
        { title: "Cancelled", status: "CANCELLED", icon: "close-circle" },
    ];

    const renderTaskCard = (task: Task) => {
        const statusColor = statusThemeColor(task.status, colors);

        // Due-urgency: distinct hue family from status, per design tokens.
        const isDoneOrClosed = task.status === "COMPLETED" || task.status === "CANCELLED";
        let urgencyColor = colors.textDim;
        let isOverdue = false;
        if (task.dueDate && !isDoneOrClosed) {
            const diffDays = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
                urgencyColor = colors.urgencyOverdue;
                isOverdue = true;
            } else if (diffDays <= 2) {
                urgencyColor = colors.urgencyDueSoon;
            } else {
                urgencyColor = colors.urgencyOnTrack;
            }
        }

        // Subtasks show the parent task context in the breadcrumb
        return (
            <PressableScale
                key={task.id}
                haptic="light"
                style={[
                    styles.taskCard,
                    {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderLeftColor: statusColor,
                    }
                ]}
                onPress={() => navigation.navigate("TaskDetail", {
                    taskId: task.id,
                    taskName: task.name
                })}
                onLongPress={() => handleLongPress(task)}
                delayLongPress={300}
                accessibilityRole="button"
                accessibilityLabel={`${task.name}, ${task.status?.replace("_", " ") ?? "To Do"}${isOverdue ? ", overdue" : ""}`}
            >
                {/* Card Header: Breadcrumb style + Project Manager / actions at top right */}
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <Text style={[styles.projectText, { color: colors.textDim }]}>
                            {(task.project?.name || "No Project").toUpperCase()}
                        </Text>
                        {task.parentTaskId && (
                            <>
                                <Text style={[styles.separator, { color: colors.textDim }]}>/</Text>
                                <Text style={[styles.parentText, { color: colors.textDim }]}>
                                    {task.parentTask?.name?.toUpperCase()}
                                </Text>
                            </>
                        )}
                    </View>

                    {/* Explicit status-change entry point (drag is not the only way to move a card) */}
                    <PressableScale
                        haptic="selection"
                        style={styles.cardMenuBtn}
                        onPress={() => handleLongPress(task)}
                        accessibilityRole="button"
                        accessibilityLabel="Task options"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={16} color={colors.textDim} />
                    </PressableScale>

                    {/* Project Manager attribution */}
                    {(() => {
                        // Priority 1: Use projectManagers from the task's own project object (new payload)
                        // Priority 2: Use the hoisted projectManager state (fetched for the current project)
                        // Priority 3: Fallback to global projects context
                        const taskManagers = (task.project as any)?.projectManagers;
                        const contextManagers = projects.find(p => p.id === task.projectId || p.name?.toLowerCase() === task.project?.name?.toLowerCase())?.projectManagers;

                        const firstManager = normalizeManager(resolveProjectManager(taskManagers)) ||
                            (task.projectId === projectId ? projectManager : null) ||
                            normalizeManager(resolveProjectManager(contextManagers));

                        if (localTasks.length > 0 && localTasks[0].id === task.id) {
                            console.log(`[ProjectKanban] Task: "${task.name}", Manager Found: ${!!firstManager}, Name: ${firstManager?.name}`);
                        }

                        return (
                            <View style={[styles.memberInfoRow, { marginLeft: 8 }]}>
                                <View style={{ alignItems: "flex-end", marginRight: 6 }}>
                                    <Text style={[styles.roleLabel, { color: colors.statusReview }]}>Manager</Text>
                                    <Text style={[styles.memberSurname, { color: colors.text }]}>
                                        {firstManager?.surname || firstManager?.name || "None"}
                                    </Text>
                                </View>
                                <View style={[styles.avatarCircle, { backgroundColor: colors.statusReview + "30", borderColor: colors.statusReview }]}>
                                    {firstManager ? (
                                        <Text style={[styles.avatarText, { color: colors.statusReview }]}>
                                            {(firstManager.surname?.[0] || firstManager.name?.[0]).toUpperCase()}
                                        </Text>
                                    ) : (
                                        <Ionicons name="person-outline" size={10} color={colors.textDim} />
                                    )}
                                </View>
                            </View>
                        );
                    })()}
                </View>

                {/* Task Name */}
                <Text style={[styles.taskName, { color: colors.text }]}>
                    {task.name}
                </Text>

                {/* Card Footer */}
                <View style={styles.taskFooter}>
                    <View style={styles.footerLeft}>
                        <View style={styles.footerIconBox}>
                            <Ionicons name="chatbubble-outline" size={12} color={colors.textDim} />
                            <Text style={[styles.footerIconText, { color: colors.textDim }]}>
                                {task.commentCount || 0}
                            </Text>
                        </View>

                        <View style={styles.footerIconBox}>
                            <Ionicons
                                name="calendar-outline"
                                size={12}
                                color={task.dueDate && !isDoneOrClosed ? urgencyColor : colors.textDim}
                            />
                            <Text style={[
                                styles.footerIconText,
                                { color: task.dueDate && !isDoneOrClosed ? urgencyColor : colors.textDim }
                            ]}>
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" }) : "No date"}
                            </Text>
                        </View>
                    </View>

                    {/* Assignee Avatar at bottom right */}
                    <View style={[styles.memberInfoRow, { marginLeft: 8 }]}>
                        <View style={{ alignItems: "flex-end", marginRight: 6 }}>
                            <Text style={[styles.roleLabel, { color: colors.textDim }]}>Assignee</Text>
                            <Text style={[styles.memberSurname, { color: colors.text }]}>
                                {task.assignee?.surname || task.assignee?.name || "None"}
                            </Text>
                        </View>
                        <View style={[styles.avatarCircle, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                            {task.assignee ? (
                                <Text style={[styles.avatarText, { color: colors.textDim }]}>
                                    {(task.assignee.surname?.[0] || task.assignee.name?.[0]).toUpperCase()}
                                </Text>
                            ) : (
                                <Ionicons name="person-outline" size={10} color={colors.textDim} />
                            )}
                        </View>
                    </View>
                </View>
            </PressableScale>
        );
    };

    const renderColumn = (column: KanbanColumn) => {
        // Exclude parent tasks (isParent === true means it's a container with subtasks, not a kanban card)
        const columnTasks = localTasks
            .filter(t => !t.isParent && t.status === column.status)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const statusColor = statusThemeColor(column.status, colors);
        const statusBg = `${statusColor}1E`;

        return (
            <View
                key={column.status}
                style={[
                    styles.column,
                    {
                        // Dense, data-heavy content: keep the column solid, not glass.
                        backgroundColor: colors.surfaceSolid,
                        borderColor: colors.borderLight
                    }
                ]}
            >
                <View style={styles.columnHeader}>
                    <View style={[styles.headerIconBox, { backgroundColor: statusBg }]}>
                        <Ionicons name={column.icon} size={14} color={statusColor} />
                    </View>
                    <Text style={[styles.columnTitle, { color: colors.text }]} numberOfLines={1}>{column.title}</Text>
                    <View style={[styles.countBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.countText, { color: statusColor }]}>{columnTasks.length}</Text>
                    </View>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.columnScrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); fetchKanbanTasks(true); }}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {columnTasks.map(renderTaskCard)}

                    {columnTasks.length === 0 && (
                        <View style={[styles.emptyColumn, { borderColor: colors.divider }]}>
                            <Ionicons name="document-text-outline" size={24} color={colors.textDim} style={{ marginBottom: 8 }} />
                            <Text style={[styles.emptyText, { color: colors.textDim }]}>No tasks</Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <>
            <ScrollView
                horizontal
                style={[styles.container, { backgroundColor: colors.background }]}
                contentContainerStyle={styles.content}
                showsHorizontalScrollIndicator={false}
                snapToInterval={COLUMN_WIDTH + SPACING.md}
                decelerationRate="fast"
                nestedScrollEnabled={true}
                overScrollMode="never"
            >
                {columns.map(renderColumn)}

                <StatusPickerModal
                    visible={statusPickerVisible}
                    onClose={() => setStatusPickerVisible(false)}
                    onSelect={(status) => handleStatusUpdate(selectedTask?.id || "", status)}
                    currentStatus={selectedTask?.status || ""}
                    onMorePress={selectedTask ? () => handleMoreOptions(selectedTask) : undefined}
                />
            </ScrollView>

            <ReviewCommentModal
                visible={reviewModalVisible}
                onClose={() => setReviewModalVisible(false)}
                onSubmit={handleReviewSubmit}
                taskName={selectedTask?.name || ""}
            />

            <CreateSubTaskModal
                visible={createSubTaskVisible}
                onClose={() => {
                    setCreateSubTaskVisible(false);
                    setEditingTask(null);
                    fetchKanbanTasks();
                    if (refreshData) refreshData();
                }}
                editingTask={editingTask}
                initialProjectId={projectId}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    content: { padding: SPACING.md, gap: SPACING.md },
    column: { width: COLUMN_WIDTH, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, overflow: "hidden", maxHeight: "100%" },
    columnHeader: { flexDirection: "row", alignItems: "center", padding: SPACING.md, gap: SPACING.sm },
    headerIconBox: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    columnTitle: { fontSize: 16, fontFamily: FONTS.bold, flex: 1 },
    columnScrollContent: { padding: SPACING.sm, paddingBottom: SPACING.bottomTabBar },
    countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    countText: { fontSize: 11, fontFamily: FONTS.extrabold },

    taskCard: {
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderLeftWidth: 4,
        marginBottom: SPACING.sm,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" },
    cardMenuBtn: {
        width: TOUCH_TARGET.min - 12,
        height: TOUCH_TARGET.min - 12,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 4,
    },
    projectDot: { width: 8, height: 8, borderRadius: 4 },
    projectText: { fontSize: 10, fontFamily: FONTS.bold, textTransform: "uppercase" },
    separator: { fontSize: 10, opacity: 0.3 },
    parentText: { fontSize: 10, fontFamily: FONTS.medium, opacity: 0.8 },
    taskName: { fontSize: 14, fontFamily: FONTS.semibold, lineHeight: 20, marginBottom: 12 },
    taskFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    footerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    footerIconBox: { flexDirection: "row", alignItems: "center", gap: 4 },
    footerIconText: { fontSize: 11, fontFamily: FONTS.semibold },
    avatarCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, justifyContent: "center", alignItems: "center" },
    avatarText: { fontSize: 10, fontFamily: FONTS.extrabold },

    memberInfoRow: { flexDirection: "row", alignItems: "center" },
    roleLabel: { fontSize: 8, fontFamily: FONTS.bold, textTransform: "uppercase", opacity: 0.6, marginBottom: 1 },
    memberSurname: { fontSize: 11, fontFamily: FONTS.bold },

    emptyColumn: { margin: SPACING.md, padding: SPACING.xl, alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderWidth: 1, borderRadius: BORDER_RADIUS.md, opacity: 0.5 },
    emptyText: { fontSize: 12, fontFamily: FONTS.medium },
});
