import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import AppButton from "./AppButton";

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    retryLabel?: string;
    /** "offline" softens the icon/tone for connectivity issues. */
    variant?: "error" | "offline";
}

/**
 * Distinct error/offline state with an inline retry. Critical for Phase 7: an
 * API failure must never look like a legitimate empty state — show this instead
 * so the user knows something went wrong and can recover.
 */
export default function ErrorState({
    title,
    message,
    onRetry,
    retryLabel = "Try again",
    variant = "error",
}: ErrorStateProps) {
    const { colors } = useTheme();
    const isOffline = variant === "offline";
    const icon = isOffline ? "cloud-offline-outline" : "alert-circle-outline";
    const resolvedTitle = title ?? (isOffline ? "You're offline" : "Something went wrong");

    return (
        <View style={styles.container} accessibilityRole="alert">
            <View style={[styles.iconWrap, { backgroundColor: isOffline ? colors.surfaceHighlight : "#ef444422" }]}>
                <Ionicons name={icon} size={36} color={isOffline ? colors.textDim : colors.error} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{resolvedTitle}</Text>
            {message ? <Text style={[styles.message, { color: colors.textDim }]}>{message}</Text> : null}
            {onRetry ? (
                <AppButton
                    label={retryLabel}
                    icon="refresh"
                    variant="secondary"
                    onPress={onRetry}
                    style={{ marginTop: SPACING.md }}
                    accessibilityHint="Retries the failed request"
                />
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
