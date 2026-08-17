import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { BORDER_RADIUS, SPACING, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

export type StatusKind =
    | "todo"
    | "inProgress"
    | "review"
    | "hold"
    | "completed"
    | "cancelled"
    | "overdue"
    | "dueSoon"
    | "onTrack"
    | "success"
    | "warning"
    | "error"
    | "info"
    | "neutral";

interface StatusChipProps {
    label: string;
    kind: StatusKind;
    size?: "sm" | "md";
    style?: StyleProp<ViewStyle>;
}

/**
 * Semantic status/urgency pill. Always pairs color with a text label — never
 * communicates state by color alone (accessibility requirement).
 */
export default function StatusChip({ label, kind, size = "md", style }: StatusChipProps) {
    const { colors } = useTheme();

    const colorMap: Record<StatusKind, string> = {
        todo: colors.statusTodo,
        inProgress: colors.statusInProgress,
        review: colors.statusReview,
        hold: colors.statusHold,
        completed: colors.statusCompleted,
        cancelled: colors.statusCancelled,
        overdue: colors.urgencyOverdue,
        dueSoon: colors.urgencyDueSoon,
        onTrack: colors.urgencyOnTrack,
        success: colors.validationSuccess,
        warning: colors.warning,
        error: colors.validationError,
        info: colors.info,
        neutral: colors.textDim,
    };
    const tint = colorMap[kind];

    return (
        <View
            accessibilityRole="text"
            accessibilityLabel={label}
            style={[
                styles.base,
                size === "sm" ? styles.sm : styles.md,
                { backgroundColor: `${tint}1E`, borderColor: `${tint}40` },
                style,
            ]}
        >
            <View style={[styles.dot, { backgroundColor: tint }]} />
            <Text
                numberOfLines={1}
                style={[styles.label, size === "sm" && styles.labelSm, { color: tint }]}
            >
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1,
        gap: 6,
    },
    sm: { paddingHorizontal: SPACING.sm, paddingVertical: 3 },
    md: { paddingHorizontal: SPACING.sm + 2, paddingVertical: 5 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    label: { fontSize: 12, fontFamily: FONTS.bold },
    labelSm: { fontSize: 11 },
});
