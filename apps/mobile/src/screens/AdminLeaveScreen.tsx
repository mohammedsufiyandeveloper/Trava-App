import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";
import { useWorkspace } from "../context/WorkspaceContext";
import { SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import { getLeaveRequestsPage, updateLeaveStatus } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";
import StatusChip, { StatusKind } from "../components/StatusChip";
import ConfirmationSheet from "../components/ConfirmationSheet";

export default function AdminLeaveScreen({ navigation }: any) {
    const { colors } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [requests, setRequests] = useState<any[]>([]);
    const [hasMoreRequests, setHasMoreRequests] = useState(false);
    const [nextRequestCursor, setNextRequestCursor] = useState<string | null>(null);
    const [loadingMoreRequests, setLoadingMoreRequests] = useState(false);
    const [actionSheet, setActionSheet] = useState<{ request: any; status: "APPROVED" | "REJECTED" } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const loadRequests = useCallback(async () => {
        if (!activeWorkspace?.id) return;
        try {
            const page = await getLeaveRequestsPage(activeWorkspace.id, false);
            setRequests(page.requests);
            setHasMoreRequests(page.hasMore);
            setNextRequestCursor(page.nextCursor);
        } catch (error) {
            console.error("Failed to load team requests:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeWorkspace?.id]);

    const loadMoreRequests = useCallback(async () => {
        if (
            !activeWorkspace?.id ||
            !hasMoreRequests ||
            !nextRequestCursor ||
            loadingMoreRequests
        ) {
            return;
        }

        setLoadingMoreRequests(true);
        try {
            const page = await getLeaveRequestsPage(
                activeWorkspace.id,
                false,
                nextRequestCursor
            );
            setRequests((current) => {
                const ids = new Set(current.map((request) => request.id));
                return [
                    ...current,
                    ...page.requests.filter((request) => !ids.has(request.id)),
                ];
            });
            setHasMoreRequests(page.hasMore);
            setNextRequestCursor(page.nextCursor);
        } finally {
            setLoadingMoreRequests(false);
        }
    }, [
        activeWorkspace?.id,
        hasMoreRequests,
        loadingMoreRequests,
        nextRequestCursor,
    ]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const onRefresh = () => {
        haptics.light();
        setRefreshing(true);
        loadRequests();
    };

    const requestAction = (request: any, status: "APPROVED" | "REJECTED") => {
        haptics.warning();
        setActionSheet({ request, status });
    };

    const handleAction = async () => {
        if (!actionSheet || !activeWorkspace?.id) return;
        const { request, status } = actionSheet;
        setActionLoading(true);
        try {
            await updateLeaveStatus(activeWorkspace.id, request.id, status);
            haptics.success();
            setActionSheet(null);
            loadRequests();
        } catch (error: any) {
            haptics.error();
            Alert.alert("Error", error.message || "Failed to update status");
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "APPROVED": return "#10b981";
            case "REJECTED": return "#ef4444";
            case "PENDING": return "#f59e0b";
            default: return colors.textDim;
        }
    };

    const getStatusKind = (status: string): StatusKind => {
        switch (status) {
            case "APPROVED": return "success";
            case "REJECTED": return "error";
            case "PENDING": return "warning";
            default: return "neutral";
        }
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
            <View style={[styles.header, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>Team Leaves</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                scrollEventThrottle={200}
                onScroll={({ nativeEvent }) => {
                    const remaining =
                        nativeEvent.contentSize.height -
                        nativeEvent.layoutMeasurement.height -
                        nativeEvent.contentOffset.y;
                    if (remaining < 240) loadMoreRequests();
                }}
            >
                {requests.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={48} color={colors.textDim} />
                        <Text style={[styles.emptyText, { color: colors.textDim }]}>No leave requests to review</Text>
                    </View>
                ) : (
                    requests.map((req) => (
                        <View key={req.id} style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.userRow}>
                                {req.WorkspaceMember.user.image ? (
                                    <Image source={{ uri: req.WorkspaceMember.user.image }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatarFallback, { backgroundColor: colors.border }]}>
                                        <Text style={{ color: colors.textDim }}>{(req.WorkspaceMember.user.surname?.[0] || req.WorkspaceMember.user.name.charAt(0)).toUpperCase()}</Text>
                                    </View>
                                )}
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[styles.userName, { color: colors.text }]}>{req.WorkspaceMember.user.surname || req.WorkspaceMember.user.name}</Text>
                                    <Text style={[styles.userEmail, { color: colors.textDim }]}>{req.WorkspaceMember.user.email}</Text>
                                </View>
                                <StatusChip label={req.status} kind={getStatusKind(req.status)} size="sm" />
                            </View>

                            <View style={styles.infoRow}>
                                <View style={[styles.typeBadge, { backgroundColor: req.type === "SICK" ? "#fee2e2" : "#dcfce7" }]}>
                                    <Text style={[styles.typeText, { color: req.type === "SICK" ? "#991b1b" : "#166534" }]}>{req.type}</Text>
                                </View>
                                <Text style={[styles.dateText, { color: colors.text }]}>
                                    {format(new Date(req.startDate), "MMM d")} - {format(new Date(req.endDate), "MMM d, yyyy")}
                                </Text>
                            </View>

                            <Text style={[styles.reason, { color: colors.textDim }]}>{req.reason}</Text>

                            {req.status === "PENDING" && (
                                <View style={styles.actionRow}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.rejectBtn]}
                                        onPress={() => requestAction(req, "REJECTED")}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Reject leave request from ${req.WorkspaceMember.user.surname || req.WorkspaceMember.user.name}`}
                                    >
                                        <Text style={styles.rejectBtnText}>Reject</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.approveBtn, { backgroundColor: colors.primary }]}
                                        onPress={() => requestAction(req, "APPROVED")}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Approve leave request from ${req.WorkspaceMember.user.surname || req.WorkspaceMember.user.name}`}
                                    >
                                        <Text style={styles.approveBtnText}>Approve</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    ))
                )}
                {loadingMoreRequests && (
                    <ActivityIndicator
                        color={colors.primary}
                        style={{ paddingVertical: 16 }}
                    />
                )}
            </ScrollView>

            <ConfirmationSheet
                visible={!!actionSheet}
                title={actionSheet?.status === "APPROVED" ? "Approve this leave request?" : "Reject this leave request?"}
                description={
                    actionSheet
                        ? `${actionSheet.status === "APPROVED" ? "Approve" : "Reject"} the leave request for ${actionSheet.request.WorkspaceMember.user.surname || actionSheet.request.WorkspaceMember.user.name}.`
                        : undefined
                }
                tone={actionSheet?.status === "REJECTED" ? "destructive" : "default"}
                confirmLabel={actionSheet?.status === "APPROVED" ? "Approve" : "Reject"}
                cancelLabel="Cancel"
                loading={actionLoading}
                onConfirm={handleAction}
                onClose={() => setActionSheet(null)}
            />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.lg },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    title: { fontSize: 20, fontFamily: FONTS.bold },
    scrollContent: { padding: SPACING.lg },
    emptyState: { alignItems: "center", marginTop: 40 },
    emptyText: { marginTop: 12, fontSize: 16 },
    requestCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
    userRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
    userName: { fontSize: 15, fontFamily: FONTS.bold },
    userEmail: { fontSize: 12, marginTop: 2 },
    statusBadge: { fontSize: 11, fontFamily: FONTS.extrabold },
    infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    typeText: { fontSize: 10, fontFamily: FONTS.bold },
    dateText: { fontSize: 14, fontFamily: FONTS.semibold },
    reason: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
    actionRow: { flexDirection: "row", gap: SPACING.md },
    actionBtn: { flex: 1, height: 40, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    rejectBtn: { borderWidth: 1, borderColor: "#ef4444" },
    rejectBtnText: { color: "#ef4444", fontFamily: FONTS.bold },
    approveBtn: {},
    approveBtnText: { color: "#fff", fontFamily: FONTS.bold },
});
