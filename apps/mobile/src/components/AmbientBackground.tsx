import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AMBIENT_GRADIENTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import WaterDropDecoration from "./WaterDropDecoration";

interface AmbientBackgroundProps {
    /** Show the abstract water-drop shapes on top of the gradient. Off by default for dense screens. */
    decoration?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * Full-bleed low-opacity ambient gradient wash. Intended as a background
 * layer behind auth, Home hero, Travis AI, and selected empty states —
 * never behind forms, tables, or dense lists (keeps content contrast high).
 */
export default function AmbientBackground({ decoration = false, style }: AmbientBackgroundProps) {
    const { theme, colors } = useTheme();
    const stops = AMBIENT_GRADIENTS[theme];

    return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
            <LinearGradient
                colors={stops}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {decoration && <WaterDropDecoration />}
        </View>
    );
}
