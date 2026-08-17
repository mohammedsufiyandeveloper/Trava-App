import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import Sheet from "./Sheet";
import AppButton from "./AppButton";

interface ConfirmationSheetProps {
    visible: boolean;
    title: string;
    description?: string;
    /** Defaults to "destructive" styling for the confirm action. */
    tone?: "destructive" | "warning" | "default";
    confirmLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

/**
 * Standard confirmation UI for consequential/destructive actions (delete,
 * remove member, reject request, etc.) — use instead of a bare native Alert
 * whenever the app wants a branded, glass-consistent confirmation.
 */
export default function ConfirmationSheet({
    visible,
    title,
    description,
    tone = "destructive",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    loading = false,
    onConfirm,
    onClose,
}: ConfirmationSheetProps) {
    const { colors } = useTheme();
    const iconColor = tone === "destructive" ? colors.error : tone === "warning" ? colors.warning : colors.primary;
    const iconName = tone === "destructive" ? "alert-circle" : tone === "warning" ? "warning" : "help-circle";

    return (
        <Sheet visible={visible} onClose={onClose} dismissable={!loading} accessibilityLabel={title}>
            <View style={styles.content}>
                <View style={[styles.iconWrap, { backgroundColor: `${iconColor}18` }]}>
                    <Ionicons name={iconName} size={28} color={iconColor} />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                {description && <Text style={[styles.description, { color: colors.textDim }]}>{description}</Text>}

                <AppButton
                    label={confirmLabel}
                    onPress={onConfirm}
                    variant={tone === "destructive" ? "destructive" : "primary"}
                    loading={loading}
                    fullWidth
                    haptic="warning"
                    style={{ marginTop: SPACING.lg }}
                />
                <AppButton
                    label={cancelLabel}
                    onPress={onClose}
                    variant="ghost"
                    disabled={loading}
                    fullWidth
                    haptic="light"
                    style={{ marginTop: SPACING.sm }}
                />
            </View>
        </Sheet>
    );
}

const styles = StyleSheet.create({
    content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, alignItems: "center" },
    iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: SPACING.md },
    title: { fontSize: 18, fontFamily: FONTS.bold, textAlign: "center", marginBottom: 6 },
    description: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
