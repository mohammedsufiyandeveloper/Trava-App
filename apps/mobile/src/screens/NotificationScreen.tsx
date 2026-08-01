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
import { haptics } from "../services/haptics";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET } from "../constants/theme";
import { RootStackParamList } from "../types";
import { format, isToday, isYesterday } from "date-fns";
import { useResponsive } from "../hooks/useResponsive";
import { getTaskById } from "../services/api";
import PressableScale from "../components/PressableScale";
import EmptyState from "../components/EmptyState";

type NotifRow =
    | { rowType: "header"; key: string; label: string }
    | { rowType: "item"; key: string; data: NotificationItem };

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

export default function NotificationScreen({ navigation }: Props) {
    const { notifications, markAsRead, clearAll, markAllAsRead, refresh, loading } = useNotifications();
    const { colors, isDark } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

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
        }
    };

    const getIcon = (action?: string) => {
        switch (action) {
            case "COMMENT_CREATED": return { name: "chatbubble-ellipses", color: colors.info };
            case "TASK_CREATED":
            case "SUBTASK_CREATED": return { name: "add-circle", color: colors.success };
            case "TASK_UPDATED":
            case "SUBTASK_UPDATED": return { name: "sync-circle", color: colors.warning };
            case "MEMBER_INVITED": return { name: "person-add", color: colors.success };
            case "MEMBER_REMOVED": return { name: "person-remove", color: "#ef4444" };
            default: return { name: "notifications", color: colors.primary };
        }
    };

    const renderNotification = (item: NotificationItem) => {
        const icon = getIcon(item.data?.action);
        return (
            <PressableScale
                haptic="selection"
                style={[
                    styles.notifItem,
                    { backgroundColor: item.isRead ? colors.surfaceSolid : colors.surfaceSolidRaised, borderColor: colors.border },
                    !item.isRead && { borderLeftColor: colors.primary, borderLeftWidth: 3 }
                ]}
                onPress={() => handlePress(item)}
                accessibilityLabel={`${item.isRead ? "" : "Unread. "}${item.title}`}
            >
                <View style={[styles.iconContainer, { backgroundColor: icon.color + "15" }]}>
                    <Ionicons name={icon.name as any} size={22} color={icon.color} />
                </View>

                <View style={styles.notifContent}>
                    <View style={styles.notifHeader}>
                        <Text
                            style={[styles.notifTitle, { color: colors.text, fontWeight: item.isRead ? "600" : "800" }]}
                            numberOfLines={1}
                        >
                            {item.title}
                        </Text>
                        <Text style={[styles.notifTime, { color: colors.textDim }]}>
                            {format(new Date(item.receivedAt), 'MMM d, h:mm a')}
                        </Text>
                    </View>
                    <Text style={[styles.notifBody, { color: item.isRead ? colors.textMuted : colors.text }]} numberOfLines={2}>
                        {item.body}
                    </Text>
                </View>

                {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
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

            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <PressableScale onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
                        <Ionicons name="chevron-back" size={26} color={colors.text} />
                    </PressableScale>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
                    <TouchableOpacity onPress={clearAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>Clear all</Text>
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
                        ListHeaderComponent={() => (
                            <View style={styles.listHeader}>
                                <Text style={[styles.sectionTitle, { color: colors.textDim }]}>RECENT ACTIVITY</Text>
                                <TouchableOpacity onPress={markAllAsRead} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Mark all as read</Text>
                                </TouchableOpacity>
                            </View>
                        )}
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
    headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },

    listContent: { padding: SPACING.md, paddingBottom: 40 },
    listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.md, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
    groupHeader: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: SPACING.sm, marginBottom: SPACING.xs, paddingHorizontal: 4 },

    notifItem: {
        flexDirection: "row",
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        marginBottom: SPACING.sm,
        alignItems: "center",
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        marginRight: SPACING.md,
    },
    notifContent: { flex: 1 },
    notifHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
    notifTitle: { fontSize: 15, fontWeight: "800", flex: 1, marginRight: 8 },
    notifTime: { fontSize: 10, fontWeight: "500" },
    notifBody: { fontSize: 13, lineHeight: 18 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
});

