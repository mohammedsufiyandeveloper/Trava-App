import React from "react";
import { Modal, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BORDER_RADIUS, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import PressableScale from "./PressableScale";

export interface HeaderMenuItem {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    /** Overrides the default text/icon colour — use for the accented entry. */
    color?: string;
    accessibilityLabel?: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    items: HeaderMenuItem[];
    /** Distance from below the safe-area inset to the top of the menu. */
    top: number;
    /** Distance from the screen's right edge. */
    right: number;
}

const MENU_WIDTH = 196;

/**
 * The "..." dropdown used by the top-level screen headers.
 *
 * Rendered in a Modal: nested in the page it would sit under any full-screen
 * dismiss layer, which swallows its taps. Positioned by layout rather than by
 * measureInWindow — under Android edge-to-edge the modal window and the
 * measured coordinates don't share an origin, which pushes the menu up over the
 * header by the status bar height. The surface is opaque, not glass: a blurred
 * surface inside a Modal can't sample the app content behind it, so it renders
 * see-through.
 */
export default function HeaderMenu({ visible, onClose, items, top, right }: Props) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            transparent
            statusBarTranslucent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
            </TouchableWithoutFeedback>

            <View
                pointerEvents="box-none"
                style={[styles.anchor, { paddingTop: insets.top + top, paddingRight: right }]}
            >
                <View style={[styles.menu, { backgroundColor: colors.surfaceSolidRaised, borderColor: colors.border }]}>
                    {items.map(item => (
                        <PressableScale
                            key={item.label}
                            haptic="selection"
                            style={styles.item}
                            onPress={item.onPress}
                            accessibilityRole="button"
                            accessibilityLabel={item.accessibilityLabel ?? item.label}
                        >
                            <Ionicons name={item.icon} size={20} color={item.color ?? colors.text} />
                            <Text style={[styles.label, { color: item.color ?? colors.text }]}>{item.label}</Text>
                        </PressableScale>
                    ))}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    anchor: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "flex-end",
    },
    menu: {
        width: MENU_WIDTH,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        paddingVertical: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
        elevation: 16,
    },
    item: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 11,
        paddingHorizontal: 14,
        gap: 12,
    },
    label: { fontSize: 14.5, fontFamily: FONTS.semibold },
});
