import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BlurView from "./BlurView";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

import { MOTION, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { RadialMenuProps, RadialActionItem } from "../types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../services/haptics";
import { useReducedMotion } from "../hooks/useReducedMotion";
import PressableScale from "./PressableScale";
import GlassSurface from "./GlassSurface";

/**
 * Tighter than MOTION.stagger (45ms): with six items that token would spread
 * the reveal over 225ms, which reads as slow rather than lively.
 */
const ITEM_STAGGER = 26;

export default function RadialMenu({
    visible,
    onClose,
    onAction,
}: RadialMenuProps) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const reducedMotion = useReducedMotion();

    const ACTIONS: RadialActionItem[] = [
        { id: "project", label: "Project", icon: "layers", color: "#3b82f6" },
        { id: "task", label: "Task", icon: "checkbox", color: colors.primary },
        { id: "subtask", label: "Sub Task", icon: "git-branch", color: "#8b5cf6" },
        { id: "tag", label: "Tag", icon: "pricetag", color: "#f59e0b" },
        { id: "attendance", label: "Attendance", icon: "time", color: "#10b981" },
        { id: "ai", label: "Trava AI", icon: "sparkles", color: "#ec4899" },
    ];

    const handleSelect = (id: string) => {
        haptics.selection();
        onAction(id);
    };

    if (!visible) return null;

    const total = ACTIONS.length;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close create menu">
                <Animated.View
                    entering={FadeIn.duration(MOTION.duration.fast)}
                    exiting={FadeOut.duration(MOTION.duration.fast)}
                    style={StyleSheet.absoluteFill}
                >
                    <BlurView intensity={isDark ? 30 : 20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.3)" }]} />
                </Animated.View>

                <View style={[styles.menuContainer, { bottom: Math.max(insets.bottom, 20) + 110 }]}>
                    {ACTIONS.map((item, index) => {
                        // Items animate bottom-up; reverse the stagger so they appear
                        // to rise from the FAB. Eased rather than sprung — a spring
                        // loose enough to feel lively here overshoots and wobbles.
                        const entering = reducedMotion
                            ? FadeIn.duration(MOTION.duration.fast)
                            : FadeInDown.duration(MOTION.duration.base)
                                  .easing(Easing.out(Easing.cubic))
                                  .withInitialValues({ transform: [{ translateY: 14 }] })
                                  .delay((total - 1 - index) * ITEM_STAGGER);
                        return (
                            <Animated.View key={item.id} entering={entering} style={styles.actionWrapper}>
                                <PressableScale
                                    haptic={null}
                                    activeScale={0.96}
                                    style={styles.actionRow}
                                    onPress={() => handleSelect(item.id)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Create ${item.label}`}
                                >
                                    <GlassSurface level="elevated" intensity="sheet" radius="lg" elevation="sm" style={styles.labelContainer}>
                                        <Text style={[styles.labelText, { color: colors.text }]}>{item.label}</Text>
                                    </GlassSurface>
                                    <GlassSurface level="elevated" intensity="sheet" radius="full" elevation="sm" style={styles.iconBlob}>
                                        <Ionicons name={item.icon as any} size={22} color={item.color} />
                                    </GlassSurface>
                                </PressableScale>
                            </Animated.View>
                        );
                    })}
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    menuContainer: {
        position: "absolute",
        right: 22,
        alignItems: "flex-end",
        gap: 16,
    },
    actionWrapper: {
        alignItems: "flex-end",
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    labelContainer: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    labelText: {
        fontSize: 15,
        fontFamily: FONTS.bold,
    },
    iconBlob: {
        width: 54,
        height: 54,
        borderRadius: 27,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
});
