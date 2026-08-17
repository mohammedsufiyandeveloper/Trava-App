import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    TextInput,
    Alert,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";
import { useWorkspace } from "../context/WorkspaceContext";
import { SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import {
    getIndentRequest,
    getVendors,
    approveIndentQuantity,
    addVendorQuote,
    approveQuote,
    rejectIndentLineItem,
    deleteIndent,
} from "../services/api";
import { useResponsive } from "../hooks/useResponsive";
import StatusChip, { StatusKind } from "../components/StatusChip";
import ConfirmationSheet from "../components/ConfirmationSheet";
import PressableScale from "../components/PressableScale";

export default function IndentDetailScreen({ route, navigation }: any) {
    const { indentId } = route.params;
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const isAdmin = activeWorkspace?.workspaceRole === "ADMIN" || activeWorkspace?.workspaceRole === "OWNER";

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [indent, setIndent] = useState<any>(null);
    const [vendors, setVendors] = useState<any[]>([]);

    // Modals
    const [quoteModalVisible, setQuoteModalVisible] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [selectedVendor, setSelectedVendor] = useState<any>(null);
    const [quotePrice, setQuotePrice] = useState("");
    const [quoteQty, setQuoteQty] = useState("");
    const [quoteLeadTime, setQuoteLeadTime] = useState("");
    const [quoteNotes, setQuoteNotes] = useState("");
    const [quoteSubmitting, setQuoteSubmitting] = useState(false);

    // Reject prompt modal
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectSubmitting, setRejectSubmitting] = useState(false);

    // Destructive delete confirmation
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const loadData = useCallback(async () => {
        if (!activeWorkspace?.id || !indentId) return;
        try {
            const [indentData, vendorsData] = await Promise.all([
                getIndentRequest(activeWorkspace.id, indentId),
                getVendors(activeWorkspace.id)
            ]);
            setIndent(indentData);
            setVendors(vendorsData);
        } catch (error) {
            console.error("IndentDetailScreen load error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeWorkspace?.id, indentId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        haptics.light();
        setRefreshing(true);
        loadData();
    };

    const handleDeleteIndent = () => {
        setDeleteConfirmVisible(true);
    };

    const confirmDeleteIndent = async () => {
        if (!activeWorkspace?.id) return;
        setDeleting(true);
        try {
            await deleteIndent(activeWorkspace.id, indentId);
            haptics.success();
            setDeleteConfirmVisible(false);
            navigation.goBack();
        } catch (error: any) {
            haptics.error();
            Alert.alert("Error", error.message || "Failed to delete indent.");
        } finally {
            setDeleting(false);
        }
    };

    const handleApproveQuantity = async (itemId: string) => {
        if (!activeWorkspace?.id) return;
        try {
            await approveIndentQuantity(activeWorkspace.id, itemId);
            Alert.alert("Success", "Quantity approved! Item is now in RFQ phase.");
            loadData();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to approve quantity.");
        }
    };

    const handleOpenQuoteModal = (itemId: string, defaultQty: number) => {
        setSelectedItemId(itemId);
        setQuoteQty(String(defaultQty));
        setQuoteModalVisible(true);
    };

    const handleAddQuote = async () => {
        if (!activeWorkspace?.id || !selectedItemId) return;
        if (!selectedVendor) {
            Alert.alert("Error", "Please select a vendor");
            return;
        }
        if (!quotePrice || isNaN(Number(quotePrice)) || Number(quotePrice) <= 0) {
            Alert.alert("Error", "Please enter a valid price");
            return;
        }

        setQuoteSubmitting(true);
        try {
            await addVendorQuote(activeWorkspace.id, selectedItemId, {
                vendorId: selectedVendor.id,
                unitPrice: Number(quotePrice),
                quantity: Number(quoteQty),
                leadTimeDays: quoteLeadTime ? parseInt(quoteLeadTime, 10) : undefined,
                notes: quoteNotes.trim() || undefined,
            });
            Alert.alert("Success", "Supplier quote submitted successfully.");
            setQuoteModalVisible(false);
            setQuotePrice("");
            setSelectedVendor(null);
            setQuoteNotes("");
            setQuoteLeadTime("");
            loadData();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to add quote.");
        } finally {
            setQuoteSubmitting(false);
        }
    };

    const handleApproveQuote = async (itemId: string, quoteId: string) => {
        if (!activeWorkspace?.id) return;
        try {
            await approveQuote(activeWorkspace.id, itemId, quoteId);
            Alert.alert("Success", "Quote approved! Item status set to APPROVED.");
            loadData();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to approve quote.");
        }
    };

    const handleOpenRejectModal = (itemId: string) => {
        setSelectedItemId(itemId);
        setRejectModalVisible(true);
    };

    const handleRejectItem = async () => {
        if (!activeWorkspace?.id || !selectedItemId) return;
        if (!rejectReason.trim()) {
            Alert.alert("Error", "Please enter a reason for rejection");
            return;
        }

        setRejectSubmitting(true);
        try {
            await rejectIndentLineItem(activeWorkspace.id, selectedItemId, rejectReason.trim());
            Alert.alert("Success", "Material request rejected.");
            setRejectModalVisible(false);
            setRejectReason("");
            loadData();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to reject item.");
        } finally {
            setRejectSubmitting(false);
        }
    };

    const statusChipKind = (status: string): StatusKind => {
        switch (status) {
            case "APPROVED":
                return "success";
            case "REJECTED":
            case "CANCELLED":
                return "error";
            case "PENDING":
            case "DRAFT":
                return "neutral";
            case "RFQ_SENT":
                return "info";
            case "QUOTES_RECEIVED":
            case "SUBMITTED":
                return "warning";
            case "ASSIGNED":
                return "info";
            default:
                return "neutral";
        }
    };

    const getItemStatusStyles = (status: string) => {
        switch (status) {
            case "APPROVED":
                return { bg: "#dcfce7", text: "#166534", label: "Approved" };
            case "REJECTED":
                return { bg: "#fee2e2", text: "#991b1b", label: "Rejected" };
            case "PENDING":
                return { bg: "#f3f4f6", text: "#374151", label: "Pending Approval" };
            case "RFQ_SENT":
                return { bg: "#dbeafe", text: "#1e40af", label: "RFQ Sent" };
            case "QUOTES_RECEIVED":
                return { bg: "#fef3c7", text: "#92400e", label: "Quotes Ready" };
            default:
                return { bg: "#f3f4f6", text: "#374151", label: status };
        }
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    if (!indent) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                <Text style={{ color: colors.text, fontSize: 16, marginTop: 12 }}>Indent not found</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                
                {/* Header */}
                <View style={[styles.header, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                        <Text style={[styles.title, { color: colors.text }]}>{indent.indentId || "IND-RAW"}</Text>
                        <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: FONTS.semibold }}>REQUEST DETAILS</Text>
                    </View>
                    
                    {/* Delete button for drafts or admins */}
                    {(indent.status === "DRAFT" || isAdmin) && (
                        <PressableScale
                            haptic="light"
                            onPress={handleDeleteIndent}
                            style={styles.deleteBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Delete indent request"
                        >
                            <Ionicons name="trash-outline" size={22} color={colors.error} />
                        </PressableScale>
                    )}
                </View>

                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                    showsVerticalScrollIndicator={false}
                >
                    {/* General Specs — solid surface: financial/status data must stay high-contrast */}
                    <View style={[styles.mainCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <Text style={[styles.indentName, { color: colors.text }]}>{indent.name}</Text>
                            <StatusChip label={indent.status} kind={statusChipKind(indent.status)} size="sm" />
                        </View>

                        {indent.description ? (
                            <Text style={[styles.indentDesc, { color: colors.textDim }]}>{indent.description}</Text>
                        ) : null}

                        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

                        <View style={styles.gridRow}>
                            <View style={styles.gridCol}>
                                <Text style={[styles.gridLabel, { color: colors.textDim }]}>PROJECT</Text>
                                <Text style={[styles.gridValue, { color: colors.text }]}>{indent.Project?.name || "Global"}</Text>
                            </View>
                            <View style={styles.gridCol}>
                                <Text style={[styles.gridLabel, { color: colors.textDim }]}>EXPECTED DELIVERY</Text>
                                <Text style={[styles.gridValue, { color: colors.text }]}>
                                    {indent.expectedDelivery ? format(new Date(indent.expectedDelivery), "MMM dd, yyyy") : "Immediate"}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.gridRow, { marginTop: 12 }]}>
                            <View style={styles.gridCol}>
                                <Text style={[styles.gridLabel, { color: colors.textDim }]}>REQUESTED BY</Text>
                                <Text style={[styles.gridValue, { color: colors.text }]}>
                                    {indent.WorkspaceMember_indent_requestedByIdToWorkspaceMember?.user?.surname || 
                                     indent.WorkspaceMember_indent_requestedByIdToWorkspaceMember?.user?.name || "Requestor"}
                                </Text>
                            </View>
                            <View style={styles.gridCol}>
                                <Text style={[styles.gridLabel, { color: colors.textDim }]}>ASSIGNED TO</Text>
                                <Text style={[styles.gridValue, { color: colors.text }]}>
                                    {indent.WorkspaceMember_indent_assignedToIdToWorkspaceMember?.user?.surname || 
                                     indent.WorkspaceMember_indent_assignedToIdToWorkspaceMember?.user?.name || "Not Assigned"}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Materials Checklist */}
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Requested Materials ({indent.indent_line_item?.length ?? 0})</Text>

                    {indent.indent_line_item && indent.indent_line_item.map((item: any) => {
                        const itemStyle = getItemStatusStyles(item.status);
                        return (
                            <View
                                key={item.id}
                                style={[styles.itemCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}
                            >
                                <View style={styles.itemHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.itemNameText, { color: colors.text }]}>{item.materialName}</Text>
                                        <Text style={[styles.itemQtyText, { color: colors.textDim }]}>
                                            Requested: {item.quantity} {item.unit} {item.estimatedUnitPrice ? `• Est: ₹${item.estimatedUnitPrice}/unit` : ""}
                                        </Text>
                                    </View>

                                    <StatusChip label={itemStyle.label} kind={statusChipKind(item.status)} size="sm" />
                                </View>

                                {item.specifications ? (
                                    <Text style={[styles.itemSpecText, { color: colors.textDim }]}>
                                        Specs: {item.specifications}
                                    </Text>
                                ) : null}

                                {item.rejectionReason ? (
                                    <Text style={[styles.itemRejectionText, { color: colors.error }]}>
                                        Rejection Reason: "{item.rejectionReason}"
                                    </Text>
                                ) : null}

                                {/* Admin Action: Approve Qty / Reject */}
                                {isAdmin && item.status === "PENDING" && (
                                    <View style={styles.actionRow}>
                                        <PressableScale
                                            haptic="light"
                                            style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(52,211,153,0.16)" : "#dcfce7" }]}
                                            onPress={() => handleApproveQuantity(item.id)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Approve quantity for ${item.materialName}`}
                                        >
                                            <Ionicons name="checkmark-circle-outline" size={16} color={colors.validationSuccess} />
                                            <Text style={[styles.actionBtnText, { color: colors.validationSuccess }]}>Approve Qty</Text>
                                        </PressableScale>

                                        <PressableScale
                                            haptic="warning"
                                            style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(248,113,113,0.16)" : "#fee2e2" }]}
                                            onPress={() => handleOpenRejectModal(item.id)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Reject request for ${item.materialName}`}
                                        >
                                            <Ionicons name="close-circle-outline" size={16} color={colors.error} />
                                            <Text style={[styles.actionBtnText, { color: colors.error }]}>Reject</Text>
                                        </PressableScale>
                                    </View>
                                )}

                                {/* Leads Quote Upload Option */}
                                {(isAdmin || activeWorkspace?.workspaceRole === "MANAGER" || activeWorkspace?.workspaceRole === "PROCUREMENT") &&
                                 (item.status === "RFQ_SENT" || item.status === "QUOTES_RECEIVED") && (
                                    <View style={styles.actionRow}>
                                        <PressableScale
                                            haptic="light"
                                            style={[styles.actionBtn, { borderColor: colors.primary, borderWidth: 1 }]}
                                            onPress={() => handleOpenQuoteModal(item.id, item.quantity)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Add vendor quote for ${item.materialName}`}
                                        >
                                            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                                            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Add Vendor Quote</Text>
                                        </PressableScale>
                                    </View>
                                )}

                                {/* Display Submitted Quotes if any */}
                                {item.vendor_quote_vendor_quote_lineItemIdToindent_line_item?.length > 0 && (
                                    <View style={styles.quotesSection}>
                                        <Text style={[styles.quotesTitle, { color: colors.text }]}>SUPPLIER QUOTES COMPARISON</Text>
                                        {item.vendor_quote_vendor_quote_lineItemIdToindent_line_item.map((quote: any) => {
                                            const isQuoteApproved = item.approvedQuoteId === quote.id;
                                            return (
                                                <View
                                                    key={quote.id}
                                                    style={[
                                                        styles.quoteRow,
                                                        { borderColor: colors.border },
                                                        isQuoteApproved && { backgroundColor: isDark ? "#14532d" : "#dcfce7", borderColor: "#166534" }
                                                    ]}
                                                >
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.quoteVendorText, { color: colors.text }]}>
                                                            {quote.vendor?.name || "Supplier"}
                                                        </Text>
                                                        <Text style={[styles.quotePriceText, { color: colors.textDim }]}>
                                                            ₹{quote.unitPrice}/unit • Total: ₹{quote.totalPrice} {quote.leadTimeDays ? `• ${quote.leadTimeDays} days deliv` : ""}
                                                        </Text>
                                                        {quote.notes ? (
                                                            <Text style={[styles.quoteNotesText, { color: colors.textDim }]}>
                                                                Notes: "{quote.notes}"
                                                            </Text>
                                                        ) : null}
                                                    </View>

                                                    {isAdmin && item.status === "QUOTES_RECEIVED" && (
                                                        <PressableScale
                                                            haptic="light"
                                                            style={[styles.miniApproveBtn, { backgroundColor: colors.primary }]}
                                                            onPress={() => handleApproveQuote(item.id, quote.id)}
                                                            accessibilityRole="button"
                                                            accessibilityLabel={`Approve quote from ${quote.vendor?.name || "supplier"}`}
                                                        >
                                                            <Text style={styles.miniApproveBtnText}>Approve</Text>
                                                        </PressableScale>
                                                    )}

                                                    {isQuoteApproved && (
                                                        <View style={styles.approvedQuoteBadge}>
                                                            <Ionicons name="checkmark-circle" size={18} color="#166534" />
                                                            <Text style={{ color: "#166534", fontSize: 10, fontFamily: FONTS.extrabold, marginLeft: 2 }}>APPROVED</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>

                {/* Add Vendor Quote Modal */}
                <Modal visible={quoteModalVisible} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Vendor Quote</Text>
                                <TouchableOpacity onPress={() => setQuoteModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
                                <Text style={[styles.label, { color: colors.textDim }]}>Select Supplier *</Text>
                                <View style={styles.pickerRow}>
                                    {vendors.map((v) => (
                                        <TouchableOpacity
                                            key={v.id}
                                            style={[
                                                styles.pickerPill,
                                                { borderColor: colors.border },
                                                selectedVendor?.id === v.id && { backgroundColor: colors.primary, borderColor: colors.primary }
                                            ]}
                                            onPress={() => setSelectedVendor(v)}
                                        >
                                            <Text style={{
                                                fontFamily: FONTS.bold,
                                                fontSize: 12,
                                                color: selectedVendor?.id === v.id ? "#fff" : colors.text
                                            }}>{v.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.row}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.textDim }]}>Quoted Unit Price (₹) *</Text>
                                        <TextInput
                                            style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            value={quotePrice}
                                            onChangeText={setQuotePrice}
                                            keyboardType="numeric"
                                            placeholder="450"
                                            placeholderTextColor={colors.textDim}
                                        />
                                    </View>
                                    <View style={{ width: SPACING.md }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.textDim }]}>Quantity Quoted *</Text>
                                        <TextInput
                                            style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            value={quoteQty}
                                            onChangeText={setQuoteQty}
                                            keyboardType="numeric"
                                            placeholder="100"
                                            placeholderTextColor={colors.textDim}
                                        />
                                    </View>
                                </View>

                                <Text style={[styles.label, { color: colors.textDim }]}>Delivery Lead Time (Days)</Text>
                                <TextInput
                                    style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={quoteLeadTime}
                                    onChangeText={setQuoteLeadTime}
                                    keyboardType="numeric"
                                    placeholder="3"
                                    placeholderTextColor={colors.textDim}
                                />

                                <Text style={[styles.label, { color: colors.textDim }]}>Quoting Notes</Text>
                                <TextInput
                                    style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={quoteNotes}
                                    onChangeText={setQuoteNotes}
                                    placeholder="e.g. Price valid for 7 days..."
                                    placeholderTextColor={colors.textDim}
                                />

                                <TouchableOpacity
                                    style={[styles.modalAddBtn, { backgroundColor: colors.primary }]}
                                    onPress={handleAddQuote}
                                    disabled={quoteSubmitting}
                                >
                                    {quoteSubmitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.modalAddBtnText}>Submit Quote</Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {/* Reject Reason Modal */}
                <Modal visible={rejectModalVisible} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Reject Material Request</Text>
                                <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.form}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Rejection Reason *</Text>
                                <TextInput
                                    style={[styles.modalInput, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={rejectReason}
                                    onChangeText={setRejectReason}
                                    placeholder="e.g. Budget exceeded / Incorrect material specifications..."
                                    placeholderTextColor={colors.textDim}
                                    multiline
                                    numberOfLines={3}
                                />

                                <TouchableOpacity
                                    style={[styles.modalAddBtn, { backgroundColor: "#ef4444" }]}
                                    onPress={handleRejectItem}
                                    disabled={rejectSubmitting}
                                >
                                    {rejectSubmitting ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.modalAddBtnText}>Reject Material</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <ConfirmationSheet
                    visible={deleteConfirmVisible}
                    title="Delete indent request?"
                    description="This will permanently delete this indent request and its line items. This cannot be undone."
                    tone="destructive"
                    confirmLabel="Delete Request"
                    loading={deleting}
                    onConfirm={confirmDeleteIndent}
                    onClose={() => setDeleteConfirmVisible(false)}
                />

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    title: { fontSize: 24, fontFamily: FONTS.extrabold, letterSpacing: -0.5 },
    deleteBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
    
    scrollContent: { paddingBottom: 60 },
    sectionTitle: { fontSize: 15, fontFamily: FONTS.bold, marginTop: SPACING.xl, marginBottom: SPACING.sm },
    
    mainCard: { padding: 16, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
    indentName: { fontSize: 18, fontFamily: FONTS.bold, flex: 1, marginRight: 8 },
    indentDesc: { fontSize: 13, lineHeight: 18, marginTop: 4 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontFamily: FONTS.extrabold },
    cardDivider: { height: 1, marginVertical: 14, opacity: 0.3 },
    
    gridRow: { flexDirection: "row", justifyContent: "space-between" },
    gridCol: { flex: 1 },
    gridLabel: { fontSize: 9, fontFamily: FONTS.extrabold, letterSpacing: 0.5, marginBottom: 2 },
    gridValue: { fontSize: 13, fontFamily: FONTS.bold },
    
    itemCard: { padding: 16, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: 12 },
    itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
    itemNameText: { fontSize: 15, fontFamily: FONTS.bold },
    itemQtyText: { fontSize: 12, fontFamily: FONTS.semibold, marginTop: 2 },
    itemStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    itemStatusText: { fontSize: 9, fontFamily: FONTS.extrabold },
    itemSpecText: { fontSize: 12, fontFamily: FONTS.medium, marginTop: 4, fontStyle: "italic" },
    itemRejectionText: { fontSize: 12, fontFamily: FONTS.bold, marginTop: 6, fontStyle: "italic" },
    
    actionRow: { flexDirection: "row", gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
    actionBtn: { flex: 1, height: 38, borderRadius: 8, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4 },
    actionBtnText: { fontSize: 12, fontFamily: FONTS.bold },
    
    quotesSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
    quotesTitle: { fontSize: 10, fontFamily: FONTS.extrabold, letterSpacing: 0.5, marginBottom: 8 },
    quoteRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
    quoteVendorText: { fontSize: 13, fontFamily: FONTS.bold },
    quotePriceText: { fontSize: 11, fontFamily: FONTS.medium, marginTop: 2 },
    quoteNotesText: { fontSize: 11, fontStyle: "italic", marginTop: 2 },
    miniApproveBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
    miniApproveBtnText: { color: "#fff", fontSize: 10, fontFamily: FONTS.extrabold },
    approvedQuoteBadge: { flexDirection: "row", alignItems: "center" },
    
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.xl, maxHeight: "90%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg },
    modalTitle: { fontSize: 18, fontFamily: FONTS.bold },
    form: { marginBottom: SPACING.xl },
    label: { fontSize: 12, fontFamily: FONTS.semibold, marginBottom: 6 },
    modalInput: { height: 44, borderRadius: BORDER_RADIUS.md, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, marginBottom: 12 },
    textArea: { height: 80, textAlignVertical: "top", paddingVertical: 8 },
    
    pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    pickerPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
    
    row: { flexDirection: "row" },
    modalAddBtn: { marginTop: SPACING.lg, height: 48, borderRadius: BORDER_RADIUS.md, justifyContent: "center", alignItems: "center" },
    modalAddBtnText: { color: "#fff", fontSize: 15, fontFamily: FONTS.bold },
});
