import React from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { deleteTask } from "../../services/api";
import { Task } from "../../types";

interface ProjectTaskListProps {
    projectId: string;
    tasks: Task[];
    loading: boolean;
    refreshData: () => void;
    navigation: any;
    onEditTask?: (task: Task) => void;
}

export default function ProjectTaskList({
    projectId,
    tasks,
    loading,
    refreshData,
    navigation,
    onEditTask
}: ProjectTaskListProps) {
    const { colors } = useTheme();
    const { activeWorkspace, projects } = useWorkspace();

    const handleLongPress = (item: Task) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            item.name,
            "What would you like to do with this task?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Edit",
                    onPress: () => onEditTask?.(item)
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => confirmDelete(item)
                }
            ]
        );
    };

    const confirmDelete = (item: Task) => {
        Alert.alert(
            "Delete Task",
            `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteTask(item.id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            refreshData();
                        } catch (error: any) {
                            Alert.alert("Error", error.message || "Failed to delete task");
                        }
                    }
                }
            ]
        );
    };

    const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
    const { getCachedSession } = require("../../services/api");

    React.useEffect(() => {
        getCachedSession().then((s: any) => setCurrentUserId(s?.user?.id || null));
    }, []);

    const isFullView = React.useMemo(() => {
        if (!activeWorkspace || !currentUserId) return false;
        const role = activeWorkspace.workspaceRole;
        const project = projects.find(p => p.id === projectId);
        // In the Project type, projectManagers objects use 'id' as the user identifier
        const isProjectManager = project?.projectManagers?.some(m => m.id === currentUserId);
        return role === "ADMIN" || role === "OWNER" || role === "MANAGER" || isProjectManager;
    }, [activeWorkspace, projects, projectId, currentUserId]);

    // Filter for top-level tasks of this project (those without a parentTaskId)
    const parentTasks = (tasks || [])
        .filter(t => t.projectId === projectId && (t.parentTaskId === null || t.parentTaskId === undefined))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const renderItem = ({ item }: { item: Task }) => {
        // Calculate subtasks from the flat tasks array
        const visibleSubTasks = (tasks || []).filter(t => t.parentTaskId === item.id);

        // Use the count of visible subtasks from the flat list
        // For Members, this is the only accurate way to show their assigned count
        // For Admins/Managers, if the subtasks aren't in the list (e.g. not expanded), 
        // we fall back to the server-side total count.
        const totalSubCount = visibleSubTasks.length > 0
            ? visibleSubTasks.length
            : (isFullView ? (item.subtaskCount ?? item._count?.subTasks ?? 0) : 0);

        const hasSubtasks = totalSubCount > 0;

        return (
            <TouchableOpacity
                style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => {
                    navigation.navigate("ProjectSubTasks", {
                        parentId: item.id,
                        parentName: item.name,
                        projectId: item.projectId
                    });
                }}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={500}
            >
                <View style={styles.taskHeader}>
                    <Text style={[styles.taskName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {hasSubtasks && (
                        <View style={[styles.subtaskBadge, { backgroundColor: colors.primary + "20" }]}>
                            <Text style={[styles.subtaskText, { color: colors.primary }]}>{totalSubCount}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (loading && parentTasks.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    return (
        <FlatList
            data={parentTasks}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refreshData} tintColor={colors.primary} />}
            ListEmptyComponent={
                <View style={styles.empty}>
                    <Ionicons name="list-outline" size={48} color={colors.textDim} />
                    <Text style={[styles.emptyText, { color: colors.textDim }]}>No main tasks in this project yet.</Text>
                </View>
            }
        />
    );
}

// Add these to your styles object at the bottom of the file


const styles = StyleSheet.create({
    list: { padding: SPACING.md, paddingBottom: SPACING.bottomTabBar },
    taskCard: { borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1 },
    taskHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    taskName: { fontSize: 16, fontWeight: "600", maxWidth: "85%" },
    tagBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    tagText: { fontSize: 10, fontWeight: "700" },

    taskFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTopWidth: 1 },
    meta: { flexDirection: "row", alignItems: "center" },
    metaText: { fontSize: 12, marginLeft: 6 },

    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    empty: { marginTop: 60, alignItems: "center" },
    emptyText: { fontSize: 14, marginTop: 12 },
    subtaskBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
        marginRight: 4,
    },
    subtaskText: {
        fontSize: 10,
        fontWeight: "800",
    },
});
