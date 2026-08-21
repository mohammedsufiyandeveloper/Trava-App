import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Modal,
    TextInput,
    Alert,
    Image,
    Dimensions,
    Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { format, differenceInDays } from "date-fns";
import { LeaveRequest, LeaveBalance, LeaveType, LeaveStatus, User } from "../types";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";
import { useWorkspace } from "../context/WorkspaceContext";
import { SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import { getLeaveBalance, getLeaveRequestsPage, submitLeaveRequest, updateLeaveStatus, getCachedSession } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";
import StatusChip, { StatusKind } from "../components/StatusChip";
import ConfirmationSheet from "../components/ConfirmationSheet";

const { width } = Dimensions.get("window");



export default function LeaveScreen({ navigation }: any) {
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const isAdmin = activeWorkspace?.workspaceRole === "ADMIN" || activeWorkspace?.workspaceRole === "OWNER";

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [balance, setBalance] = useState<LeaveBalance | null>(null);
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [hasMoreRequests, setHasMoreRequests] = useState(false);
    const [nextRequestCursor, setNextRequestCursor] = useState<string | null>(null);
    const [loadingMoreRequests, setLoadingMoreRequests] = useState(false);

    // Form state
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [leaveType, setLeaveType] = useState<LeaveType>("CASUAL");
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [actionSheet, setActionSheet] = useState<{ request: LeaveRequest; status: "APPROVED" | "REJECTED" } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const loadData = useCallback(async () => {
        if (!activeWorkspace?.id) return;
        try {
            const session = await getCachedSession();
            if (session?.user) {
                setCurrentUser(session.user);
            }
            const [balanceData, requestPage] = await Promise.all([
                getLeaveBalance(activeWorkspace.id),
                getLeaveRequestsPage(
                    activeWorkspace.id,
                    !isAdmin,
                    undefined,
                    debouncedSearch
                )
            ]);
            setBalance(balanceData);
            setRequests(requestPage.requests);
            setHasMoreRequests(requestPage.hasMore);
            setNextRequestCursor(requestPage.nextCursor);
        } catch (error) {
            console.error("LeaveScreen load error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeWorkspace?.id, debouncedSearch, isAdmin]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim());
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

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
                !isAdmin,
                nextRequestCursor,
                debouncedSearch
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
        debouncedSearch,
        hasMoreRequests,
        isAdmin,
        loadingMoreRequests,
        nextRequestCursor,
    ]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        haptics.light();
        setRefreshing(true);
        loadData();
    };

    const requestAction = (request: LeaveRequest, status: "APPROVED" | "REJECTED") => {
        haptics.warning();
        setActionSheet({ request, status });
    };

    const handleAction = async () => {
        if (!activeWorkspace?.id || !actionSheet) return;
        const { request, status } = actionSheet;
        setActionLoading(true);
        try {
            await updateLeaveStatus(activeWorkspace.id, request.id, status);
            haptics.success();
            setActionSheet(null);
            loadData();
        } catch (error: any) {
            haptics.error();
            Alert.alert("Error", error.message || "Failed to update leave status");
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!activeWorkspace?.id) return;
        if (!reason.trim()) {
            setFormError("Please provide a reason for your leave.");
            return;
        }
        setFormError(null);

        setSubmitting(true);
        try {
            await submitLeaveRequest(activeWorkspace.id, {
                startDate: format(startDate, "yyyy-MM-dd"),
                endDate: format(endDate, "yyyy-MM-dd"),
                reason,
                type: leaveType
            });
            haptics.success();
            Alert.alert("Success", "Leave request submitted successfully.");
            setIsModalOpen(false);
            setReason("");
            loadData();
        } catch (error: any) {
            haptics.error();
            setFormError(error.message || "Failed to submit leave request.");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredRequests = useMemo(() => {
        if (!searchQuery) return requests;
        return requests.filter(r =>
            r.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.WorkspaceMember.user.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [requests, searchQuery]);

    const getStatusColor = (status: LeaveStatus) => {
        switch (status) {
            case "APPROVED": return "#10b981";
            case "REJECTED": return "#ef4444";
            case "PENDING": return "#f59e0b";
            default: return colors.textDim;
        }
    };

    const getStatusKind = (status: LeaveStatus): StatusKind => {
        switch (status) {
            case "APPROVED": return "success";
            case "REJECTED": return "error";
            case "PENDING": return "warning";
            default: return "neutral";
        }
    };

    const displayReportingManager = useMemo(() => {
        if (!currentUser) return balance?.reportingManager || "Not Assigned";
        const name = currentUser.name.toLowerCase();

        if (name.includes("ajung") || name.includes("rajesh")) return "Smriti";
        if (name.includes("vivek")) return "Naveen DC";
        if (name.includes("ayush") || name.includes("sachin")) return "Varun Sir";

        return balance?.reportingManager || "Not Assigned";
    }, [currentUser, balance?.reportingManager]);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    const accrualProgress = balance?.casualLeaveAccrualDays
        ? (balance.accruedDaysCount / balance.casualLeaveAccrualDays)
        : 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                <View style={[styles.header, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <Text style={[styles.title, { color: colors.text }]}>Leaves</Text>
                        {activeWorkspace && (
                            <Text style={{ fontSize: 10, color: colors.textDim, fontFamily: FONTS.bold }}>
                                {activeWorkspace.name.toUpperCase()}
                            </Text>
                        )}
                    </View>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.primary }]}
                        onPress={() => setIsModalOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Apply for leave"
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
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
                    {/* Balance & Accrual Section */}
                    <View style={styles.dashboardSection}>
                        <View style={styles.balanceRow}>
                            <View style={[styles.balanceItem, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                                <View style={[styles.iconCircle, { backgroundColor: "#3b82f620" }]}>
                                    <Ionicons name="cafe-outline" size={20} color="#3b82f6" />
                                </View>
                                <View style={styles.balanceInfo}>
                                    <Text style={[styles.balanceVal, { color: colors.text }]}>{balance?.casualLeaveBalance ?? 0}</Text>
                                    <Text style={[styles.balanceLab, { color: colors.textDim }]}>CASUAL</Text>
                                </View>
                            </View>
                            <View style={[styles.balanceItem, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                                <View style={[styles.iconCircle, { backgroundColor: "#ef444420" }]}>
                                    <Ionicons name="thermometer-outline" size={20} color="#ef4444" />
                                </View>
                                <View style={styles.balanceInfo}>
                                    <Text style={[styles.balanceVal, { color: colors.text }]}>{balance?.sickLeaveBalance ?? 0}</Text>
                                    <Text style={[styles.balanceLab, { color: colors.textDim }]}>SICK</Text>
                                </View>
                            </View>
                        </View>

                        <View style={[styles.accrualCard, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                            <View style={styles.accrualHeader}>
                                <Ionicons name="trending-up" size={18} color="#10b981" />
                                <Text style={[styles.accrualTitle, { color: colors.text }]}>ACCRUAL PROGRESS</Text>
                                <Text style={[styles.accrualLabel, { color: colors.textDim }]}>
                                    {balance?.accruedDaysCount}/{balance?.casualLeaveAccrualDays} <Text style={{ fontSize: 10 }}>TOWARDS CREDIT</Text>
                                </Text>
                            </View>
                            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                                <View style={[styles.progressBarFill, { backgroundColor: "#10b981", width: `${accrualProgress * 100}%` }]} />
                            </View>
                        </View>
                    </View>

                    {/* Search Bar */}
                    <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons name="search" size={18} color={colors.textDim} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Search by reason..."
                            placeholderTextColor={colors.textDim}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {/* List Header - Optional for Cards, let's keep it simple */}
                    <View style={[styles.listHeader, { justifyContent: 'space-between' }]}>
                        <Text style={[styles.listCol, { color: colors.textDim }]}>RECENT REQUESTS</Text>
                        <Text style={[styles.listCol, { color: colors.textDim }]}>{filteredRequests.length} TOTAL</Text>
                    </View>

                    {/* Requests List */}
                    {filteredRequests.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="calendar-outline" size={48} color={colors.textDim} />
                            <Text style={[styles.emptyText, { color: colors.textDim }]}>No leave requests found</Text>
                        </View>
                    ) : (
                        filteredRequests.map((req) => (
                            <View key={req.id} style={[styles.requestCard, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: colors.border }]}>
                                {/* Card Header: Member & Status */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.memberInfo}>
                                        <View style={[styles.avatarSmall, { backgroundColor: colors.border }]}>
                                            {req.WorkspaceMember.user.image ? (
                                                <Image source={{ uri: req.WorkspaceMember.user.image }} style={styles.avatarImg} />
                                            ) : (
                                                <Text style={[styles.avatarTxt, { color: colors.textDim }]}>{req.WorkspaceMember.user.name.charAt(0)}</Text>
                                            )}
                                        </View>
                                        <View style={{ marginLeft: 10, flex: 1 }}>
                                            <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{req.WorkspaceMember.user.name}</Text>
                                            <Text style={[styles.memberBal, { color: colors.textDim }]} numberOfLines={1}>BAL: C:{req.WorkspaceMember.casualLeaveBalance} • S:{req.WorkspaceMember.sickLeaveBalance}</Text>
                                        </View>
                                    </View>
                                    <StatusChip label={req.status} kind={getStatusKind(req.status)} size="sm" />
                                </View>

                                {/* Card Body: Dates & Type */}
                                <View style={styles.cardBody}>
                                    <View style={styles.dateInfo}>
                                        <Ionicons name="calendar-outline" size={14} color={colors.textDim} style={{ marginRight: 6 }} />
                                        <Text style={[styles.dateSmall, { color: colors.text }]}>
                                            {format(new Date(req.startDate), "MMM d")} - {format(new Date(req.endDate), "MMM d, yyyy")}
                                        </Text>
                                    </View>
                                    <View style={[styles.typeBadgeSmall, { backgroundColor: req.type === "SICK" ? "#fee2e2" : "#dcfce7" }]}>
                                        <Text style={[styles.typeTextSmall, { color: req.type === "SICK" ? "#991b1b" : "#166534" }]}>{req.type}</Text>
                                    </View>
                                </View>

                                {/* Reason */}
                                {req.reason && (
                                    <Text style={[styles.rowReason, { color: colors.textDim }]} numberOfLines={2}>
                                        "{req.reason}"
                                    </Text>
                                )}

                                {/* Actions for Admin if Pending */}
                                {isAdmin && req.status === "PENDING" && (
                                    <View style={styles.rowActions}>
                                        <TouchableOpacity
                                            style={[styles.approveActionBtn, { backgroundColor: "#dcfce7" }]}
                                            onPress={() => requestAction(req, "APPROVED")}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Approve leave request from ${req.WorkspaceMember.user.name}`}
                                        >
                                            <Ionicons name="checkmark" size={18} color="#166534" />
                                            <Text style={styles.approveActionText}>Approve</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.approveActionBtn, { backgroundColor: "#fee2e2" }]}
                                            onPress={() => requestAction(req, "REJECTED")}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Reject leave request from ${req.WorkspaceMember.user.name}`}
                                        >
                                            <Ionicons name="close" size={18} color="#991b1b" />
                                            <Text style={[styles.approveActionText, { color: "#991b1b" }]}>Reject</Text>
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

                {/* Request Modal */}
                <Modal visible={isModalOpen} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Apply for Leave</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsModalOpen(false);
                                        setFormError(null);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Close"
                                    hitSlop={8}
                                >
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
                                {/* Reporting Manager Card */}
                                <View style={[styles.managerCard, { backgroundColor: isDark ? "#1e293b" : "#fff7ed", borderColor: isDark ? colors.border : "#ffedd5" }]}>
                                    <View style={[styles.managerIcon, { backgroundColor: "#fb923c20" }]}>
                                        <Ionicons name="person-outline" size={18} color="#fb923c" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.managerLabel, { color: colors.textDim }]}>REPORTING MANAGER</Text>
                                        <Text style={[styles.managerName, { color: colors.text }]}>{displayReportingManager}</Text>
                                    </View>
                                </View>
                                <Text style={[styles.label, { color: colors.textDim }]}>Leave Type</Text>
                                <View style={styles.typeSelector}>
                                    {(["CASUAL", "SICK"] as LeaveType[]).map((t) => (
                                        <TouchableOpacity
                                            key={t}
                                            style={[
                                                styles.typeOption,
                                                { borderColor: colors.border },
                                                leaveType === t && { backgroundColor: colors.primary, borderColor: colors.primary }
                                            ]}
                                            onPress={() => setLeaveType(t)}
                                        >
                                            <Text style={[styles.typeOptionText, { color: leaveType === t ? "#fff" : colors.text }]}>{t}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={[styles.label, { color: colors.textDim }]}>Start Date (DD-MM-YYYY)</Text>
                                <TouchableOpacity
                                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, justifyContent: 'center' }]}
                                    onPress={() => {
                                        setShowStartPicker(!showStartPicker);
                                        setShowEndPicker(false);
                                    }}
                                >
                                    <Text style={{ color: colors.text }}>{format(startDate, "dd-MM-yyyy")}</Text>
                                </TouchableOpacity>

                                {showStartPicker && (
                                    <DateTimePicker
                                        value={startDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        textColor={colors.text}
                                        themeVariant={isDark ? 'dark' : 'light'}
                                        onChange={(event, date) => {
                                            if (Platform.OS === 'android') setShowStartPicker(false);
                                            if (date) setStartDate(date);
                                        }}
                                    />
                                )}

                                <Text style={[styles.label, { color: colors.textDim }]}>End Date (DD-MM-YYYY)</Text>
                                <TouchableOpacity
                                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, justifyContent: 'center' }]}
                                    onPress={() => {
                                        setShowEndPicker(!showEndPicker);
                                        setShowStartPicker(false);
                                    }}
                                >
                                    <Text style={{ color: colors.text }}>{format(endDate, "dd-MM-yyyy")}</Text>
                                </TouchableOpacity>

                                {showEndPicker && (
                                    <DateTimePicker
                                        value={endDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        textColor={colors.text}
                                        themeVariant={isDark ? 'dark' : 'light'}
                                        onChange={(event, date) => {
                                            if (Platform.OS === 'android') setShowEndPicker(false);
                                            if (date) setEndDate(date);
                                        }}
                                    />
                                )}

                                <Text style={[styles.label, { color: colors.textDim }]}>Reason</Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        styles.textArea,
                                        { backgroundColor: colors.background, color: colors.text, borderColor: formError ? colors.error : colors.border },
                                    ]}
                                    value={reason}
                                    onChangeText={(t) => {
                                        setReason(t);
                                        if (formError) setFormError(null);
                                    }}
                                    multiline
                                    numberOfLines={4}
                                    placeholder="Provide a brief reason..."
                                    placeholderTextColor={colors.textDim}
                                />
                                {formError && (
                                    <Text style={[styles.formErrorText, { color: colors.error }]}>{formError}</Text>
                                )}

                                <TouchableOpacity
                                    style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && { opacity: 0.7 }]}
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                    accessibilityRole="button"
                                    accessibilityLabel="Submit leave request"
                                    accessibilityState={{ disabled: submitting, busy: submitting }}
                                >
                                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Request</Text>}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                <ConfirmationSheet
                    visible={!!actionSheet}
                    title={actionSheet?.status === "APPROVED" ? "Approve this leave request?" : "Reject this leave request?"}
                    description={
                        actionSheet
                            ? `${actionSheet.status === "APPROVED" ? "Approve" : "Reject"} the ${actionSheet.request.type.toLowerCase()} leave request from ${actionSheet.request.WorkspaceMember.user.name}.`
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
    title: { fontSize: 24, fontFamily: FONTS.bold },
    addButton: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
    scrollContent: { paddingBottom: 40 },

    dashboardSection: { paddingVertical: SPACING.lg, gap: SPACING.md },
    balanceRow: { flexDirection: "row", gap: SPACING.md },
    balanceItem: { flex: 1, flexDirection: "row", alignItems: "center", padding: 16, borderRadius: BORDER_RADIUS.lg },
    iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
    balanceInfo: { marginLeft: 12 },
    balanceVal: { fontSize: 20, fontFamily: FONTS.extrabold },
    balanceLab: { fontSize: 10, fontFamily: FONTS.bold, marginTop: 2 },

    accrualCard: { padding: 16, borderRadius: BORDER_RADIUS.lg },
    accrualHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    accrualTitle: { fontSize: 11, fontFamily: FONTS.extrabold, marginLeft: 8, flex: 1 },
    accrualLabel: { fontSize: 11, fontFamily: FONTS.bold },
    progressBarBg: { height: 6, borderRadius: 3, overflow: "hidden" },
    progressBarFill: { height: "100%", borderRadius: 3 },

    searchContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, height: 44, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.xl },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },

    listHeader: { flexDirection: "row", marginBottom: 12 },
    listCol: { fontSize: 11, fontFamily: FONTS.bold },


    requestCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
    cardBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    dateInfo: { flexDirection: "row", alignItems: "center" },

    rowTop: { flexDirection: "row", alignItems: "center" },
    memberInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
    avatarSmall: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", overflow: "hidden" },
    avatarImg: { width: "100%", height: "100%" },
    avatarTxt: { fontSize: 14, fontFamily: FONTS.bold },
    memberName: { fontSize: 15, fontFamily: FONTS.bold, flex: 1 },
    memberBal: { fontSize: 10, fontFamily: FONTS.semibold, marginTop: 2 },
    typeBadgeSmall: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    typeTextSmall: { fontSize: 10, fontFamily: FONTS.extrabold },

    rowCol: { justifyContent: "center" },
    dateSmall: { fontSize: 14, fontFamily: FONTS.semibold },
    durationSmall: { fontSize: 11, fontFamily: FONTS.bold, marginTop: 2 },

    statusBadgeSmall: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    statusTextSmall: { fontSize: 11, fontFamily: FONTS.extrabold },

    rowReason: { fontSize: 13, fontStyle: "italic", marginBottom: 4, lineHeight: 18 },

    rowActions: { flexDirection: "row", gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
    miniActionBtn: { width: 40, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    approveActionBtn: { flex: 1, flexDirection: "row", gap: 6, minHeight: 44, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    approveActionText: { fontSize: 13, fontFamily: FONTS.bold, color: "#166534" },
    formErrorText: { fontSize: 12, fontFamily: FONTS.semibold, marginTop: -4, marginBottom: SPACING.md },

    emptyState: { alignItems: "center", marginTop: 40 },
    emptyText: { marginTop: 12, fontSize: 16 },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.xl, maxHeight: "90%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.xl },
    modalTitle: { fontSize: 20, fontFamily: FONTS.bold },
    form: { marginBottom: SPACING.xl },
    label: { fontSize: 14, fontFamily: FONTS.semibold, marginBottom: 8, marginTop: SPACING.md },
    input: { borderRadius: BORDER_RADIUS.md, borderWidth: 1, padding: 12, fontSize: 16 },
    textArea: { height: 100, textAlignVertical: "top" },
    typeSelector: { flexDirection: "row", gap: SPACING.md },
    typeOption: { flex: 1, padding: 12, borderRadius: BORDER_RADIUS.md, borderWidth: 1, alignItems: "center" },
    typeOptionText: { fontFamily: FONTS.semibold },
    submitButton: { marginTop: SPACING.xl, padding: 16, borderRadius: BORDER_RADIUS.md, alignItems: "center" },
    submitButtonText: { color: "#fff", fontSize: 16, fontFamily: FONTS.bold },

    managerCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 20
    },
    managerIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center"
    },
    managerLabel: {
        fontSize: 10,
        fontFamily: FONTS.extrabold,
        letterSpacing: 0.5,
        marginBottom: 2
    },
    managerName: {
        fontSize: 15,
        fontFamily: FONTS.bold
    },
});
