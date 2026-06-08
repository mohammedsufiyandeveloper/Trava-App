import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { updateProject, getProject, getWorkspaceMembers } from "../services/api";
import { WorkspaceMember, Project } from "../types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PROJECT_COLORS = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
    "#6366f1", "#f43f5e", "#10b981", "#0ea5e9",
];

interface EditProjectModalProps {
    visible: boolean;
    onClose: () => void;
    projectId: string;
}

export default function EditProjectModal({ visible, onClose, projectId }: EditProjectModalProps) {
    const { activeWorkspace, refreshData } = useWorkspace();
    const { colors } = useTheme();
    
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
    
    // Client fields
    const [companyName, setCompanyName] = useState("");
    const [registeredCompanyName, setRegisteredCompanyName] = useState("");
    const [directorName, setDirectorName] = useState("");
    const [address, setAddress] = useState("");
    const [gstNumber, setGstNumber] = useState("");
    const [contactPersonName, setContactPersonName] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    
    // Members & Management
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
    
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible && projectId) {
            loadProjectDetails();
            loadWorkspaceMembers();
        }
    }, [visible, projectId]);

    const loadProjectDetails = async () => {
        setFetching(true);
        setError(null);
        try {
            const data = await getProject(projectId);
            if (data) {
                setName(data.name || "");
                setDescription(data.description || "");
                setSelectedColor(data.color || PROJECT_COLORS[0]);
                
                // Set client details if available
                const client = data.clint?.[0];
                if (client) {
                    setCompanyName(client.name || "");
                    setRegisteredCompanyName(client.registeredCompanyName || "");
                    setDirectorName(client.directorName || "");
                    setAddress(client.address || "");
                    setGstNumber(client.gstNumber || "");
                    
                    const clientMember = client.clintMembers?.[0];
                    if (clientMember) {
                        setContactPersonName(clientMember.name || "");
                        setContactNumber(clientMember.phoneNumber || "");
                    }
                }

                // Identify manager
                const manager = data.projectMembers?.find((pm: any) => pm.projectRole === "PROJECT_MANAGER");
                if (manager) {
                    setSelectedManagerId(manager.WorkspaceMember.userId);
                }
            }
        } catch (err) {
            setError("Failed to load project details");
        } finally {
            setFetching(false);
        }
    };

    const loadWorkspaceMembers = async () => {
        if (!activeWorkspace) return;
        try {
            const data = await getWorkspaceMembers(activeWorkspace.id);
            setMembers(data);
        } catch (err) {
            console.error("Failed to load workspace members", err);
        }
    };

    const handleUpdate = async () => {
        if (!name.trim() || loading) return;
        setLoading(true);
        setError(null);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim(),
                color: selectedColor,
                companyName: companyName.trim(),
                registeredCompanyName: registeredCompanyName.trim(),
                directorName: directorName.trim(),
                address: address.trim(),
                gstNumber: gstNumber.trim(),
                contactPerson: contactPersonName.trim(),
                phoneNumber: contactNumber.trim(),
                projectLead: selectedManagerId,
            };

            const res = await updateProject(projectId, payload);
            if (res.success) {
                await refreshData();
                onClose();
            } else {
                setError(res.error || "Failed to update project");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.container}
                >
                    <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={[styles.handle, { backgroundColor: colors.border }]} />
                            <View style={styles.titleRow}>
                                <View style={styles.titleLeft}>
                                    <View style={[styles.iconBox, { backgroundColor: selectedColor + "25" }]}>
                                        <Ionicons name="create-outline" size={18} color={selectedColor} />
                                    </View>
                                    <Text style={[styles.title, { color: colors.text }]}>Edit Project</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <Ionicons name="close" size={22} color={colors.textDim} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {fetching ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={[styles.loadingText, { color: colors.textDim }]}>Fetching details...</Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                                {/* Project Name */}
                                <Text style={[styles.label, { marginTop: 8, color: colors.textDim }]}>Project Name</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    placeholder="Enter project name"
                                    placeholderTextColor={colors.textDim}
                                    value={name}
                                    onChangeText={setName}
                                />

                                {/* Description */}
                                <Text style={[styles.label, { color: colors.textDim }]}>Description</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    placeholder="Project description"
                                    placeholderTextColor={colors.textDim}
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    numberOfLines={4}
                                />

                                {/* Company Details Section */}
                                <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Company Details</Text>
                                </View>

                                <Text style={[styles.label, { color: colors.textDim }]}>Company Name</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    placeholder="e.g. Google"
                                    placeholderTextColor={colors.textDim}
                                    value={companyName}
                                    onChangeText={setCompanyName}
                                />

                                <Text style={[styles.label, { color: colors.textDim }]}>Registered Company Name</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    placeholder="Registered company name"
                                    placeholderTextColor={colors.textDim}
                                    value={registeredCompanyName}
                                    onChangeText={setRegisteredCompanyName}
                                />

                                <View style={styles.row}>
                                    <View style={styles.col}>
                                        <Text style={[styles.label, { color: colors.textDim }]}>Director Name</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            placeholder="eg: John Doe"
                                            placeholderTextColor={colors.textDim}
                                            value={directorName}
                                            onChangeText={setDirectorName}
                                        />
                                    </View>
                                    <View style={styles.spacer} />
                                    <View style={styles.col}>
                                        <Text style={[styles.label, { color: colors.textDim }]}>Address</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            placeholder="eg: Street name"
                                            placeholderTextColor={colors.textDim}
                                            value={address}
                                            onChangeText={setAddress}
                                        />
                                    </View>
                                </View>

                                <Text style={[styles.label, { color: colors.textDim }]}>GST Number</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    placeholder="12ABCDE3456F7Z8"
                                    placeholderTextColor={colors.textDim}
                                    value={gstNumber}
                                    onChangeText={setGstNumber}
                                    maxLength={15}
                                />

                                {/* Contact Details Section */}
                                <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Details</Text>
                                </View>

                                <View style={styles.row}>
                                    <View style={styles.col}>
                                        <Text style={[styles.label, { color: colors.textDim }]}>Contact Name</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            placeholder="e.g. John Doe"
                                            placeholderTextColor={colors.textDim}
                                            value={contactPersonName}
                                            onChangeText={setContactPersonName}
                                        />
                                    </View>
                                    <View style={styles.spacer} />
                                    <View style={styles.col}>
                                        <Text style={[styles.label, { color: colors.textDim }]}>Contact Number</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            placeholder="e.g. +91 98765"
                                            placeholderTextColor={colors.textDim}
                                            value={contactNumber}
                                            onChangeText={setContactNumber}
                                            keyboardType="phone-pad"
                                        />
                                    </View>
                                </View>

                                {/* Color Picker */}
                                <Text style={[styles.label, { color: colors.textDim }]}>Project Color</Text>
                                <View style={styles.colorGrid}>
                                    {PROJECT_COLORS.map((c) => (
                                        <TouchableOpacity
                                            key={c}
                                            onPress={() => setSelectedColor(c)}
                                            style={[
                                                styles.colorSwatch,
                                                { backgroundColor: c },
                                                selectedColor === c && styles.colorSwatchSelected
                                            ]}
                                        >
                                            {selectedColor === c && (
                                                <Ionicons name="checkmark" size={14} color="#fff" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {error && <Text style={styles.errorText}>{error}</Text>}
                                <View style={{ height: 40 }} />
                            </ScrollView>
                        )}

                        {/* Footer */}
                        <View style={[styles.footer, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                                style={[
                                    styles.saveBtn,
                                    { backgroundColor: selectedColor },
                                    (!name.trim() || loading || fetching) && styles.saveBtnDisabled
                                ]}
                                onPress={handleUpdate}
                                disabled={!name.trim() || loading || fetching}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="save-outline" size={18} color="#fff" />
                                        <Text style={styles.saveBtnText}>Save Changes</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "flex-end",
    },
    container: { width: "100%" },
    sheet: {
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        maxHeight: "90%",
    },
    header: {
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 8,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        paddingHorizontal: SPACING.lg,
    },
    titleLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: 19,
        fontWeight: "700",
    },
    closeBtn: { padding: 4 },
    content: { padding: SPACING.lg },
    loadingContainer: {
        height: 300,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    label: {
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 8,
        marginTop: 16,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        borderWidth: 1,
    },
    textArea: {
        height: 80,
        textAlignVertical: "top",
    },
    sectionHeader: {
        marginTop: 24,
        marginBottom: 8,
        borderBottomWidth: 1,
        paddingBottom: 4,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    col: {
        flex: 1,
    },
    spacer: {
        width: 12,
    },
    colorGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
        marginTop: 4,
    },
    colorSwatch: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    colorSwatchSelected: {
        borderWidth: 3,
        borderColor: "#fff",
    },
    footer: {
        padding: SPACING.lg,
        borderTopWidth: 1,
    },
    saveBtn: {
        borderRadius: BORDER_RADIUS.md,
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    saveBtnDisabled: { opacity: 0.45 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    errorText: { color: "#ef4444", fontSize: 12, marginTop: 12, textAlign: "center" },
});
