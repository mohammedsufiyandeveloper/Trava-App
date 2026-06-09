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
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { getLeaveRequests, updateLeaveStatus } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";

export default function AdminLeaveScreen({ navigation }: any) {
    const { colors } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [requests, setRequests] = useState<any[]>([]);

    const loadRequests = useCallback(async () => {
        if (!activeWorkspace?.id) return;
        try {
            const data = await getLeaveRequests(activeWorkspace.id, false);
            setRequests(data);
        } catch (error) {
            console.error("Failed to load team requests:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeWorkspace?.id]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const onRefresh = () => {
        haptics.light();
        setRefreshing(true);
        loadRequests();
    };

    const handleAction = (request: any, status: "APPROVED" | "REJECTED") => {
        Alert.alert(
            `${status.charAt(0) + status.slice(1).toLowerCase()} Leave`,
            `Are you sure you want to ${status.toLowerCase()} this leave request for ${request.WorkspaceMember.user.surname || request.WorkspaceMember.user.name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: status === "APPROVED" ? "Approve" : "Reject",
                    style: status === "APPROVED" ? "default" : "destructive",
                    onPress: async () => {
                        try {
                            await updateLeaveStatus(activeWorkspace!.id, request.id, status);
                            Alert.alert("Success", `Leave request ${status.toLowerCase()} successfully.`);
                            loadRequests();
                        } catch (error: any) {
                            Alert.alert("Error", error.message || "Failed to update status");
                        }
                    }
                }
            ]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "APPROVED": return "#10b981";
            case "REJECTED": return "#ef4444";
            case "PENDING": return "#f59e0b";
            default: return colors.textDim;
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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>Team Leaves</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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
                                <Text style={[styles.statusBadge, { color: getStatusColor(req.status) }]}>{req.status}</Text>
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
                                        onPress={() => handleAction(req, "REJECTED")}
                                    >
                                        <Text style={styles.rejectBtnText}>Reject</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.approveBtn, { backgroundColor: colors.primary }]}
                                        onPress={() => handleAction(req, "APPROVED")}
                                    >
                                        <Text style={styles.approveBtnText}>Approve</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.lg },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    title: { fontSize: 20, fontWeight: "700" },
    scrollContent: { padding: SPACING.lg },
    emptyState: { alignItems: "center", marginTop: 40 },
    emptyText: { marginTop: 12, fontSize: 16 },
    requestCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
    userRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    avatarFallback: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
    userName: { fontSize: 15, fontWeight: "700" },
    userEmail: { fontSize: 12, marginTop: 2 },
    statusBadge: { fontSize: 11, fontWeight: "800" },
    infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    typeText: { fontSize: 10, fontWeight: "700" },
    dateText: { fontSize: 14, fontWeight: "600" },
    reason: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
    actionRow: { flexDirection: "row", gap: SPACING.md },
    actionBtn: { flex: 1, height: 40, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    rejectBtn: { borderWidth: 1, borderColor: "#ef4444" },
    rejectBtnText: { color: "#ef4444", fontWeight: "700" },
    approveBtn: {},
    approveBtnText: { color: "#fff", fontWeight: "700" },
});
