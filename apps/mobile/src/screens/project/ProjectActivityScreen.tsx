import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SPACING, TOUCH_TARGET, FONTS } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { haptics } from "../../services/haptics";
import { useWorkspace } from "../../context/WorkspaceContext";
import { getActivities, getCachedSession, getTaskById } from "../../services/api";
import { format } from "date-fns";
import AppCard from "../../components/AppCard";
import PressableScale from "../../components/PressableScale";
import EmptyState from "../../components/EmptyState";

type Props = {
    route: { params: { projectId: string; projectName?: string; projectColor?: string } };
    navigation: any;
};

export default function ProjectActivityScreen({ route, navigation }: Props) {
    const { projectId, projectName, projectColor } = route.params;
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

    const fetchActivities = React.useCallback(async () => {
        if (!activeWorkspace?.id) return;
        try {
            setLoading(true);
            const data = await getActivities(activeWorkspace.id, projectId, !isAdminOrOwner);
            setActivities(data);
        } catch (e) {
            console.error("ProjectActivityScreen fetchActivities error:", e);
        } finally {
            setLoading(false);
        }
    }, [activeWorkspace, projectId, isAdminOrOwner]);

    const handleRefresh = async () => {
        haptics.light();
        setRefreshing(true);
        await fetchActivities();
        setRefreshing(false);
    };

    const handleActivityPress = async (act: any) => {
        if (!act.entityId) return;

        let isSubtask = act.entityType === "SUBTASK" || act.action?.includes("SUBTASK");
        let pId = projectId;
        
        try {
            const apiTask = await getTaskById(act.entityId);
            if (apiTask) {
                isSubtask = !!apiTask.parentTaskId;
                if (apiTask.projectId) pId = apiTask.projectId;
            }
        } catch (err) {
            console.error("Error looking up task in activity click:", err);
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
                projectName: projectName || "Project",
                initialTab: "Tasks"
            });
        } else {
            navigation?.navigate("TaskDetail", {
                taskId: act.entityId,
                taskName: isSubtask ? `Subtask #${act.entityId.slice(-4)}` : `Task #${act.entityId.slice(-4)}`
            });
        }
    };

    useEffect(() => {
        if (activeWorkspace?.id) {
            fetchActivities();
        }
    }, [fetchActivities, activeWorkspace?.id]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <PressableScale
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    accessibilityLabel="Go back"
                    accessibilityRole="button"
                    hitSlop={8}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </PressableScale>
                <View style={styles.titleContainer}>
                    <View style={[styles.colorDot, { backgroundColor: projectColor || colors.primary }]} />
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        Activity: {projectName}
                    </Text>
                </View>
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
                }
            >
                {loading ? (
                    <View style={{ padding: 40, alignItems: "center" }}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : activities.length === 0 ? (
                    <EmptyState icon="time-outline" title="No activity found" message="Activity for this project will show up here." />
                ) : (
                    <View style={styles.activityList}>
                        {activities.map((act) => (
                            <AppCard
                                key={act.id}
                                onPress={() => handleActivityPress(act)}
                                elevation="none"
                                padded={false}
                                style={styles.activityItem}
                                accessibilityLabel={act.text}
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
                            </AppCard>
                        ))}
                    </View>
                )}
                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, height: 60, borderBottomWidth: 1 },
    backBtn: { minWidth: TOUCH_TARGET.min, minHeight: TOUCH_TARGET.min, justifyContent: "center", alignItems: "flex-start" },
    titleContainer: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: SPACING.sm },
    colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
    title: { fontSize: 18, fontFamily: FONTS.bold },
    content: { paddingVertical: SPACING.md },
    activityList: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
    activityItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        gap: 12,
    },
    activityIconBox: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    activityTime: { fontSize: 10, opacity: 0.7 },
    activityText: { fontSize: 13, lineHeight: 18 },
    activityTaskName: { fontSize: 10, fontFamily: FONTS.semibold, opacity: 0.8 },
});
