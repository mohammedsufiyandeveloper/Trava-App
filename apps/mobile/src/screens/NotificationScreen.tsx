import React, { useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    StatusBar,
    RefreshControl,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNotifications, NotificationItem } from "../context/NotificationContext";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { haptics } from "../services/haptics";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET, FONTS } from "../constants/theme";
import { RootStackParamList } from "../types";
import { format, isToday, isYesterday } from "date-fns";
import { useResponsive } from "../hooks/useResponsive";
import { getTaskById } from "../services/api";
import PressableScale from "../components/PressableScale";
import EmptyState from "../components/EmptyState";
import AmbientBackground from "../components/AmbientBackground";

type NotifRow =
    | { rowType: "header"; key: string; label: string }
    | { rowType: "item"; key: string; data: NotificationItem };

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

export default function NotificationScreen({ navigation }: Props) {
    const { notifications, markAsRead, clearAll, markAllAsRead, refresh, loading } = useNotifications();
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const workspaceRole = (activeWorkspace as any)?.workspaceRole;
    const isWorkspaceAdmin = workspaceRole === "OWNER" || workspaceRole === "ADMIN";

    // Display-only grouping into Today / Yesterday / Earlier sections. Purely
    // derived from the existing `notifications` list — no change to fetch,
    // pagination, or mark-read behavior.
    const rows = useMemo<NotifRow[]>(() => {
        const groups: { label: string; items: NotificationItem[] }[] = [
            { label: "Today", items: [] },
            { label: "Yesterday", items: [] },
            { label: "Earlier", items: [] },
        ];
        notifications.forEach((n) => {
            const d = new Date(n.receivedAt);
            if (isToday(d)) groups[0].items.push(n);
            else if (isYesterday(d)) groups[1].items.push(n);
            else groups[2].items.push(n);
        });
        const result: NotifRow[] = [];
        groups.forEach((group) => {
            if (group.items.length === 0) return;
            result.push({ rowType: "header", key: `header-${group.label}`, label: group.label });
            group.items.forEach((item) => result.push({ rowType: "item", key: item.id, data: item }));
        });
        return result;
    }, [notifications]);

    const handlePress = async (item: NotificationItem) => {
        markAsRead(item.id);

        // Deep linking logic
        if (item.data?.entityId && (item.data?.entityType === "TASK" || item.data?.entityType === "SUBTASK")) {
            let isSubtask = item.data.entityType === "SUBTASK" ||
                item.data.action?.includes("SUBTASK");
            let pId = item.data.projectId;
            let projName = "Project";
            let apiTask = null;

            try {
                apiTask = await getTaskById(item.data.entityId);
                if (apiTask) {
                    isSubtask = !!apiTask.parentTaskId;
                    if (apiTask.projectId) pId = apiTask.projectId;
                    if (apiTask.project?.name) projName = apiTask.project.name;
                }
            } catch (err) {
                console.error("Error looking up task in notification click:", err);
            }

            if (!apiTask) {
                navigation.navigate("TaskDetail", {
                    taskId: item.data.entityId,
                    taskName: isSubtask ? `Subtask #${item.data.entityId.slice(-4)}` : `Task #${item.data.entityId.slice(-4)}`,
                    notificationTitle: item.title,
                    notificationBody: item.body,
                    isSubtask: isSubtask,
                    taskData: item.data
                });
                return;
            }

            if (item.data.action === "COMMENT_CREATED") {
                navigation.navigate("TaskDetail", {
                    taskId: item.data.entityId,
                    taskName: isSubtask ? `Subtask #${item.data.entityId.slice(-4)}` : `Task #${item.data.entityId.slice(-4)}`,
                    openMessages: true,
                    notificationTitle: item.title,
                    notificationBody: item.body,
                    isSubtask: isSubtask,
                    taskData: item.data
                });
            } else if (item.data.action === "TASK_CREATED" || item.data.action === "TASK_UPDATED" || (!isSubtask && item.data.entityType === "TASK")) {
                if (pId) {
                    navigation.navigate("ProjectDetail", {
                        projectId: pId,
                        projectName: projName,
                        initialTab: "Tasks"
                    });
                } else {
                    navigation.navigate("TaskDetail", {
                        taskId: item.data.entityId,
                        taskName: item.title || "Task Details",
                        notificationTitle: item.title,
                        notificationBody: item.body,
                        isSubtask: isSubtask,
                        taskData: item.data
                    });
                }
            } else {
                navigation.navigate("TaskDetail", {
                    taskId: item.data.entityId,
                    taskName: isSubtask ? `Subtask #${item.data.entityId.slice(-4)}` : `Task #${item.data.entityId.slice(-4)}`,
                    notificationTitle: item.title,
                    notificationBody: item.body,
                    isSubtask: isSubtask,
                    taskData: item.data
                });
            }
        } else if (item.data?.entityType === "MEMBER" &&
            (item.data?.action === "MEMBER_INVITED" || item.data?.action === "MEMBER_REMOVED")) {
            const isInvite = item.data.action === "MEMBER_INVITED";
            const title = isInvite ? "Member Invited" : "Member Removed";

            // Get the TARGET person's name (person who was invited/removed, NOT who did the action)
            // MEMBER_INVITED: newData = { email, name, surname: niceName || name, role }
            // MEMBER_REMOVED: newData = { name: <removed person's surname> }
            let targetName: string | null = null;
            if (isInvite) {
                // surname = niceName (display name), name = first name entered in the form
                targetName =
                    item.data?.newData?.surname ||
                    item.data?.payload?.surname ||
                    item.data?.newData?.name ||
                    item.data?.payload?.name ||
                    item.data?.surname ||
                    item.data?.name ||
                    null;
            } else {
                // deleteMemberAction stores removed person's surname as newData.name / surname
                targetName =
                    item.data?.newData?.surname ||
                    item.data?.payload?.surname ||
                    item.data?.newData?.name ||
                    item.data?.payload?.name ||
                    item.data?.oldData?.surname ||
                    item.data?.oldData?.name ||
                    item.data?.surname ||
                    item.data?.name ||
                    null;
            }

            const detail = targetName
                ? (isInvite
                    ? `${targetName} was invited to the workspace`
                    : `${targetName} was removed from the workspace`)
                : (item.data?.isAuditLog ? item.title : item.body);

            Alert.alert(title, detail, [
                { text: "OK", style: "cancel" }
            ]);
        } else if (item.data?.type === "direct_message" && item.data?.conversationId) {
            navigation.navigate("DirectChat", {
                conversationId: item.data.conversationId,
                otherUserId: item.data.senderId,
                otherUserName: item.data.senderName || "Chat"
            });
        } else if (
            item.data?.entityType === "LEAVE_REQUEST" ||
            (typeof item.data?.action === "string" && item.data.action.startsWith("LEAVE_REQUEST_"))
        ) {
            // A submitted/pending request is addressed to reviewers; an approval or
            // rejection is addressed to the requester. Non-admins are always sent to
            // their own leave screen — the admin review API rejects them, so
            // AdminLeave would render empty.
            const action = item.data?.action;
            const needsReview =
                action === "LEAVE_REQUEST_SUBMITTED" || action === "LEAVE_REQUEST_PENDING";

            if (needsReview && isWorkspaceAdmin) {
                navigation.navigate("AdminLeave");
            } else {
                navigation.navigate("Leave");
            }
        }
    };

    const formatNotifTime = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isToday(d) || isYesterday(d)) {
            return format(d, "h:mm a");
        }
        return format(d, "MMM d");
    };

    const renderNotification = (item: NotificationItem) => {
        const isUnread = !item.isRead;
        
        return (
            <PressableScale
                haptic="selection"
                style={[
                    styles.notifItem,
                    isUnread ? {
                        backgroundColor: "rgba(251, 191, 36, 0.02)",
                        borderColor: "rgba(251, 191, 36, 0.25)",
                    } : {
                        backgroundColor: colors.surfaceSolid ?? "rgba(255, 255, 255, 0.03)",
                        borderColor: colors.border ?? "rgba(255, 255, 255, 0.05)",
                    }
                ]}
                onPress={() => handlePress(item)}
                accessibilityLabel={`${isUnread ? "Unread. " : ""}${item.title}`}
            >
                {/* Minimalist dot indicator wrapper */}
                <View style={[
                    styles.indicatorWrapper, 
                    { backgroundColor: isUnread ? "rgba(251, 191, 36, 0.12)" : "rgba(255, 255, 255, 0.05)" }
                ]}>
                    <View style={[
                        styles.indicatorDot, 
                        { backgroundColor: isUnread ? "#fbbf24" : "#555555" }
                    ]} />
                </View>

                <View style={styles.notifContent}>
                    <View style={styles.notifHeader}>
                        <Text
                            style={[styles.notifTitle, { color: colors.text, fontFamily: isUnread ? FONTS.bold : FONTS.semibold }]}
                            numberOfLines={1}
                        >
                            {item.title}
                        </Text>
                        <Text style={[styles.notifTime, { color: colors.textDim }]}>
                            {formatNotifTime(item.receivedAt)}
                        </Text>
                    </View>
                    <Text style={[styles.notifBody, { color: isUnread ? colors.textDim : colors.textMuted }]} numberOfLines={2}>
                        {item.body}
                    </Text>
                </View>
            </PressableScale>
        );
    };

    const renderRow = ({ item }: { item: NotifRow }) => {
        if (item.rowType === "header") {
            return (
                <Text style={[styles.groupHeader, { color: colors.textDim }]}>{item.label.toUpperCase()}</Text>
            );
        }
        return renderNotification(item.data);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <AmbientBackground />

            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: "rgba(255,255,255,0.06)", paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <PressableScale onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
                        <Ionicons name="chevron-back" size={26} color={colors.text} />
                    </PressableScale>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
                    <TouchableOpacity onPress={markAllAsRead} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={{ color: "#fbbf24", fontFamily: FONTS.bold, fontSize: 15 }}>Mark all read</Text>
                    </TouchableOpacity>
                </View>

                {notifications.length > 0 ? (
                    <FlatList
                        data={rows}
                        renderItem={renderRow}
                        keyExtractor={item => item.key}
                        contentContainerStyle={[styles.listContent, { paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}
                        refreshControl={
                            <RefreshControl
                                refreshing={loading}
                                onRefresh={() => { haptics.light(); refresh(); }}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                            />
                        }
                    />
                ) : (
                    <EmptyState
                        icon="notifications-off-outline"
                        title="All Caught Up!"
                        message="No new notifications at the moment."
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: SPACING.lg,
        paddingVertical: 18,
        borderBottomWidth: 1,
    },
    backBtn: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, justifyContent: "center", alignItems: "flex-start" },
    headerTitle: { fontSize: 20, fontFamily: FONTS.extrabold, letterSpacing: -0.5 },

    listContent: { padding: SPACING.md, paddingBottom: 40 },
    groupHeader: { fontSize: 12, fontFamily: FONTS.extrabold, letterSpacing: 1.2, marginTop: SPACING.md, marginBottom: SPACING.xs, paddingHorizontal: 4 },

    notifItem: {
        flexDirection: "row",
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 10,
        alignItems: "center",
    },
    indicatorWrapper: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    indicatorDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    notifContent: { flex: 1 },
    notifHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    notifTitle: { fontSize: 14, fontFamily: FONTS.bold, flex: 1, marginRight: 8 },
    notifTime: { fontSize: 11, fontFamily: FONTS.medium },
    notifBody: { fontSize: 13, lineHeight: 18 },
});
