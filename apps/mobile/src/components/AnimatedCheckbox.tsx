import React, { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
} from "react-native-reanimated";

import { MOTION, TOUCH_TARGET } from "../constants/theme";
import { haptics } from "../services/haptics";
import { useReducedMotion } from "../hooks/useReducedMotion";
import PressableScale from "./PressableScale";

interface AnimatedCheckboxProps {
    checked: boolean;
    onToggle: () => void;
    disabled?: boolean;
    size?: number;
    color?: string;
    doneColor?: string;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
}

/**
 * Task checkbox that pops with a spring and fires a haptic on toggle — success
 * when completing, selection when un-completing. The most-touched control in a
 * task app, so it earns the polish. Respects Reduce Motion (no pop) and exposes
 * a proper checkbox role + checked state.
 */
export default function AnimatedCheckbox({
    checked,
    onToggle,
    disabled,
    size = 22,
    color = "#9ca3af",
    doneColor,
    style,
    accessibilityLabel,
}: AnimatedCheckboxProps) {
    const reducedMotion = useReducedMotion();
    const scale = useSharedValue(1);
    const mounted = useSharedValue(false);

    useEffect(() => {
        if (!mounted.value) {
            mounted.value = true;
            return;
        }
        if (reducedMotion) return;
        scale.value = withSequence(
            withSpring(0.8, MOTION.spring.snappy),
            withSpring(1.15, MOTION.spring.bouncy),
            withSpring(1, MOTION.spring.snappy)
        );
    }, [checked, scale, mounted, reducedMotion]);

    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    const handlePress = () => {
        if (disabled) return;
        haptics[checked ? "selection" : "success"]();
        onToggle();
    };

    return (
        <PressableScale
            haptic={null}
            activeScale={0.85}
            disabled={disabled}
            onPress={handlePress}
            hitSlop={10}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: !!disabled }}
            accessibilityLabel={accessibilityLabel}
            style={[{ minWidth: TOUCH_TARGET.min, minHeight: TOUCH_TARGET.min, alignItems: "center", justifyContent: "center" }, style]}
        >
            <Animated.View style={animatedStyle}>
                <Ionicons
                    name={checked ? "checkmark-circle" : "ellipse-outline"}
                    size={size}
                    color={checked ? (doneColor ?? color) : color}
                />
            </Animated.View>
        </PressableScale>
    );
}
