import React from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import BlurView from "./BlurView";
import { BORDER_RADIUS, BLUR_INTENSITY, ELEVATION } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

type Level = "surface" | "elevated";

interface GlassSurfaceProps {
    children?: React.ReactNode;
    level?: Level;
    /** Blur intensity preset. Defaults based on level. */
    intensity?: keyof typeof BLUR_INTENSITY;
    radius?: keyof typeof BORDER_RADIUS;
    elevation?: keyof typeof ELEVATION;
    /**
     * Android (and low-end/perf-fallback) devices render real-time blur
     * inconsistently and expensively. Set false to force the cheap tinted
     * fallback everywhere (e.g. behind a long list) instead of a live blur.
     */
    allowBlur?: boolean;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
}

/**
 * The base liquid-glass material: a live blur (iOS, capable Android) with a
 * translucent tint, hairline border, and a soft inner top highlight — the
 * building block for headers, sheets, FABs, and floating nav. Never place
 * long-form text or large virtualized lists directly on this; use a solid
 * AppCard/surfaceSolid for that content instead.
 */
export default function GlassSurface({
    children,
    level = "surface",
    intensity,
    radius = "lg",
    elevation = "md",
    allowBlur = true,
    style,
    accessibilityLabel,
}: GlassSurfaceProps) {
    const { colors, isDark } = useTheme();
    const useBlur = allowBlur && Platform.OS !== "web";
    const resolvedIntensity = intensity ? BLUR_INTENSITY[intensity] : BLUR_INTENSITY.subtle;
    const tint = level === "elevated" ? colors.glassSurfaceElevated : colors.glassSurface;

    return (
        <View
            accessibilityLabel={accessibilityLabel}
            style={[
                styles.base,
                ELEVATION[elevation],
                { borderRadius: BORDER_RADIUS[radius], borderColor: colors.glassBorder },
                style,
            ]}
        >
            {useBlur && (
                <BlurView
                    intensity={resolvedIntensity}
                    tint={isDark ? "dark" : "light"}
                    style={StyleSheet.absoluteFill}
                />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
            <View pointerEvents="none" style={[styles.innerHighlight, { borderColor: colors.glassHighlight }]} />
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
    },
    innerHighlight: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: StyleSheet.hairlineWidth * 2,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});
