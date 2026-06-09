import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, DeviceEventEmitter } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { haptics } from "../../services/haptics";
import { useWorkspace } from "../../context/WorkspaceContext";
import { getActivities, getCachedSession, getTaskById } from "../../services/api";
import { Task } from "../../types";
import { format } from "date-fns";

interface ProjectDashboardProps {
    projectId: string;
    tasks: Task[];
    isManagerOfProject?: boolean;
    onStatPress?: (label: string) => void;
    onRefresh?: () => Promise<void>;
    navigation?: any;
}

export default function ProjectDashboard({ projectId, tasks, isManagerOfProject, onStatPress, onRefresh, navigation }: ProjectDashboardProps) {
    const { colors, isDark } = useTheme();
    const { activeWorkspace, workspaces } = useWorkspace();
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        getCachedSession().then(s => setCurrentUserId(s?.user?.id || null));
    }, []);

    const isAdminOrOwner = React.useMemo(() => {
        if (!activeWorkspace || !currentUserId) return false;
        const wsFromList = workspaces.find(w => w.id === activeWorkspace?.id);
        const role = activeWorkspace?.workspaceRole || wsFromList?.workspaceRole;
        const isOwner = (activeWorkspace?.ownerId && activeWorkspace.ownerId === currentUserId) ||
            (wsFromList?.ownerId && wsFromList.ownerId === currentUserId);
        return role === "ADMIN" || role === "OWNER" || role === "MANAGER" || isOwner;
    }, [activeWorkspace, workspaces, currentUserId]);

    const isFullView = isAdminOrOwner || isManagerOfProject;

    const handleRefresh = async () => {
        haptics.light();
        setRefreshing(true);
        try {
            await Promise.all([
                fetchActivities(),
                onRefresh ? onRefresh() : Promise.resolve()
            ]);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (activeWorkspace?.id) {
            fetchActivities();
        }
    }, [activeWorkspace?.id, projectId, isAdminOrOwner]);

    useEffect(() => {
        if (tasks && tasks.length > 0) {
            const parents = tasks.filter(t => !t.parentTaskId);
            const subtasks = tasks.filter(t => t.parentTaskId);
            console.log(`[ProjectDashboard] Total: ${tasks.length} | Parents: ${parents.length} | Subtasks: ${subtasks.length}`);
            console.log(`[ProjectDashboard] First few tasks IDs:`, tasks.slice(0, 3).map(t => `${t.name} (Parent: ${t.parentTaskId || "None"}, Assignee: ${t.assigneeId || "Unassigned"})`));
            console.log(`[ProjectDashboard] Current User ID: ${currentUserId} | isFullView: ${isFullView}`);
        }
    }, [tasks, currentUserId, isFullView]);

    const fetchActivities = React.useCallback(async () => {
        try {
            setLoading(true);
            // Fetch activities: universal for managers, personalized for members
            const data = await getActivities(activeWorkspace!.id, projectId, !isAdminOrOwner);
            setActivities(data);
        } catch (e) {
            console.error("Dashboard fetchActivities error:", e);
        } finally {
            setLoading(false);
        }
    }, [activeWorkspace, projectId, isAdminOrOwner]);

    React.useEffect(() => {
        const sub = DeviceEventEmitter.addListener("remote_update", () => {
            // Fetch silently without full loading spinner if already loaded
            getActivities(activeWorkspace!.id, projectId, !isAdminOrOwner)
                .then(setActivities)
                .catch(() => { });
        });
        return () => sub.remove();
    }, [activeWorkspace, projectId, isAdminOrOwner]);

    const handleActivityPress = async (act: any) => {
        if (!act.entityId) return;

        let isSubtask = act.entityType === "SUBTASK" || act.action?.includes("SUBTASK");
        let pId = projectId;

        // Find task in local list if possible
        const localTask = allVisibleTasks.find(t => t.id === act.entityId);
        if (localTask) {
            isSubtask = !!localTask.parentTaskId;
            if (localTask.projectId) pId = localTask.projectId;
        } else {
            // Fetch task details from API
            try {
                const apiTask = await getTaskById(act.entityId);
                if (apiTask) {
                    isSubtask = !!apiTask.parentTaskId;
                    if (apiTask.projectId) pId = apiTask.projectId;
                }
            } catch (err) {
                console.error("Error looking up task in activity click:", err);
            }
        }

        if (act.action === "COMMENT_CREATED") {
            navigation?.navigate("TaskDetail", {
                taskId: act.entityId,
                taskName: isSubtask ? `Subtask #${act.entityId.slice(-4)}` : `Task #${act.entityId.slice(-4)}`,
                openMessages: true
            });
        } else if (act.action === "TASK_CREATED" || act.action === "TASK_UPDATED" || (!isSubtask && act.entityType === "TASK")) {
            navigation?.navigate("ProjectDetail", {
                projectId: pId,
                projectName: localTask?.project?.name || "Project",
                initialTab: "Tasks"
            });
        } else {
            navigation?.navigate("TaskDetail", {
                taskId: act.entityId,
                taskName: isSubtask ? `Subtask #${act.entityId.slice(-4)}` : `Task #${act.entityId.slice(-4)}`
            });
        }
    };

    const flattenTasks = (taskList: Task[]): Task[] => {
        let flat: Task[] = [];
        taskList.forEach(t => {
            flat.push(t);
            if (t.subTasks && t.subTasks.length > 0) {
                flat = flat.concat(flattenTasks(t.subTasks));
            }
        });
        return flat;
    };



    // Flatten the tasks list and deduplicate by ID to ensure we don't count the same subtask twice
    // (since api.ts already flattens, but parents still retain their subTasks array)
    const allVisibleTasks = React.useMemo(() => {
        const uniqueTasks = new Map<string, Task>();
        const traverse = (list: Task[]) => {
            list.forEach(t => {
                if (!uniqueTasks.has(t.id)) {
                    uniqueTasks.set(t.id, t);
                }
                if (t.subTasks && t.subTasks.length > 0) traverse(t.subTasks);
            });
        };
        traverse(tasks || []);
        return Array.from(uniqueTasks.values());
    }, [tasks]);

    // Sum up the subtask counts
    const { totalSubTasksCount, completedSubTasksCount } = allVisibleTasks.reduce((acc, t) => {
        // A "subtask" is any task that has a parentTaskId.
        // We count these directly from the visible tasks list to ensure the dashboard
        // stats exactly match what the user sees in the subtask lists.
        if (t.parentTaskId) {
            acc.totalSubTasksCount += 1;
            if (t.status === "COMPLETED") acc.completedSubTasksCount += 1;
        }
        return acc;
    }, { totalSubTasksCount: 0, completedSubTasksCount: 0 });

    const pendingSubTasksCount = totalSubTasksCount - completedSubTasksCount;

    // Unified stats view focusing on subtasks
    const stats = [
        {
            label: "Total Sub Tasks",
            value: totalSubTasksCount,
            icon: "layers" as const,
            color: colors.info
        },
        {
            label: "Completed Sub Tasks",
            value: completedSubTasksCount,
            icon: "checkmark-circle" as const,
            color: colors.success
        },
        {
            label: "Pending Sub Tasks",
            value: pendingSubTasksCount,
            icon: "time" as const,
            color: colors.warning
        },
    ];

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
        >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {isFullView ? "Project Overview" : "My Project Overview"}
            </Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.statsScroll}
                style={styles.statsScrollWrapper}
            >
                {stats.map((stat, i) => (
                    <TouchableOpacity
                        key={i}
                        style={[styles.statCard, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}
                        activeOpacity={0.7}
                        onPress={() => onStatPress?.(stat.label)}
                    >
                        <View style={[styles.iconBox, { backgroundColor: stat.color + "20" }]}>
                            <Ionicons name={stat.icon} size={20} color={stat.color} />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
                            <Text style={[styles.statLabel, { color: colors.textDim }]} numberOfLines={1}>
                                {stat.label.split(" ")[0]}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>

            {loading ? (
                <View style={{ padding: 40, alignItems: "center" }}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : activities.length === 0 ? (
                <View style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border, justifyContent: "center", borderStyle: "dashed" }]}>
                    <Text style={[styles.activityText, { color: colors.textDim, textAlign: "center" }]}>
                        {isFullView ? "No workspace activity found." : "No recent activity found for your tasks."}
                    </Text>
                </View>
            ) : (
                <>
                    <View style={styles.activityList}>
                        {activities.slice(0, 5).map((act) => (
                            <TouchableOpacity
                                key={act.id}
                                style={[styles.activityItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                onPress={() => handleActivityPress(act)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.activityIconBox, { backgroundColor: colors.primary + "10" }]}>
                                    <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                        <Text style={[styles.activityText, { color: colors.text, flex: 1 }]} numberOfLines={2}>
                                            {act.text}
                                        </Text>
                                        <Text style={[styles.activityTime, { color: colors.textDim, marginLeft: 8, marginTop: 2 }]}>
                                            {format(new Date(act.createdAt), 'MMM d, h:mm a')}
                                        </Text>
                                    </View>
                                    {/* Entity sub-line removed per user request */}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {activities.length > 5 && (
                        <TouchableOpacity
                            style={{ padding: SPACING.md, alignItems: "center", marginTop: SPACING.sm }}
                            onPress={() => navigation?.navigate("ProjectActivity", { projectId, projectName: tasks[0]?.project?.name || "Project" })}
                        >
                            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
                                View All Activity
                            </Text>
                        </TouchableOpacity>
                    )}
                </>
            )}
            <View style={{ height: SPACING.bottomTabBar }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { paddingVertical: 0 },
    sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: SPACING.sm, marginTop: SPACING.md, paddingHorizontal: SPACING.lg },

    statsScrollWrapper: { marginVertical: 0 },
    statsScroll: { paddingHorizontal: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.lg },
    statCard: {
        flexDirection: "row",
        alignItems: "center",
        width: 150,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        gap: 12,
    },
    iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    textContainer: { flex: 1, justifyContent: "center" },
    statValue: { fontSize: 20, fontWeight: "800", lineHeight: 22 },
    statLabel: { fontSize: 11, fontWeight: "600", marginTop: 0, opacity: 0.8 },

    activityCard: { marginHorizontal: SPACING.lg, flexDirection: "row", alignItems: "center", padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, gap: SPACING.md },
    activityList: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
    activityItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        gap: 12,
    },
    activityIconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    activityAuthor: { fontSize: 13, fontWeight: "700" },
    activityTime: { fontSize: 10, opacity: 0.7 },
    activityText: { fontSize: 13, lineHeight: 18 },
    activityTaskName: { fontSize: 10, fontWeight: "600", opacity: 0.8 },
});
