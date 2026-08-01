import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACING, TOUCH_TARGET, TYPOGRAPHY, Z_INDEX } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import GlassSurface from "./GlassSurface";

interface GlassHeaderProps {
    title?: string;
    left?: React.ReactNode;
    right?: React.ReactNode;
    /** Extra content below the title row (e.g. workspace switcher, tabs). */
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/**
 * Floating liquid-glass app header: safe-area aware, sits at Z_INDEX.header
 * above ambient content. Use for screen tops that should feel like a
 * translucent chrome layer rather than a solid title bar.
 */
export default function GlassHeader({ title, left, right, children, style }: GlassHeaderProps) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    return (
        <GlassSurface
            level="elevated"
            intensity="header"
            radius="lg"
            elevation="sm"
            style={[
                styles.container,
                { paddingTop: insets.top + SPACING.sm, zIndex: Z_INDEX.header },
                style,
            ]}
        >
            <View style={styles.row}>
                <View style={styles.side}>{left}</View>
                {title ? (
                    <Text
                        numberOfLines={1}
                        accessibilityRole="header"
                        style={[TYPOGRAPHY.h3, styles.title, { color: colors.text }]}
                    >
                        {title}
                    </Text>
                ) : (
                    <View style={{ flex: 1 }} />
                )}
                <View style={[styles.side, styles.sideRight]}>{right}</View>
            </View>
            {children}
        </GlassSurface>
    );
}

const styles = StyleSheet.create({
    container: {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: TOUCH_TARGET.min,
    },
    side: {
        minWidth: TOUCH_TARGET.min,
        flexDirection: "row",
        alignItems: "center",
    },
    sideRight: {
        justifyContent: "flex-end",
    },
    title: {
        flex: 1,
        textAlign: "center",
    },
});
