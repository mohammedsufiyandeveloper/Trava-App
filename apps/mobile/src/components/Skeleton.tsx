import React, { useEffect } from "react";
import { DimensionValue, StyleProp, View, ViewStyle } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

import { BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useReducedMotion } from "../hooks/useReducedMotion";

interface SkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    radius?: number;
    style?: StyleProp<ViewStyle>;
}

/**
 * A single shimmering placeholder block. Replace full-screen spinners with a
 * layout-matched arrangement of these — structure reads as "fast", spinners
 * read as "slow". Honors Reduce Motion by rendering a static dimmed block.
 */
export function Skeleton({ width = "100%", height = 16, radius = BORDER_RADIUS.sm, style }: SkeletonProps) {
    const { isDark } = useTheme();
    const reducedMotion = useReducedMotion();
    const progress = useSharedValue(0.5);

    useEffect(() => {
        if (reducedMotion) {
            progress.value = 0.6;
            return;
        }
        progress.value = withRepeat(
            withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, [progress, reducedMotion]);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

    const base = isDark ? "#2a2a2a" : "#e5e7eb";

    return (
        <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
                { width, height, borderRadius: radius, backgroundColor: base },
                animatedStyle,
                style,
            ]}
        />
    );
}

/** Convenience wrapper that lays out several Skeletons with consistent spacing. */
export function SkeletonGroup({
    children,
    gap = 12,
    style,
}: {
    children: React.ReactNode;
    gap?: number;
    style?: StyleProp<ViewStyle>;
}) {
    return <View style={[{ gap }, style]}>{children}</View>;
}

export default Skeleton;
