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
                {/* Backdrop Blur & Dimmed background overlay */}
                <Animated.View
                    entering={FadeIn.duration(MOTION.duration.fast)}
                    exiting={FadeOut.duration(MOTION.duration.fast)}
                    style={StyleSheet.absoluteFill}
                >
                    <BlurView intensity={isDark ? 60 : 45} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(10,10,10,0.85)" : "rgba(255,255,255,0.85)" }]} />
                </Animated.View>

                {/* Floating Radial items aligned to the right side */}
                <View style={[styles.menuContainer, { bottom: Math.max(insets.bottom, 20) + 110 }]}>
                    {ACTIONS.map((item, index) => {
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
                                    {/* Opaque solid text label box */}
                                    <View style={[styles.labelContainer, { backgroundColor: colors.surfaceSolid, borderColor: colors.border, borderWidth: 1 }]}>
                                        <Text style={[styles.labelText, { color: colors.text }]}>{item.label}</Text>
                                    </View>
                                    {/* Opaque solid circular icon blob */}
                                    <View style={[styles.iconBlob, { backgroundColor: colors.surfaceSolid, borderColor: colors.border, borderWidth: 1 }]}>
                                        <Ionicons name={item.icon as any} size={22} color={item.color} />
                                    </View>
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
