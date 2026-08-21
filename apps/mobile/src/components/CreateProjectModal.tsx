import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { createProject, getWorkspaceMembers } from "../services/api";
import { WorkspaceMember } from "../types";
import PressableScale from "./PressableScale";
import AppButton from "./AppButton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/** Dark ink for content sitting on the amber primary — white fails contrast on #fbb54a. */
const INK_ON_PRIMARY = "#2b1c04";

// Premium curated color palette (matches web)
const PROJECT_COLORS = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
    "#6366f1", "#f43f5e", "#10b981", "#0ea5e9",
];

// Helper to generate custom HSL to Hex colors
function hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

interface CreateProjectModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function CreateProjectModal({ visible, onClose }: CreateProjectModalProps) {
    const { activeWorkspace, refreshData, refreshWorkspaces, projects } = useWorkspace();
    const { colors, isDark } = useTheme();
    const [name, setName] = useState("");
    const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isInternal, setIsInternal] = useState(false);
    
    // Web-aligned project fields
    const [description, setDescription] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [registeredCompanyName, setRegisteredCompanyName] = useState("");
    const [directorName, setDirectorName] = useState("");
    const [address, setAddress] = useState("");
    const [gstNumber, setGstNumber] = useState("");
    const [contactPersonName, setContactPersonName] = useState("");
    const [contactNumber, setContactNumber] = useState("");

    // Member selection
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
    const [fetchingMembers, setFetchingMembers] = useState(false);

    // Generate a unique color automatically based on existing projects
    const getAutoColor = () => {
        const usedColors = new Set(
            projects
                .filter((p) => p.workspaceId === activeWorkspace?.id)
                .map((p) => p.color?.toLowerCase())
        );

        // Find the first color in our curated list that is not used
        const unusedColor = PROJECT_COLORS.find((c) => !usedColors.has(c.toLowerCase()));
        if (unusedColor) return unusedColor;

        // Fallback 1: Generate a random beautiful HSL/HEX color that is not used
        for (let i = 0; i < 50; i++) {
            const hue = Math.floor(Math.random() * 360);
            const hex = hslToHex(hue, 75, 50);
            if (!usedColors.has(hex.toLowerCase())) {
                return hex;
            }
        }

        // Fallback 2: Pick a random curated color
        return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
    };

    useEffect(() => {
        if (visible) {
            if (activeWorkspace) {
                loadMembers();
                setSelectedColor(getAutoColor());
            }
        } else {
            setName("");
            setDescription("");
            setCompanyName("");
            setRegisteredCompanyName("");
            setDirectorName("");
            setAddress("");
            setGstNumber("");
            setContactPersonName("");
            setContactNumber("");
            setError(null);
            setSelectedManagerId(null);
            setIsInternal(false);
        }
        // Keyed on open/close only. Including `projects` re-ran this whenever
        // workspace data refreshed, which re-rolled the auto colour (its fallback
        // is random) and reset the chosen manager to the first in the list —
        // silently discarding the user's selection mid-form.
    }, [visible, activeWorkspace?.id]);

    const loadMembers = async () => {
        if (!activeWorkspace) return;
        setFetchingMembers(true);
        try {
            // Exactly align with web: only fetch people with the MANAGER role
            const data = await getWorkspaceMembers(activeWorkspace.id, "MANAGER");
            setMembers(data);
            
            // Default to first eligible manager
            if (data.length > 0) {
                setSelectedManagerId(data[0].userId);
            }
        } catch (err) {
            console.error("Failed to load members", err);
        } finally {
            setFetchingMembers(false);
        }
    };

    const handleCreate = async () => {
        const trimmedName = name.trim();
        
        if (!trimmedName) {
            setError("Project Name is required.");
            return;
        }
        
        if (!selectedManagerId) {
            setError("Please select a Project Manager.");
            return;
        }

        // Strict validation for Client Projects
        if (!isInternal) {
            if (!companyName.trim() || !address.trim() || !contactPersonName.trim() || !contactNumber.trim()) {
                setError("Please fill in all company and contact details for Client Projects.");
                return;
            }
        }

        if (!activeWorkspace) return;
        
        setLoading(true);
        setError(null);
        try {
            const res = await createProject(
                activeWorkspace.id, 
                name.trim(), 
                selectedManagerId, 
                selectedColor,
                description.trim(),
                isInternal ? "Internal" : companyName.trim(),
                isInternal ? "Internal" : registeredCompanyName.trim(),
                isInternal ? "Internal" : directorName.trim(),
                isInternal ? "Internal" : address.trim(),
                isInternal ? "Internal" : gstNumber.trim(),
                isInternal ? "Internal Project" : contactPersonName.trim(),
                isInternal ? "0000000000" : contactNumber.trim()
            );
            if (res.success) {
                setName("");
                await refreshData();
                onClose();
            } else {
                setError(res.error || "Failed to create project");
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
                {/* Android resizes the window itself under edge-to-edge; adding the
                    "height" behaviour on top animates the sheet a second time, which
                    is the wobble you get as the keyboard and its suggestion strip
                    appear. Let the OS handle it there. */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.container}
                >
                    <View style={[styles.sheet, { backgroundColor: colors.surfaceSolid }]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={[styles.handle, { backgroundColor: colors.border }]} />
                            <View style={styles.titleRow}>
                                <View style={styles.titleLeft}>
                                    <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
                                        <Ionicons name="layers-outline" size={19} color={colors.primary} />
                                    </View>
                                    <Text style={[styles.title, { color: colors.text }]}>Create Project</Text>
                                </View>
                                <PressableScale
                                    haptic="selection"
                                    onPress={onClose}
                                    style={[styles.closeBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}
                                    accessibilityLabel="Close"
                                    accessibilityRole="button"
                                    hitSlop={8}
                                >
                                    <Ionicons name="close" size={20} color={colors.text} />
                                </PressableScale>
                            </View>
                        </View>

                        <ScrollView 
                            style={[styles.content, { flexShrink: 1 }]} 
                            contentContainerStyle={{ paddingBottom: 40 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Workspace context */}
                            {activeWorkspace && (
                                <View style={[styles.workspaceChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                    <Ionicons name="business-outline" size={14} color={colors.textDim} />
                                    <Text style={[styles.workspaceChipText, { color: colors.textDim }]}>{activeWorkspace.name}</Text>
                                </View>
                            )}

                            {/* Project Type Toggle */}
                            <View style={[styles.typeSelector, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <PressableScale
                                    style={[styles.typeBtn, !isInternal && { backgroundColor: colors.primary }]}
                                    onPress={() => setIsInternal(false)}
                                    haptic="selection"
                                    accessibilityRole="button"
                                    accessibilityLabel="Client project"
                                    accessibilityState={{ selected: !isInternal }}
                                >
                                    <Ionicons name="people-outline" size={16} color={!isInternal ? INK_ON_PRIMARY : colors.textDim} />
                                    <Text style={[styles.typeBtnText, { color: !isInternal ? INK_ON_PRIMARY : colors.textDim }]}>Client Project</Text>
                                </PressableScale>
                                <PressableScale
                                    style={[styles.typeBtn, isInternal && { backgroundColor: colors.primary }]}
                                    onPress={() => setIsInternal(true)}
                                    haptic="selection"
                                    accessibilityRole="button"
                                    accessibilityLabel="Internal project"
                                    accessibilityState={{ selected: isInternal }}
                                >
                                    <Ionicons name="business-outline" size={16} color={isInternal ? INK_ON_PRIMARY : colors.textDim} />
                                    <Text style={[styles.typeBtnText, { color: isInternal ? INK_ON_PRIMARY : colors.textDim }]}>Internal Project</Text>
                                </PressableScale>
                            </View>

                            {/* Project Name */}
                            <View style={styles.row}>
                                <Text style={[styles.label, { marginTop: 8, color: colors.textDim }]}>Project Name</Text>
                                <Text style={[styles.label, { marginTop: 8, color: colors.primary, marginLeft: 4 }]}>*</Text>
                            </View>
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

                             {!isInternal && (
                                 <>
                                    {/* Company Details Section */}
                                    <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Company Details</Text>
                                    </View>

                                    <View style={styles.row}>
                                        <View style={styles.col}>
                                            <Text style={[styles.label, { color: colors.textDim }]}>Company Name</Text>
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                                placeholder=""
                                                placeholderTextColor={colors.textDim}
                                                value={companyName}
                                                onChangeText={setCompanyName}
                                            />
                                        </View>
                                    </View>

                                    <Text style={[styles.label, { color: colors.textDim }]}>Registered Company Name</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                        placeholder=""
                                        placeholderTextColor={colors.textDim}
                                        value={registeredCompanyName}
                                        onChangeText={setRegisteredCompanyName}
                                    />

                                    <View style={styles.row}>
                                        <View style={styles.col}>
                                            <Text style={[styles.label, { color: colors.textDim }]}>Director Name</Text>
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                                placeholder=""
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
                                                placeholder=""
                                                placeholderTextColor={colors.textDim}
                                                value={address}
                                                onChangeText={setAddress}
                                            />
                                        </View>
                                    </View>

                                    <Text style={[styles.label, { color: colors.textDim }]}>GST Number</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                        placeholder=""
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
                                            <Text style={[styles.label, { color: colors.textDim }]}>Contact Person Name</Text>
                                            <TextInput
                                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                                placeholder=""
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
                                                placeholder=""
                                                placeholderTextColor={colors.textDim}
                                                value={contactNumber}
                                                onChangeText={setContactNumber}
                                                keyboardType="phone-pad"
                                            />
                                        </View>
                                    </View>
                                 </>
                             )}



                            {/* Project Manager Selection */}
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Project Manager</Text>
                                <Text style={[styles.label, { color: colors.primary, marginLeft: 4 }]}>*</Text>
                            </View>
                            {fetchingMembers ? (
                                <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: "flex-start", marginTop: 8 }} />
                            ) : (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberList}>
                                    {members.map((member) => {
                                        const selected = selectedManagerId === member.userId;
                                        return (
                                            <PressableScale
                                                key={member.userId}
                                                onPress={() => setSelectedManagerId(member.userId)}
                                                haptic="selection"
                                                accessibilityRole="button"
                                                accessibilityLabel={member.user.surname || member.user.name}
                                                accessibilityState={{ selected }}
                                                style={[
                                                    styles.memberItem,
                                                    selected && { borderColor: colors.primary, backgroundColor: colors.primary + "14" }
                                                ]}
                                            >
                                                <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                                                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                                                        {(member.user.surname?.[0] || member.user.name.charAt(0)).toUpperCase()}
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.memberName,
                                                        { color: colors.textDim },
                                                        selected && { color: colors.primary, fontFamily: FONTS.bold }
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {member.user.surname || member.user.name}
                                                </Text>
                                                {selected && (
                                                    <View style={[styles.selectedBadge, { backgroundColor: colors.primary, borderColor: colors.surfaceSolid }]}>
                                                        <Ionicons name="checkmark" size={10} color={INK_ON_PRIMARY} />
                                                    </View>
                                                )}
                                            </PressableScale>
                                        );
                                    })}
                                </ScrollView>
                            )}

                            {/* Preview — always mounted. Toggling it on the first
                                keystroke changed the scroll content height and made
                                the form jump while typing. */}
                            <View style={[styles.preview, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <View style={[styles.previewDot, { backgroundColor: selectedColor }]} />
                                <Text
                                    style={[styles.previewText, { color: name.trim() ? colors.text : colors.textDim }]}
                                    numberOfLines={1}
                                >
                                    {name.trim() || "Project preview"}
                                </Text>
                            </View>

                        </ScrollView>

                        {/* Footer */}
                        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surfaceSolid }]}>
                            {error && (
                                <Text style={[styles.errorText, { color: colors.validationError, marginBottom: 12, marginTop: 0 }]} accessibilityRole="alert">
                                    {error}
                                </Text>
                            )}
                            <AppButton
                                label="Create Project"
                                onPress={handleCreate}
                                loading={loading}
                                icon="layers-outline"
                                haptic="medium"
                                fullWidth
                                size="lg"
                            />
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
        overflow: "hidden",
    },
    header: {
        alignItems: "center",
        paddingTop: 10,
        paddingBottom: 6,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        marginBottom: 14,
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
        gap: 12,
        flex: 1,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: SCREEN_WIDTH < 380 ? 17 : 19,
        fontFamily: FONTS.extrabold,
        letterSpacing: -0.3,
    },
    closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },

    workspaceChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 12,
        paddingVertical: 7,
        alignSelf: "flex-start",
        marginBottom: 4,
        borderWidth: 1,
    },
    workspaceChipText: { fontSize: 12, fontFamily: FONTS.semibold },
    typeSelector: {
        flexDirection: "row",
        padding: 4,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        marginTop: 18,
        marginBottom: 8,
    },
    typeBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 11,
        borderRadius: BORDER_RADIUS.md,
        gap: 8,
    },
    typeBtnText: {
        fontSize: 13,
        fontFamily: FONTS.bold,
    },

    memberList: {
        marginTop: 4,
        flexDirection: "row",
    },
    memberItem: {
        width: 80,
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 2,
        borderColor: "transparent",
        marginRight: 8,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 6,
    },
    avatarText: {
        fontSize: 18,
        fontFamily: FONTS.bold,
    },
    memberName: {
        fontSize: 11,
        textAlign: "center",
        width: "100%",
    },
    selectedBadge: {
        position: "absolute",
        top: 6,
        right: 14,
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1.5,
    },

    label: {
        fontSize: 12,
        fontFamily: FONTS.bold,
        marginBottom: 8,
        marginTop: 18,
        textTransform: "uppercase",
        letterSpacing: 0.7,
    },
    input: {
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        paddingVertical: 14,
        fontSize: 15.5,
        fontFamily: FONTS.medium,
        borderWidth: 1,
        minHeight: 52,
    },

    colorGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
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
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },

    preview: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginTop: 22,
        padding: 14,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
    },
    previewDot: { width: 12, height: 12, borderRadius: 6 },
    previewText: { fontSize: 15, fontFamily: FONTS.semibold, flex: 1 },

    footer: {
        padding: SPACING.lg,
        borderTopWidth: 1,
    },
    createBtn: {
        borderRadius: BORDER_RADIUS.md,
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    createBtnDisabled: { opacity: 0.45 },
    createBtnText: { color: "#fff", fontSize: 16, fontFamily: FONTS.bold },
    errorText: { color: "#ef4444", fontSize: 12, marginTop: 12, textAlign: "center" },

    textArea: {
        height: 100,
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
        fontFamily: FONTS.bold,
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
});
