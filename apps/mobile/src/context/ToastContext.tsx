import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

import { BORDER_RADIUS, ELEVATION, SPACING, Z_INDEX } from "../constants/theme";
import { useTheme } from "./ThemeContext";
import { haptics } from "../services/haptics";

export type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastOptions {
    variant?: ToastVariant;
    duration?: number;
}

interface ToastState {
    id: number;
    message: string;
    variant: ToastVariant;
    duration: number;
}

interface ToastContextValue {
    show: (message: string, options?: ToastOptions) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const VARIANT_META: Record<ToastVariant, { icon: keyof typeof Ionicons.glyphMap; color: string; haptic: () => void }> = {
    success: { icon: "checkmark-circle", color: "#10b981", haptic: haptics.success },
    error: { icon: "alert-circle", color: "#ef4444", haptic: haptics.error },
    info: { icon: "information-circle", color: "#3b82f6", haptic: haptics.light },
    warning: { icon: "warning", color: "#f59e0b", haptic: haptics.warning },
};

let idSeq = 0;

/**
 * App-wide non-blocking toast. Mount <ToastProvider> once near the root and call
 * useToast() anywhere. Use this for routine success/error feedback instead of a
 * blocking Alert; keep Alert/ConfirmationSheet for destructive confirmations.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [toast, setToast] = useState<ToastState | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    };

    const show = useCallback((message: string, options?: ToastOptions) => {
        const variant = options?.variant ?? "info";
        const duration = options?.duration ?? 2800;
        clearTimer();
        const next: ToastState = { id: ++idSeq, message, variant, duration };
        setToast(next);
        VARIANT_META[variant].haptic();
        // Announce for screen-reader users.
        AccessibilityInfo.announceForAccessibility?.(message);
        timer.current = setTimeout(() => setToast((cur) => (cur?.id === next.id ? null : cur)), duration);
    }, []);

    const value: ToastContextValue = {
        show,
        success: (m, d) => show(m, { variant: "success", duration: d }),
        error: (m, d) => show(m, { variant: "error", duration: d }),
        info: (m, d) => show(m, { variant: "info", duration: d }),
        warning: (m, d) => show(m, { variant: "warning", duration: d }),
    };

    useEffect(() => clearTimer, []);

    const meta = toast ? VARIANT_META[toast.variant] : null;

    return (
        <ToastContext.Provider value={value}>
            {children}
            {toast && meta && (
                <Animated.View
                    key={toast.id}
                    entering={FadeInUp.springify().damping(18).stiffness(200)}
                    exiting={FadeOutUp.duration(180)}
                    pointerEvents="none"
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                    style={[
                        styles.container,
                        ELEVATION.lg,
                        {
                            top: insets.top + SPACING.sm,
                            backgroundColor: isDark ? "#1f1f1f" : "#ffffff",
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                    <Text numberOfLines={3} style={[styles.message, { color: colors.text }]}>
                        {toast.message}
                    </Text>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within a ToastProvider");
    return ctx;
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        left: SPACING.md,
        right: SPACING.md,
        zIndex: Z_INDEX.toast,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        paddingVertical: 12,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: StyleSheet.hairlineWidth,
    },
    message: {
        flex: 1,
        fontSize: 14,
        fontWeight: "600",
    },
});
