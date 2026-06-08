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
import { format, startOfToday } from "date-fns";
import CalendarPicker from "./CalendarPicker";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { createProjectTask, updateTask } from "../services/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface CreateTaskModalProps {
    visible: boolean;
    onClose: () => void;
    initialProjectId?: string;
    editingTask?: any;
}

export default function CreateTaskModal({ visible, onClose, initialProjectId, editingTask }: CreateTaskModalProps) {
    const { activeWorkspace, projects, refreshData } = useWorkspace();
    const { colors, isDark } = useTheme();
    const [name, setName] = useState("");
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isEditing = !!editingTask;

    // Initial project and name selection
    useEffect(() => {
        if (visible) {
            if (editingTask) {
                setName(editingTask.name || "");
                setSelectedProjectId(editingTask.projectId || null);
                setStartDate(editingTask.startDate ? new Date(editingTask.startDate) : null);
                setDueDate(editingTask.dueDate ? new Date(editingTask.dueDate) : null);
            } else if (initialProjectId) {
                setSelectedProjectId(initialProjectId);
            } else if (projects.length > 0 && !selectedProjectId) {
                setSelectedProjectId(projects[0].id);
            }
        }
        if (!visible) {
            setName("");
            setError(null);
            setSelectedProjectId(null);
            setStartDate(null);
            setDueDate(null);
        }
    }, [visible, projects, initialProjectId, editingTask]);

    const handleSubmit = async () => {
        if (!name.trim() || !selectedProjectId) {
            setError("Please check the form details and try again.");
            return;
        }
        
        setLoading(true);
        setError(null);
        try {
            let res;
            if (isEditing) {
                res = await updateTask(editingTask.id, { 
                    name: name.trim(),
                    projectId: selectedProjectId,
                    startDate: startDate ? startDate.toISOString() : undefined,
                    dueDate: dueDate ? dueDate.toISOString() : undefined,
                });
            } else {
                // Assuming createProjectTask might need updating if it doesn't support dates yet, 
                // but checking api.ts it might just take name. 
                // Let's use a more complete API call if available.
                res = await createProjectTask(selectedProjectId, name, {
                    startDate: startDate ? startDate.toISOString() : undefined,
                    dueDate: dueDate ? dueDate.toISOString() : undefined,
                });
            }

            if (res.success || res.id) {
                setName("");
                await refreshData();
                onClose();
            } else {
                setError(res.error || `Failed to ${isEditing ? "update" : "create"} task`);
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
                        <View style={styles.header}>
                            <View style={[styles.handle, { backgroundColor: colors.border }]} />
                            <View style={styles.titleRow}>
                                <Text style={[styles.title, { color: colors.text }]}>{isEditing ? "Edit Task" : "Create Task"}</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <Ionicons name="close" size={24} color={colors.textDim} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView 
                            style={[styles.content, { flexShrink: 1 }]} 
                            contentContainerStyle={{ paddingBottom: 40 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={[styles.label, { color: colors.textDim }]}>Task Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder="What needs to be done?"
                                placeholderTextColor={colors.textDim}
                                value={name}
                                onChangeText={setName}
                                autoFocus
                            />



                            <Text style={[styles.label, { color: colors.textDim }]}>Project</Text>
                            <View style={styles.projectList}>
                                {projects.map((proj) => (
                                    <TouchableOpacity 
                                        key={proj.id}
                                        style={[
                                            styles.projectItem,
                                            { backgroundColor: colors.background, borderColor: colors.border },
                                            selectedProjectId === proj.id && [styles.projectItemSelected, { borderColor: colors.primary, backgroundColor: colors.primary + "10" }]
                                        ]}
                                        onPress={() => setSelectedProjectId(proj.id)}
                                    >
                                        <View style={[styles.projectColor, { backgroundColor: proj.color || colors.primary }]} />
                                        <Text style={[
                                            styles.projectLabel,
                                            { color: colors.text },
                                            selectedProjectId === proj.id && [styles.projectLabelSelected, { color: colors.primary }]
                                        ]}>
                                            {proj.name}
                                        </Text>
                                        {selectedProjectId === proj.id && (
                                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>

                        </ScrollView>

                        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                            {error && <Text style={[styles.errorText, { marginBottom: 12, marginTop: 0 }]}>{error}</Text>}
                            <TouchableOpacity 
                                style={[styles.createBtn, { backgroundColor: colors.primary }, loading && styles.createBtnDisabled]}
                                onPress={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="add" size={20} color="#fff" />
                                        <Text style={styles.createBtnText}>{isEditing ? "Save Changes" : "Create Task"}</Text>
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
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    container: {
        width: "100%",
    },
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
    title: {
        fontSize: SCREEN_WIDTH < 380 ? 18 : 20,
        fontWeight: "700",
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        padding: SPACING.lg,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        borderWidth: 1,
    },
    dateRow: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        marginTop: 8,
    },
    datePickerBtn: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
        gap: 10,
        height: 52,
    },
    dateText: {
        fontSize: 15,
        fontWeight: "500",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    pickerContainer: {
        width: "100%",
        borderRadius: BORDER_RADIUS.lg,
        padding: 16,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    pickerHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    pickerTitle: {
        fontSize: 16,
        fontWeight: "700",
    },
    projectList: {
        marginTop: 8,
    },
    projectItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: 8,
        borderWidth: 1,
    },
    projectItemSelected: {
    },
    projectColor: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 12,
    },
    projectLabel: {
        flex: 1,
        fontSize: 14,
    },
    projectLabelSelected: {
        fontWeight: "600",
    },
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
    createBtnDisabled: {
        opacity: 0.5,
    },
    createBtnText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    errorText: {
        color: "#ef4444",
        fontSize: 12,
        marginTop: 8,
        textAlign: "center",
    },
});
