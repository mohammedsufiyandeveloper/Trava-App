import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import AppButton from "./AppButton";

interface EmptyStateProps {
    icon?: keyof typeof Ionicons.glyphMap;
    title: string;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
}

/**
 * Friendly empty state with an optional primary action. Use whenever a list or
 * screen has legitimately no data — never leave a blank screen, and never reuse
 * this for an error (use ErrorState so failures aren't mistaken for "no data").
 */
export default function EmptyState({ icon = "file-tray-outline", title, message, actionLabel, onAction }: EmptyStateProps) {
    const { colors } = useTheme();
    return (
        <View style={styles.container} accessibilityRole="summary">
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceHighlight }]}>
                <Ionicons name={icon} size={36} color={colors.textDim} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {message ? <Text style={[styles.message, { color: colors.textDim }]}>{message}</Text> : null}
            {actionLabel && onAction ? (
                <AppButton label={actionLabel} onPress={onAction} size="md" style={{ marginTop: SPACING.md }} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.xxl,
    },
    iconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        textAlign: "center",
    },
    message: {
        fontSize: 14,
        textAlign: "center",
        marginTop: SPACING.xs,
        lineHeight: 20,
        maxWidth: 320,
    },
});
