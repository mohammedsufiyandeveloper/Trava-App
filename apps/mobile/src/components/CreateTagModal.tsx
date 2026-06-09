import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    ActivityIndicator,
    ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { createTag, updateTag } from "../services/api";
import Sheet from "./Sheet";
import PressableScale from "./PressableScale";
import { haptics } from "../services/haptics";
import { useToast } from "../context/ToastContext";

interface CreateTagModalProps {
    visible: boolean;
    onClose: () => void;
    editingTag?: any; // New prop for editing
}

export default function CreateTagModal({ visible, onClose, editingTag }: CreateTagModalProps) {
    const { activeWorkspace, refreshData } = useWorkspace();
    const { colors } = useTheme();
    const toast = useToast();
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            if (editingTag) {
                setName(editingTag.name);
            } else {
                setName("");
            }
            setError(null);
        }
    }, [visible, editingTag]);

    const handleAction = async () => {
        if (!name.trim() || !activeWorkspace || loading) return;
        setLoading(true);
        setError(null);
        try {
            let res;
            if (editingTag) {
                res = await updateTag(activeWorkspace.id, editingTag.id, {
                    name: name.trim(),
                    requirePurchase: false
                });
            } else {
                res = await createTag(activeWorkspace.id, name.trim(), false);
            }

            if (res.success) {
                await refreshData();
                toast.success(editingTag ? "Tag updated" : "Tag created");
                onClose();
            } else {
                setError(res.error || `Failed to ${editingTag ? "update" : "create"} tag`);
                haptics.error();
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
            haptics.error();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet visible={visible} onClose={onClose} accessibilityLabel={editingTag ? "Edit tag" : "Create new tag"}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <View style={styles.titleLeft}>
                        <View style={[styles.iconBox, { backgroundColor: "#f59e0b25" }]}>
                            <Ionicons name="pricetag-outline" size={18} color="#f59e0b" />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>{editingTag ? "Edit Tag" : "Create New Tag"}</Text>
                    </View>
                    <PressableScale haptic="selection" onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                        <Ionicons name="close" size={22} color={colors.textDim} />
                    </PressableScale>
                </View>
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={[styles.description, { color: colors.textDim }]}>
                    Add a new tag to organize and categorize your tasks within the workspace.
                </Text>

                <Text style={[styles.label, { color: colors.textDim }]}>Tag Name</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="e.g., Design, Urgent, Bug"
                    placeholderTextColor={colors.textDim}
                    value={name}
                    onChangeText={setName}
                    autoFocus
                    maxLength={50}
                    onSubmitEditing={handleAction}
                    returnKeyType="done"
                    accessibilityLabel="Tag name"
                />

                {error && <Text style={styles.errorText}>{error}</Text>}
            </ScrollView>

            <View style={styles.footer}>
                <PressableScale
                    haptic={null}
                    style={[
                        styles.createBtn,
                        (!name.trim() || loading) && styles.createBtnDisabled
                    ]}
                    onPress={handleAction}
                    disabled={!name.trim() || loading}
                    accessibilityRole="button"
                    accessibilityLabel={editingTag ? "Update tag" : "Create tag"}
                    accessibilityState={{ disabled: !name.trim() || loading, busy: loading }}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name={editingTag ? "save-outline" : "add"} size={20} color="#fff" />
                            <Text style={styles.createBtnText}>{editingTag ? "Update Tag" : "Create Tag"}</Text>
                        </>
                    )}
                </PressableScale>
            </View>
        </Sheet>
    );
}

const styles = StyleSheet.create({
    header: {
        alignItems: "center",
        paddingTop: 4,
        paddingBottom: 8,
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
    description: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        borderWidth: 1,
        marginBottom: 24,
    },
    footer: {
        padding: SPACING.lg,
    },
    createBtn: {
        backgroundColor: "#f59e0b",
        borderRadius: BORDER_RADIUS.md,
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    createBtnDisabled: { opacity: 0.45 },
    createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    errorText: { color: "#ef4444", fontSize: 12, marginTop: 12, textAlign: "center" },
});
