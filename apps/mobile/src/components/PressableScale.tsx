import React, { useCallback } from "react";
import {
    GestureResponderEvent,
    Pressable,
    PressableProps,
    StyleProp,
    ViewStyle,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

import { MOTION } from "../constants/theme";
import { triggerHaptic, HapticKind } from "../services/haptics";
import { useReducedMotion } from "../hooks/useReducedMotion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, "style"> {
    /** Scale while pressed. Defaults to MOTION.pressScale (0.97). */
    activeScale?: number;
    /** Optional dim while pressed (1 = none). */
    activeOpacity?: number;
    /** Haptic fired on press-in. Pass null to disable. Defaults to "light". */
    haptic?: HapticKind | null;
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
}

/**
 * The app's default tappable: springs down on press instead of just dimming,
 * fires a consistent haptic, and respects Reduce Motion (falls back to a small
 * opacity dip). Drop-in replacement for TouchableOpacity.
 *
 * Accessibility: defaults role to "button" and exposes a disabled state. Always
 * pass an `accessibilityLabel` when the control has no readable text child.
 */
export default function PressableScale({
    activeScale = MOTION.pressScale,
    activeOpacity = 1,
    haptic = "light",
    onPressIn,
    onPressOut,
    disabled,
    style,
    children,
    accessibilityRole,
    accessibilityState,
    ...rest
}: PressableScaleProps) {
    const reducedMotion = useReducedMotion();
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = useCallback(
        (e: GestureResponderEvent) => {
            if (reducedMotion) {
                // Minimal, non-motion feedback when Reduce Motion is on.
                opacity.value = withTiming(0.6, { duration: MOTION.duration.press });
            } else {
                scale.value = withSpring(activeScale, MOTION.spring.snappy);
                if (activeOpacity !== 1) {
                    opacity.value = withTiming(activeOpacity, { duration: MOTION.duration.press });
                }
            }
            if (haptic && !disabled) triggerHaptic(haptic);
            onPressIn?.(e);
        },
        [reducedMotion, activeScale, activeOpacity, haptic, disabled, onPressIn, scale, opacity]
    );

    const handlePressOut = useCallback(
        (e: GestureResponderEvent) => {
            scale.value = withSpring(1, MOTION.spring.snappy);
            opacity.value = withTiming(1, { duration: MOTION.duration.press });
            onPressOut?.(e);
        },
        [onPressOut, scale, opacity]
    );

    return (
        <AnimatedPressable
            accessibilityRole={accessibilityRole ?? "button"}
            accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
            {...rest}
            disabled={disabled}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[style, animatedStyle]}
        >
            {children}
        </AnimatedPressable>
    );
}
