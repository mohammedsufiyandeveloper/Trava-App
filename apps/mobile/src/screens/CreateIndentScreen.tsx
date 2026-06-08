import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Modal,
    Alert,
    Platform,
    FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import {
    getProcurableProjects,
    getWorkspaceMembers,
    getMaterialsCatalog,
    createIndent,
    editIndent,
} from "../services/api";
import { useResponsive } from "../hooks/useResponsive";

export default function CreateIndentScreen({ route, navigation }: any) {
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    // Check if edit mode
    const editPayload = route.params?.indent;
    const isEdit = !!editPayload;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Data lists
    const [projects, setProjects] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [catalog, setCatalog] = useState<any[]>([]);

    // Form states
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [selectedAssignee, setSelectedAssignee] = useState<any>(null);
    const [expectedDelivery, setExpectedDelivery] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [materials, setMaterials] = useState<any[]>([]);

    // Modal state for adding material item
    const [itemModalVisible, setItemModalVisible] = useState(false);
    const [matName, setMatName] = useState("");
    const [matUnit, setMatUnit] = useState("unit");
    const [matQty, setMatQty] = useState("");
    const [matEstPrice, setMatEstPrice] = useState("");
    const [matSpec, setMatSpec] = useState("");
    const [matDesc, setMatDesc] = useState("");

    // Autocomplete list
    const [autocompleteList, setAutocompleteList] = useState<any[]>([]);

    const loadData = useCallback(async () => {
        if (!activeWorkspace?.id) return;
        try {
            const [projectsData, membersData, catalogData] = await Promise.all([
                getProcurableProjects(activeWorkspace.id),
                getWorkspaceMembers(activeWorkspace.id),
                getMaterialsCatalog(activeWorkspace.id),
            ]);
            setProjects(projectsData);
            setMembers(membersData);
            setCatalog(catalogData);

            if (isEdit) {
                setName(editPayload.name || "");
                setDescription(editPayload.description || "");
                setExpectedDelivery(editPayload.expectedDelivery ? new Date(editPayload.expectedDelivery) : new Date());
                
                // Set materials
                if (editPayload.indent_line_item) {
                    setMaterials(editPayload.indent_line_item.map((item: any) => ({
                        materialName: item.materialName,
                        unit: item.unit,
                        quantity: String(item.quantity),
                        estimatedUnitPrice: item.estimatedUnitPrice ? String(item.estimatedUnitPrice) : "",
                        specifications: item.specifications || "",
                        description: item.description || "",
                    })));
                }

                // Match project
                const matchedProj = projectsData.find(p => p.id === editPayload.projectId);
                if (matchedProj) setSelectedProject(matchedProj);

                // Match assignee
                const matchedAssignee = membersData.find(m => m.id === editPayload.assignedToId);
                if (matchedAssignee) setSelectedAssignee(matchedAssignee);
            }
        } catch (error) {
            console.error("CreateIndentScreen load error:", error);
        } finally {
            setLoading(false);
        }
    }, [activeWorkspace?.id, isEdit, editPayload]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleMatNameChange = (text: string) => {
        setMatName(text);
        if (!text) {
            setAutocompleteList([]);
            return;
        }
        // Filter catalog
        const filtered = catalog.filter(c => c.name.toLowerCase().includes(text.toLowerCase())).slice(0, 5);
        setAutocompleteList(filtered);
    };

    const selectAutocompleteItem = (item: any) => {
        setMatName(item.name);
        if (item.unit) {
            setMatUnit(item.unit);
        }
        setAutocompleteList([]);
    };

    const handleAddMaterial = () => {
        if (!matName.trim()) {
            Alert.alert("Error", "Material name is required");
            return;
        }
        if (!matQty || isNaN(Number(matQty)) || Number(matQty) <= 0) {
            Alert.alert("Error", "Quantity must be a positive number");
            return;
        }

        const newItem = {
            materialName: matName.trim(),
            unit: matUnit.trim() || "unit",
            quantity: String(Number(matQty)),
            estimatedUnitPrice: matEstPrice ? String(Number(matEstPrice)) : undefined,
            specifications: matSpec.trim() || undefined,
            description: matDesc.trim() || undefined,
        };

        setMaterials([...materials, newItem]);
        
        // Reset modal fields
        setMatName("");
        setMatUnit("unit");
        setMatQty("");
        setMatEstPrice("");
        setMatSpec("");
        setMatDesc("");
        setItemModalVisible(false);
    };

    const handleRemoveMaterial = (index: number) => {
        const updated = materials.filter((_, idx) => idx !== index);
        setMaterials(updated);
    };

    const handleSubmit = async () => {
        if (!activeWorkspace?.id) return;
        if (!name.trim()) {
            Alert.alert("Error", "Indent name is required");
            return;
        }
        if (!selectedProject) {
            Alert.alert("Error", "Please select a project");
            return;
        }
        if (materials.length === 0) {
            Alert.alert("Error", "Please add at least one material item");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                projectId: selectedProject.id,
                taskId: selectedTask?.id || null,
                name: name.trim(),
                description: description.trim() || null,
                expectedDelivery: expectedDelivery.toISOString(),
                assignedToId: selectedAssignee?.id || null,
                materials: materials.map(m => ({
                    ...m,
                    quantity: parseInt(m.quantity, 10),
                    estimatedUnitPrice: m.estimatedUnitPrice ? parseInt(m.estimatedUnitPrice, 10) : undefined,
                })),
            };

            if (isEdit) {
                await editIndent(activeWorkspace.id, editPayload.id, payload);
                Alert.alert("Success", "Indent request updated successfully.");
            } else {
                await createIndent(activeWorkspace.id, payload);
                Alert.alert("Success", "Indent request created successfully.");
            }
            navigation.goBack();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to submit indent request.");
        } finally {
            setSubmitting(false);
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
                    <Text style={[styles.title, { color: colors.text }]}>
                        {isEdit ? "Edit Indent" : "Create Indent"}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* General Section */}
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Request Info</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.label, { color: colors.textDim }]}>Indent Name *</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Sourcing Cement for Phase 1"
                            placeholderTextColor={colors.textDim}
                        />

                        <Text style={[styles.label, { color: colors.textDim, marginTop: SPACING.md }]}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Write any additional description..."
                            placeholderTextColor={colors.textDim}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Logistics Section */}
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Logistics & Assignment</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        
                        {/* Project Picker */}
                        <Text style={[styles.label, { color: colors.textDim }]}>Project *</Text>
                        <View style={styles.pickerRow}>
                            {projects.map((proj) => (
                                <TouchableOpacity
                                    key={proj.id}
                                    style={[
                                        styles.pickerPill,
                                        { borderColor: colors.border },
                                        selectedProject?.id === proj.id && { backgroundColor: colors.primary, borderColor: colors.primary }
                                    ]}
                                    onPress={() => {
                                        setSelectedProject(proj);
                                        setSelectedTask(null);
                                    }}
                                >
                                    <Text style={{
                                        fontWeight: "700",
                                        fontSize: 12,
                                        color: selectedProject?.id === proj.id ? "#fff" : colors.text
                                    }}>
                                        {proj.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Assignee Picker */}
                        <Text style={[styles.label, { color: colors.textDim, marginTop: SPACING.md }]}>Assign to (Procurement Person)</Text>
                        <View style={styles.pickerRow}>
                            {members.slice(0, 4).map((member) => {
                                const displayName = member.user.surname || member.user.name || "Member";
                                return (
                                    <TouchableOpacity
                                        key={member.id}
                                        style={[
                                            styles.pickerPill,
                                            { borderColor: colors.border },
                                            selectedAssignee?.id === member.id && { backgroundColor: colors.primary, borderColor: colors.primary }
                                        ]}
                                        onPress={() => setSelectedAssignee(member)}
                                    >
                                        <Text style={{
                                            fontWeight: "700",
                                            fontSize: 12,
                                            color: selectedAssignee?.id === member.id ? "#fff" : colors.text
                                        }}>
                                            {displayName}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Expected Delivery Date Picker */}
                        <Text style={[styles.label, { color: colors.textDim, marginTop: SPACING.md }]}>Expected Delivery *</Text>
                        <TouchableOpacity
                            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, justifyContent: 'center' }]}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text style={{ color: colors.text }}>{format(expectedDelivery, "dd-MM-yyyy")}</Text>
                        </TouchableOpacity>

                        {showDatePicker && (
                            <DateTimePicker
                                value={expectedDelivery}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                textColor={colors.text}
                                themeVariant={isDark ? 'dark' : 'light'}
                                onChange={(event, date) => {
                                    setShowDatePicker(false);
                                    if (date) setExpectedDelivery(date);
                                }}
                            />
                        )}
                    </View>

                    {/* Materials requested Section */}
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Materials Requested</Text>
                        <TouchableOpacity
                            style={[styles.addMatBtn, { borderColor: colors.primary }]}
                            onPress={() => setItemModalVisible(true)}
                        >
                            <Ionicons name="add" size={16} color={colors.primary} />
                            <Text style={[styles.addMatText, { color: colors.primary }]}>Add Material</Text>
                        </TouchableOpacity>
                    </View>

                    {materials.length === 0 ? (
                        <View style={[styles.emptyCard, { borderColor: colors.border }]}>
                            <Ionicons name="gift-outline" size={28} color={colors.textDim} />
                            <Text style={{ color: colors.textDim, fontSize: 13, fontWeight: "500", marginTop: 4 }}>
                                No materials added yet. Tap Add Material above.
                            </Text>
                        </View>
                    ) : (
                        materials.map((mat, idx) => (
                            <View
                                key={idx}
                                style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.itemNameText, { color: colors.text }]}>
                                        {mat.materialName}
                                    </Text>
                                    <Text style={[styles.itemDetailsText, { color: colors.textDim }]}>
                                        Qty: {mat.quantity} {mat.unit} {mat.estimatedUnitPrice ? `• Est: ₹${mat.estimatedUnitPrice}/unit` : ""}
                                    </Text>
                                </View>
                                
                                <TouchableOpacity onPress={() => handleRemoveMaterial(idx)}>
                                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        ))
                    )}

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitButton, { backgroundColor: colors.primary }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitButtonText}>
                                {isEdit ? "Update Request" : "Submit Request"}
                            </Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>

                {/* Add Material Modal */}
                <Modal visible={itemModalVisible} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Material Item</Text>
                                <TouchableOpacity onPress={() => setItemModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
                                <Text style={[styles.label, { color: colors.textDim }]}>Material Name *</Text>
                                <TextInput
                                    style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={matName}
                                    onChangeText={handleMatNameChange}
                                    placeholder="e.g. UltraTech Cement"
                                    placeholderTextColor={colors.textDim}
                                />

                                {/* Auto-complete autocompleteList */}
                                {autocompleteList.length > 0 && (
                                    <View style={[styles.autocompleteContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                        {autocompleteList.map((item) => (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={[styles.autocompleteItem, { borderBottomColor: colors.border }]}
                                                onPress={() => selectAutocompleteItem(item)}
                                            >
                                                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{item.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                <View style={styles.row}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.textDim }]}>Quantity *</Text>
                                        <TextInput
                                            style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            value={matQty}
                                            onChangeText={setMatQty}
                                            keyboardType="numeric"
                                            placeholder="100"
                                            placeholderTextColor={colors.textDim}
                                        />
                                    </View>
                                    <View style={{ width: SPACING.md }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.label, { color: colors.textDim }]}>Unit *</Text>
                                        <TextInput
                                            style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            value={matUnit}
                                            onChangeText={setMatUnit}
                                            placeholder="bags, kg, CFT..."
                                            placeholderTextColor={colors.textDim}
                                        />
                                    </View>
                                </View>

                                <Text style={[styles.label, { color: colors.textDim }]}>Estimated Price (Optional, per unit)</Text>
                                <TextInput
                                    style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={matEstPrice}
                                    onChangeText={setMatEstPrice}
                                    keyboardType="numeric"
                                    placeholder="450"
                                    placeholderTextColor={colors.textDim}
                                />

                                <Text style={[styles.label, { color: colors.textDim }]}>Specifications (Optional)</Text>
                                <TextInput
                                    style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={matSpec}
                                    onChangeText={setMatSpec}
                                    placeholder="53 Grade, OPC..."
                                    placeholderTextColor={colors.textDim}
                                />

                                <TouchableOpacity
                                    style={[styles.modalAddBtn, { backgroundColor: colors.primary }]}
                                    onPress={handleAddMaterial}
                                >
                                    <Text style={styles.modalAddBtnText}>Add Item</Text>
                                </TouchableOpacity>
                            </ScrollView>
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
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACING.md },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    title: { fontSize: 20, fontWeight: "700" },
    
    scrollContent: { paddingBottom: 60 },
    sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: SPACING.lg, marginBottom: SPACING.sm },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: SPACING.lg, marginBottom: SPACING.sm },
    
    card: { padding: 16, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    label: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
    input: { height: 44, borderRadius: BORDER_RADIUS.md, borderWidth: 1, paddingHorizontal: 12, fontSize: 15 },
    textArea: { height: 80, paddingVertical: 10, textAlignVertical: "top" },
    
    pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    pickerPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
    
    addMatBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
    addMatText: { fontSize: 12, fontWeight: "700", marginLeft: 2 },
    
    emptyCard: { borderStyle: "dashed", borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: 24, alignItems: "center" },
    itemCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: 8 },
    itemNameText: { fontSize: 15, fontWeight: "700" },
    itemDetailsText: { fontSize: 12, fontWeight: "500", marginTop: 2 },
    
    submitButton: { marginTop: SPACING.xxl, height: 50, borderRadius: BORDER_RADIUS.lg, justifyContent: "center", alignItems: "center" },
    submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.xl, maxHeight: "90%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg },
    modalTitle: { fontSize: 18, fontWeight: "700" },
    form: { marginBottom: SPACING.xl },
    modalInput: { height: 44, borderRadius: BORDER_RADIUS.md, borderWidth: 1, paddingHorizontal: 12, fontSize: 15, marginBottom: 12 },
    
    autocompleteContainer: { borderRadius: BORDER_RADIUS.md, borderWidth: 1, overflow: "hidden", marginBottom: 12 },
    autocompleteItem: { padding: 12, borderBottomWidth: 1 },
    
    row: { flexDirection: "row" },
    modalAddBtn: { marginTop: SPACING.lg, height: 48, borderRadius: BORDER_RADIUS.md, justifyContent: "center", alignItems: "center" },
    modalAddBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
