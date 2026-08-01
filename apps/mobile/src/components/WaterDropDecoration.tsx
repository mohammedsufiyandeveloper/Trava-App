import React, { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { useReducedMotion } from "../hooks/useReducedMotion";

interface DropProps {
    size: number;
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    colors: readonly [string, string, ...string[]];
    drift: number;
    duration: number;
    reducedMotion: boolean;
}

function Drop({ size, top, bottom, left, right, colors, drift, duration, reducedMotion }: DropProps) {
    const t = useSharedValue(0);

    useEffect(() => {
        if (reducedMotion) return;
        t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
    }, [reducedMotion, duration, t]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: reducedMotion ? 0 : (t.value - 0.5) * drift },
            { translateX: reducedMotion ? 0 : (t.value - 0.5) * (drift * 0.6) },
        ],
    }));

    return (
        <Animated.View
            style={[
                { position: "absolute", width: size, height: size, top, bottom, left, right },
                animatedStyle,
            ]}
        >
            <LinearGradient
                colors={colors}
                style={{ width: size, height: size, borderRadius: size / 2 }}
            />
        </Animated.View>
    );
}

/**
 * Abstract, low-opacity blurred-circle "water drop" shapes for auth, Home,
 * Travis AI, and selected empty states. Purely decorative — never placed
 * where it could reduce text contrast. Idle drift is cheap (transform-only,
 * Reanimated) and disabled entirely under Reduce Motion.
 */
export default function WaterDropDecoration() {
    const { isDark } = useTheme();
    const reducedMotion = useReducedMotion();
    const { width } = useWindowDimensions();

    const primary = isDark
        ? (["rgba(251,181,74,0.22)", "rgba(251,181,74,0)"] as const)
        : (["rgba(251,181,74,0.30)", "rgba(251,181,74,0)"] as const);
    const cool = isDark
        ? (["rgba(59,130,246,0.16)", "rgba(59,130,246,0)"] as const)
        : (["rgba(59,130,246,0.14)", "rgba(59,130,246,0)"] as const);

    return (
        <View style={StyleSheet.absoluteFill}>
            <Drop
                size={width * 0.9}
                top={-width * 0.35}
                right={-width * 0.3}
                colors={primary}
                drift={18}
                duration={9000}
                reducedMotion={reducedMotion}
            />
            <Drop
                size={width * 0.7}
                bottom={-width * 0.25}
                left={-width * 0.25}
                colors={cool}
                drift={14}
                duration={11000}
                reducedMotion={reducedMotion}
            />
        </View>
    );
}
