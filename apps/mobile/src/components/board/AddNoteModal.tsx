import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    ActivityIndicator,
    ScrollView,
    Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import Sheet from "../Sheet";
import PressableScale from "../PressableScale";
import { haptics } from "../../services/haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface AddNoteModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (note: string) => Promise<void>;
    memberSurname?: string;
    isSelf?: boolean;
}

export default function AddNoteModal({ visible, onClose, onSubmit, memberSurname, isSelf }: AddNoteModalProps) {
    const { colors } = useTheme();
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
        if (!note.trim() || loading) return;

        setLoading(true);
        setError(null);
        try {
            await onSubmit(note.trim());
            haptics.success();
            setNote("");
            onClose();
        } catch (err: any) {
            setError(err.message || "An error occurred");
            haptics.error();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet visible={visible} onClose={onClose} accessibilityLabel="Add note">
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: colors.text }]}>Add Note</Text>
                    <PressableScale haptic="selection" onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                        <Ionicons name="close" size={24} color={colors.textDim} />
                    </PressableScale>
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
                    accessibilityLabel="Note text"
                />
                {error && <Text style={styles.errorText}>{error}</Text>}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <PressableScale
                    haptic={null}
                    style={[styles.createBtn, { backgroundColor: colors.primary }, (!note.trim() || loading) && styles.createBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!note.trim() || loading}
                    accessibilityRole="button"
                    accessibilityLabel="Add note"
                    accessibilityState={{ disabled: !note.trim() || loading, busy: loading }}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.createBtnText}>Add Note</Text>
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
