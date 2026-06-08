import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Alert,
    Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { getIndentRequests, getVendors } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";

const { width } = Dimensions.get("window");

export default function ProcurementScreen({ navigation }: any) {
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<"indents" | "vendors">("indents");
    const [indents, setIndents] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!activeWorkspace?.id) return;
        try {
            const [indentsData, vendorsData] = await Promise.all([
                getIndentRequests(activeWorkspace.id),
                getVendors(activeWorkspace.id)
            ]);
            setIndents(indentsData);
            setVendors(vendorsData);
        } catch (error) {
            console.error("ProcurementScreen load error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeWorkspace?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const filteredIndents = useMemo(() => {
        if (!searchQuery) return indents;
        return indents.filter(ind =>
            ind.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (ind.indentId && ind.indentId.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (ind.Project?.name && ind.Project.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [indents, searchQuery]);

    const filteredVendors = useMemo(() => {
        if (!searchQuery) return vendors;
        return vendors.filter(v =>
            v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.companyName && v.companyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (v.email && v.email.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [vendors, searchQuery]);

    const getIndentStatusStyles = (status: string) => {
        switch (status) {
            case "APPROVED":
                return { bg: "#dcfce7", text: "#166534" }; // soft green
            case "CANCELLED":
                return { bg: "#fee2e2", text: "#991b1b" }; // soft red
            case "SUBMITTED":
                return { bg: "#fef3c7", text: "#92400e" }; // soft amber
            case "ASSIGNED":
                return { bg: "#dbeafe", text: "#1e40af" }; // soft blue
            default:
                return { bg: "#f3f4f6", text: "#374151" }; // soft gray (DRAFT)
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
                
                {/* Header */}
                <View style={[styles.header, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                        <Text style={[styles.title, { color: colors.text }]}>Procurement</Text>
                        {activeWorkspace && (
                            <Text style={{ fontSize: 10, color: colors.textDim, fontWeight: "700", letterSpacing: 0.5 }}>
                                {activeWorkspace.name.toUpperCase()}
                            </Text>
                        )}
                    </View>
                    
                    {activeTab === "indents" && (
                        <TouchableOpacity
                            style={[styles.addButton, { backgroundColor: colors.primary }]}
                            onPress={() => navigation.navigate("CreateIndent")}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Segment Tab Switcher */}
                <View style={[styles.tabContainer, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <View style={[styles.pillSwitcher, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                        <TouchableOpacity
                            style={[
                                styles.pillOption,
                                activeTab === "indents" && { backgroundColor: colors.surface }
                            ]}
                            onPress={() => {
                                setActiveTab("indents");
                                setSearchQuery("");
                            }}
                        >
                            <Text style={[
                                styles.pillText,
                                { color: activeTab === "indents" ? colors.primary : colors.textDim }
                            ]}>
                                Indents ({indents.length})
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[
                                styles.pillOption,
                                activeTab === "vendors" && { backgroundColor: colors.surface }
                            ]}
                            onPress={() => {
                                setActiveTab("vendors");
                                setSearchQuery("");
                            }}
                        >
                            <Text style={[
                                styles.pillText,
                                { color: activeTab === "vendors" ? colors.primary : colors.textDim }
                            ]}>
                                Vendors ({vendors.length})
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <Ionicons name="search" size={18} color={colors.textDim} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder={activeTab === "indents" ? "Search by name, key, project..." : "Search by vendor, company, email..."}
                        placeholderTextColor={colors.textDim}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")}>
                            <Ionicons name="close-circle" size={18} color={colors.textDim} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Main Scroll Content */}
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                    showsVerticalScrollIndicator={false}
                >
                    {activeTab === "indents" ? (
                        filteredIndents.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="cart-outline" size={54} color={colors.textDim} />
                                <Text style={[styles.emptyText, { color: colors.textDim }]}>No indents found</Text>
                            </View>
                        ) : (
                            filteredIndents.map((item) => {
                                const statusStyle = getIndentStatusStyles(item.status);
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                        onPress={() => navigation.navigate("IndentDetail", { indentId: item.id })}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.cardHeader}>
                                            <View style={styles.badgeRow}>
                                                <Text style={[styles.indentIdText, { color: colors.primary }]}>
                                                    {item.indentId || "IND-RAW"}
                                                </Text>
                                                {item.Project && (
                                                    <View style={[styles.projectBadge, { borderColor: item.Project.color || colors.primary }]}>
                                                        <Text style={{ fontSize: 10, fontWeight: "600", color: item.Project.color || colors.primary }}>
                                                            {item.Project.name.toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            
                                            <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                                                <Text style={[styles.statusText, { color: statusStyle.text }]}>
                                                    {item.status}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={[styles.indentName, { color: colors.text }]} numberOfLines={1}>
                                            {item.name}
                                        </Text>

                                        {item.description ? (
                                            <Text style={[styles.indentDesc, { color: colors.textDim }]} numberOfLines={2}>
                                                {item.description}
                                            </Text>
                                        ) : null}

                                        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

                                        <View style={styles.cardFooter}>
                                            <View style={styles.footerRow}>
                                                <Ionicons name="gift-outline" size={14} color={colors.textDim} style={{ marginRight: 4 }} />
                                                <Text style={[styles.footerText, { color: colors.textDim }]}>
                                                    {item.indent_line_item?.length ?? 0} items
                                                </Text>
                                            </View>
                                            
                                            {item.expectedDelivery && (
                                                <View style={styles.footerRow}>
                                                    <Ionicons name="calendar-outline" size={14} color={colors.textDim} style={{ marginRight: 4 }} />
                                                    <Text style={[styles.footerText, { color: colors.textDim }]}>
                                                        Deliv: {format(new Date(item.expectedDelivery), "MMM d, yyyy")}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )
                    ) : (
                        filteredVendors.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Ionicons name="people-outline" size={54} color={colors.textDim} />
                                <Text style={[styles.emptyText, { color: colors.textDim }]}>No vendors registered</Text>
                            </View>
                        ) : (
                            filteredVendors.map((vendor) => {
                                const isExpanded = expandedVendorId === vendor.id;
                                return (
                                    <TouchableOpacity
                                        key={vendor.id}
                                        style={[
                                            styles.card,
                                            { backgroundColor: colors.surface, borderColor: colors.border },
                                            isExpanded && { borderColor: colors.primary }
                                        ]}
                                        onPress={() => setExpandedVendorId(isExpanded ? null : vendor.id)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.cardHeader}>
                                            <Text style={[styles.vendorName, { color: colors.text }]} numberOfLines={1}>
                                                {vendor.name}
                                            </Text>
                                            
                                            <View style={[styles.statusPill, { backgroundColor: vendor.isActive ? "#dcfce7" : "#fee2e2" }]}>
                                                <Text style={[styles.statusText, { color: vendor.isActive ? "#166534" : "#991b1b" }]}>
                                                    {vendor.status || (vendor.isActive ? "ACTIVE" : "INACTIVE")}
                                                </Text>
                                            </View>
                                        </View>

                                        {vendor.companyName ? (
                                            <Text style={[styles.vendorCompany, { color: colors.primary }]}>
                                                {vendor.companyName.toUpperCase()}
                                            </Text>
                                        ) : null}

                                        {vendor.contactPerson ? (
                                            <View style={[styles.vendorInfoRow, { marginTop: 8 }]}>
                                                <Ionicons name="person-outline" size={14} color={colors.textDim} />
                                                <Text style={[styles.vendorInfoText, { color: colors.textDim }]}>
                                                    Contact: {vendor.contactPerson}
                                                </Text>
                                            </View>
                                        ) : null}

                                        {vendor.email ? (
                                            <View style={styles.vendorInfoRow}>
                                                <Ionicons name="mail-outline" size={14} color={colors.textDim} />
                                                <Text style={[styles.vendorInfoText, { color: colors.textDim }]}>
                                                    {vendor.email}
                                                </Text>
                                            </View>
                                        ) : null}

                                        {vendor.phoneNumber ? (
                                            <View style={styles.vendorInfoRow}>
                                                <Ionicons name="call-outline" size={14} color={colors.textDim} />
                                                <Text style={[styles.vendorInfoText, { color: colors.textDim }]}>
                                                    {vendor.phoneNumber}
                                                </Text>
                                            </View>
                                        ) : null}

                                        {vendor.gstNumber ? (
                                            <View style={styles.vendorInfoRow}>
                                                <Ionicons name="receipt-outline" size={14} color={colors.textDim} />
                                                <Text style={[styles.vendorInfoText, { color: colors.textDim }]}>
                                                    GST: {vendor.gstNumber}
                                                </Text>
                                            </View>
                                        ) : null}

                                        {/* Capabilities Accordion Section */}
                                        {isExpanded && (
                                            <View style={styles.capabilitiesContainer}>
                                                <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />
                                                <View style={styles.capabilitiesHeader}>
                                                    <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                                                    <Text style={[styles.capabilitiesTitle, { color: colors.text }]}>
                                                        SUPPLIER CAPABILITIES
                                                    </Text>
                                                </View>
                                                
                                                {(!vendor.vendor_material_capability || vendor.vendor_material_capability.length === 0) ? (
                                                    <Text style={[styles.noCapabilitiesText, { color: colors.textDim }]}>
                                                        No registered material or labour capabilities.
                                                    </Text>
                                                ) : (
                                                    <View style={styles.capabilitiesPillContainer}>
                                                        {vendor.vendor_material_capability.map((cap: any) => (
                                                            <View
                                                                key={cap.id}
                                                                style={[
                                                                    styles.capabilityPill,
                                                                    { backgroundColor: cap.serviceType === "LABOUR" ? "#fef3c7" : "#dbeafe" }
                                                                ]}
                                                            >
                                                                <Text style={[
                                                                    styles.capabilityPillText,
                                                                    { color: cap.serviceType === "LABOUR" ? "#92400e" : "#1e40af" }
                                                                ]}>
                                                                    {cap.materialName} {cap.unit ? `(${cap.unit})` : ""} • {cap.serviceType}
                                                                </Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )
                    )}
                </ScrollView>
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
    addButton: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
    
    tabContainer: { paddingVertical: SPACING.sm },
    pillSwitcher: { flexDirection: "row", padding: 4, borderRadius: 24, height: 48 },
    pillOption: { flex: 1, borderRadius: 20, justifyContent: "center", alignItems: "center" },
    pillText: { fontSize: 13, fontWeight: "700" },

    searchContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, height: 44, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginVertical: SPACING.md },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },

    scrollContent: { paddingBottom: 40 },
    emptyState: { alignItems: "center", justifyContent: "center", marginTop: 80 },
    emptyText: { marginTop: 12, fontSize: 16, fontWeight: "600" },

    card: {
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    indentIdText: { fontSize: 13, fontWeight: "800" },
    projectBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: "800" },
    indentName: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
    indentDesc: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
    cardDivider: { height: 1, marginVertical: 12, opacity: 0.3 },
    cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    footerRow: { flexDirection: "row", alignItems: "center" },
    footerText: { fontSize: 12, fontWeight: "500" },

    vendorName: { fontSize: 16, fontWeight: "700", flex: 1, marginRight: 8 },
    vendorCompany: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    vendorInfoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
    vendorInfoText: { fontSize: 12, fontWeight: "500" },

    capabilitiesContainer: { marginTop: 4 },
    capabilitiesHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
    capabilitiesTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    noCapabilitiesText: { fontSize: 11, fontStyle: "italic", marginLeft: 4 },
    capabilitiesPillContainer: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    capabilityPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    capabilityPillText: { fontSize: 11, fontWeight: "700" },
});
