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
    Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";
import { useWorkspace } from "../context/WorkspaceContext";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import {
    getIndentRequests,
    getVendors,
    approveIndentQuantity,
    addVendorQuote,
    approveQuote,
    rejectIndentLineItem,
    deleteIndent,
} from "../services/api";
import { useResponsive } from "../hooks/useResponsive";

const { width } = Dimensions.get("window");

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

    const loadData = useCallback(async () => {
        if (!activeWorkspace?.id || !indentId) return;
        try {
            const [indentsData, vendorsData] = await Promise.all([
                getIndentRequests(activeWorkspace.id),
                getVendors(activeWorkspace.id)
            ]);
            const matchedIndent = indentsData.find((ind: any) => ind.id === indentId);
            setIndent(matchedIndent || null);
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
        Alert.alert(
            "Delete Request",
            "Are you sure you want to delete this indent request permanently?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (!activeWorkspace?.id) return;
                        try {
                            await deleteIndent(activeWorkspace.id, indentId);
                            Alert.alert("Success", "Indent deleted successfully.");
                            navigation.goBack();
                        } catch (error: any) {
                            Alert.alert("Error", error.message || "Failed to delete indent.");
                        }
                    }
                }
            ]
        );
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

    const getIndentStatusStyles = (status: string) => {
        switch (status) {
            case "APPROVED":
                return { bg: "#dcfce7", text: "#166534" };
            case "CANCELLED":
                return { bg: "#fee2e2", text: "#991b1b" };
            case "SUBMITTED":
                return { bg: "#fef3c7", text: "#92400e" };
            case "ASSIGNED":
                return { bg: "#dbeafe", text: "#1e40af" };
            default:
                return { bg: "#f3f4f6", text: "#374151" };
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

    const overallStatusStyle = getIndentStatusStyles(indent.status);

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
                        <Text style={{ fontSize: 11, color: colors.textDim, fontWeight: "600" }}>REQUEST DETAILS</Text>
                    </View>
                    
                    {/* Delete button for drafts or admins */}
                    {(indent.status === "DRAFT" || isAdmin) && (
                        <TouchableOpacity onPress={handleDeleteIndent} style={styles.deleteBtn}>
                            <Ionicons name="trash-outline" size={22} color="#ef4444" />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                    showsVerticalScrollIndicator={false}
                >
                    {/* General Specs */}
                    <View style={[styles.mainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.cardHeader}>
                            <Text style={[styles.indentName, { color: colors.text }]}>{indent.name}</Text>
                            <View style={[styles.statusPill, { backgroundColor: overallStatusStyle.bg }]}>
                                <Text style={[styles.statusText, { color: overallStatusStyle.text }]}>{indent.status}</Text>
                            </View>
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
                                style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <View style={styles.itemHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.itemNameText, { color: colors.text }]}>{item.materialName}</Text>
                                        <Text style={[styles.itemQtyText, { color: colors.textDim }]}>
                                            Requested: {item.quantity} {item.unit} {item.estimatedUnitPrice ? `• Est: ₹${item.estimatedUnitPrice}/unit` : ""}
                                        </Text>
                                    </View>
                                    
                                    <View style={[styles.itemStatusBadge, { backgroundColor: itemStyle.bg }]}>
                                        <Text style={[styles.itemStatusText, { color: itemStyle.text }]}>{itemStyle.label}</Text>
                                    </View>
                                </View>

                                {item.specifications ? (
                                    <Text style={[styles.itemSpecText, { color: colors.textDim }]}>
                                        Specs: {item.specifications}
                                    </Text>
                                ) : null}

                                {item.rejectionReason ? (
                                    <Text style={[styles.itemRejectionText, { color: "#ef4444" }]}>
                                        Rejection Reason: "{item.rejectionReason}"
                                    </Text>
                                ) : null}

                                {/* Admin Action: Approve Qty / Reject */}
                                {isAdmin && item.status === "PENDING" && (
                                    <View style={styles.actionRow}>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { backgroundColor: "#dcfce7" }]}
                                            onPress={() => handleApproveQuantity(item.id)}
                                        >
                                            <Ionicons name="checkmark-circle-outline" size={16} color="#166534" />
                                            <Text style={[styles.actionBtnText, { color: "#166534" }]}>Approve Qty</Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { backgroundColor: "#fee2e2" }]}
                                            onPress={() => handleOpenRejectModal(item.id)}
                                        >
                                            <Ionicons name="close-circle-outline" size={16} color="#991b1b" />
                                            <Text style={[styles.actionBtnText, { color: "#991b1b" }]}>Reject</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Leads Quote Upload Option */}
                                {(isAdmin || activeWorkspace?.workspaceRole === "MANAGER" || activeWorkspace?.workspaceRole === "PROCUREMENT") && 
                                 (item.status === "RFQ_SENT" || item.status === "QUOTES_RECEIVED") && (
                                    <View style={styles.actionRow}>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { borderColor: colors.primary, borderWidth: 1 }]}
                                            onPress={() => handleOpenQuoteModal(item.id, item.quantity)}
                                        >
                                            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                                            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Add Vendor Quote</Text>
                                        </TouchableOpacity>
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
                                                        <TouchableOpacity
                                                            style={[styles.miniApproveBtn, { backgroundColor: colors.primary }]}
                                                            onPress={() => handleApproveQuote(item.id, quote.id)}
                                                        >
                                                            <Text style={styles.miniApproveBtnText}>Approve</Text>
                                                        </TouchableOpacity>
                                                    )}

                                                    {isQuoteApproved && (
                                                        <View style={styles.approvedQuoteBadge}>
                                                            <Ionicons name="checkmark-circle" size={18} color="#166534" />
                                                            <Text style={{ color: "#166534", fontSize: 10, fontWeight: "800", marginLeft: 2 }}>APPROVED</Text>
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
                                                fontWeight: "700",
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

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
    deleteBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
    
    scrollContent: { paddingBottom: 60 },
    sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: SPACING.xl, marginBottom: SPACING.sm },
    
    mainCard: { padding: 16, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
    indentName: { fontSize: 18, fontWeight: "700", flex: 1, marginRight: 8 },
    indentDesc: { fontSize: 13, lineHeight: 18, marginTop: 4 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: "800" },
    cardDivider: { height: 1, marginVertical: 14, opacity: 0.3 },
    
    gridRow: { flexDirection: "row", justifyContent: "space-between" },
    gridCol: { flex: 1 },
    gridLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5, marginBottom: 2 },
    gridValue: { fontSize: 13, fontWeight: "700" },
    
    itemCard: { padding: 16, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: 12 },
    itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
    itemNameText: { fontSize: 15, fontWeight: "700" },
    itemQtyText: { fontSize: 12, fontWeight: "600", marginTop: 2 },
    itemStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    itemStatusText: { fontSize: 9, fontWeight: "800" },
    itemSpecText: { fontSize: 12, fontWeight: "500", marginTop: 4, fontStyle: "italic" },
    itemRejectionText: { fontSize: 12, fontWeight: "700", marginTop: 6, fontStyle: "italic" },
    
    actionRow: { flexDirection: "row", gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
    actionBtn: { flex: 1, height: 38, borderRadius: 8, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4 },
    actionBtnText: { fontSize: 12, fontWeight: "700" },
    
    quotesSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
    quotesTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginBottom: 8 },
    quoteRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
    quoteVendorText: { fontSize: 13, fontWeight: "700" },
    quotePriceText: { fontSize: 11, fontWeight: "500", marginTop: 2 },
    quoteNotesText: { fontSize: 11, fontStyle: "italic", marginTop: 2 },
    miniApproveBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
    miniApproveBtnText: { color: "#fff", fontSize: 10, fontWeight: "800" },
    approvedQuoteBadge: { flexDirection: "row", alignItems: "center" },
    
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.xl, maxHeight: "90%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg },
    modalTitle: { fontSize: 18, fontWeight: "700" },
    form: { marginBottom: SPACING.xl },
    label: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
    modalInput: { height: 44, borderRadius: BORDER_RADIUS.md, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, marginBottom: 12 },
    textArea: { height: 80, textAlignVertical: "top", paddingVertical: 8 },
    
    pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    pickerPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
    
    row: { flexDirection: "row" },
    modalAddBtn: { marginTop: SPACING.lg, height: 48, borderRadius: BORDER_RADIUS.md, justifyContent: "center", alignItems: "center" },
    modalAddBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
