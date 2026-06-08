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
import { SPACING, BORDER_RADIUS } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface AddNoteModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (note: string) => Promise<void>;
    memberSurname?: string;
    isSelf?: boolean;
}

export default function AddNoteModal({ visible, onClose, onSubmit, memberSurname, isSelf }: AddNoteModalProps) {
    const { colors, isDark } = useTheme();
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) {
            setNote("");
            setError(null);
        }
    }, [visible]);

    const handleSubmit = async () => {
        if (!note.trim()) return;
        
        setLoading(true);
        setError(null);
        try {
            await onSubmit(note.trim());
            setNote("");
            onClose();
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
                                <Text style={[styles.title, { color: colors.text }]}>Add Note</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <Ionicons name="close" size={24} color={colors.textDim} />
                                </TouchableOpacity>
                            </View>
                            <Text style={[styles.subtitle, { color: colors.textDim }]}>
                                Create a new item for {isSelf ? 'yourself' : `this team member (${memberSurname})`}.
                            </Text>
                        </View>

                        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder="Type your note here... (e.g. Finish the UI audit)"
                                placeholderTextColor={colors.textDim}
                                value={note}
                                onChangeText={setNote}
                                autoFocus
                                multiline
                                textAlignVertical="top"
                            />
                            {error && <Text style={styles.errorText}>{error}</Text>}
                        </ScrollView>

                        <View style={[styles.footer, { borderTopColor: colors.border }]}>
                            <TouchableOpacity 
                                style={[styles.createBtn, { backgroundColor: colors.primary }, (!note.trim() || loading) && styles.createBtnDisabled]}
                                onPress={handleSubmit}
                                disabled={!note.trim() || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.createBtnText}>Add Note</Text>
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
    subtitle: {
        width: "100%",
        paddingHorizontal: SPACING.lg,
        marginTop: 4,
        fontSize: 13,
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        padding: SPACING.lg,
    },
    input: {
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        borderWidth: 1,
        minHeight: 140,
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
