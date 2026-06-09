import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { BORDER_RADIUS, ELEVATION, SPACING } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import PressableScale from "./PressableScale";

interface AppCardProps {
    children: React.ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    /** Visual elevation. Defaults to "sm". */
    elevation?: keyof typeof ELEVATION;
    padded?: boolean;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
}

/**
 * Standard surface card. Renders a static View by default, or a PressableScale
 * when onPress is provided — so tappable cards get spring feedback + haptics for
 * free while non-interactive cards stay cheap.
 */
export default function AppCard({
    children,
    onPress,
    onLongPress,
    elevation = "sm",
    padded = true,
    style,
    accessibilityLabel,
}: AppCardProps) {
    const { colors } = useTheme();

    const cardStyle: StyleProp<ViewStyle> = [
        styles.card,
        ELEVATION[elevation],
        {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            padding: padded ? SPACING.md : 0,
        },
        style,
    ];

    if (onPress || onLongPress) {
        return (
            <PressableScale
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={accessibilityLabel}
                style={cardStyle}
            >
                {children}
            </PressableScale>
        );
    }

    return (
        <View style={cardStyle} accessibilityLabel={accessibilityLabel}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: StyleSheet.hairlineWidth,
    },
});
