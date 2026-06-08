import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import * as Haptics from "expo-haptics";
import { SPACING } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { RadialMenuProps, RadialActionItem } from "../types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RadialMenu({
    visible,
    onClose,
    onAction,
}: RadialMenuProps) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const ACTIONS: RadialActionItem[] = [
        { id: "project", label: "Project", icon: "layers", color: "#3b82f6" },
        { id: "task", label: "Task", icon: "checkbox", color: colors.primary },
        { id: "subtask", label: "Sub Task", icon: "git-branch", color: "#8b5cf6" },
        { id: "tag", label: "Tag", icon: "pricetag", color: "#f59e0b" },
        { id: "attendance", label: "Attendance", icon: "time", color: "#10b981" },
        { id: "ai", label: "Trava AI", icon: "sparkles", color: "#ec4899" },
    ];

    const triggerTapticSelection = (id: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onAction(id);
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <View style={[styles.menuContainer, { bottom: Math.max(insets.bottom, 20) + 110 }]}>
                        {ACTIONS.map((item) => (
                            <View key={item.id} style={styles.actionWrapper}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.actionRow}
                                    onPress={() => triggerTapticSelection(item.id)}
                                >
                                    <View style={[styles.labelContainer, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }]}>
                                        <Text style={[styles.labelText, { color: colors.text }]}>{item.label}</Text>
                                    </View>
                                    <View style={[styles.iconBlob, { backgroundColor: isDark ? colors.surface : '#FFFFFF' }]}>
                                        <Ionicons name={item.icon as any} size={22} color={item.color} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    menuContainer: {
        position: "absolute",
        right: 22, // Aligned with the new FAB right position
        alignItems: "flex-end",
        gap: 16,
    },
    actionWrapper: {
        alignItems: 'flex-end',
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
        fontWeight: "700",
    },
    iconBlob: {
        width: 54,
        height: 54,
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
});
