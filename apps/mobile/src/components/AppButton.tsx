import React from "react";
import {
    ActivityIndicator,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    View,
    ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BORDER_RADIUS, SPACING, TOUCH_TARGET } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import PressableScale from "./PressableScale";
import type { HapticKind } from "../services/haptics";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface AppButtonProps {
    label: string;
    onPress: () => void;
    variant?: Variant;
    size?: Size;
    icon?: keyof typeof Ionicons.glyphMap;
    iconPosition?: "left" | "right";
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    haptic?: HapticKind | null;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    accessibilityHint?: string;
}

const SIZES: Record<Size, { height: number; fontSize: number; paddingH: number; icon: number }> = {
    sm: { height: 40, fontSize: 14, paddingH: SPACING.md, icon: 16 },
    md: { height: 48, fontSize: 15, paddingH: SPACING.lg, icon: 18 },
    lg: { height: 54, fontSize: 16, paddingH: SPACING.lg, icon: 20 },
};

/**
 * Primary button primitive. Handles every state the design brief calls for —
 * pressed (scale), loading (spinner swapped in place, no layout shift),
 * disabled — plus consistent haptics and a guaranteed 44pt touch target.
 */
export default function AppButton({
    label,
    onPress,
    variant = "primary",
    size = "md",
    icon,
    iconPosition = "left",
    loading = false,
    disabled = false,
    fullWidth = false,
    haptic = "light",
    style,
    textStyle,
    accessibilityHint,
}: AppButtonProps) {
    const { colors, isDark } = useTheme();
    const dims = SIZES[size];
    const isDisabled = disabled || loading;

    const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
        primary: { bg: colors.primary, fg: isDark ? "#1a1a1a" : "#1a1a1a" },
        secondary: { bg: colors.surfaceHighlight, fg: colors.text },
        ghost: { bg: "transparent", fg: colors.primary },
        destructive: { bg: colors.error, fg: "#ffffff" },
    };
    const p = palette[variant];

    const content = (
        <>
            {icon && iconPosition === "left" && !loading && (
                <Ionicons name={icon} size={dims.icon} color={p.fg} />
            )}
            <Text
                numberOfLines={1}
                style={[
                    styles.label,
                    { color: p.fg, fontSize: dims.fontSize, opacity: loading ? 0 : 1 },
                    textStyle,
                ]}
            >
                {label}
            </Text>
            {icon && iconPosition === "right" && !loading && (
                <Ionicons name={icon} size={dims.icon} color={p.fg} />
            )}
            {loading && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <View style={styles.loaderCenter}>
                        <ActivityIndicator color={p.fg} size="small" />
                    </View>
                </View>
            )}
        </>
    );

    return (
        <PressableScale
            haptic={isDisabled ? null : haptic}
            disabled={isDisabled}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            style={[
                styles.base,
                {
                    minHeight: Math.max(dims.height, TOUCH_TARGET.min),
                    paddingHorizontal: dims.paddingH,
                    backgroundColor: p.bg,
                    borderColor: p.border ?? "transparent",
                    borderWidth: p.border ? 1 : 0,
                    opacity: isDisabled && !loading ? 0.45 : 1,
                    alignSelf: fullWidth ? "stretch" : "auto",
                },
                style,
            ]}
        >
            {content}
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: BORDER_RADIUS.md,
    },
    label: {
        fontWeight: "700",
        textAlign: "center",
    },
    loaderCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
});
