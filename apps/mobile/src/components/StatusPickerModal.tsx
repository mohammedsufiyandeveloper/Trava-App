import React from "react";
import {
    View,
    Text,
    StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { getStatusHex, getStatusBgColor } from "../utils/taskColors";
import Sheet from "./Sheet";
import PressableScale from "./PressableScale";
import { haptics } from "../services/haptics";

interface StatusPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (status: string) => void;
    currentStatus: string;
    onMorePress?: () => void;
}

export default function StatusPickerModal({
    visible,
    onClose,
    onSelect,
    currentStatus,
    onMorePress
}: StatusPickerModalProps) {
    const { colors, isDark } = useTheme();

    const STATUS_OPTIONS = [
        { id: "TO_DO", label: "To Do", icon: "list-outline", color: getStatusHex("TO_DO") },
        { id: "IN_PROGRESS", label: "In Progress", icon: "play-circle-outline", color: getStatusHex("IN_PROGRESS") },
        { id: "REVIEW", label: "Review", icon: "eye-outline", color: getStatusHex("REVIEW") },
        { id: "HOLD", label: "Hold", icon: "pause-circle-outline", color: getStatusHex("HOLD") },
        { id: "COMPLETED", label: "Completed", icon: "checkbox-outline", color: getStatusHex("COMPLETED") },
        { id: "CANCELLED", label: "Cancelled", icon: "close-circle-outline", color: getStatusHex("CANCELLED") },
    ];

    return (
        <Sheet visible={visible} onClose={onClose} accessibilityLabel="Update status">
            <View style={styles.headerRow}>
                <View style={{ width: 40 }} />
                <Text style={[styles.title, { color: colors.text }]}>Update Status</Text>
                {onMorePress ? (
                    <PressableScale
                        haptic="selection"
                        style={styles.moreButton}
                        onPress={() => {
                            onClose();
                            onMorePress();
                        }}
                        accessibilityLabel="More options"
                    >
                        <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
                    </PressableScale>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            <View style={styles.content}>
                {STATUS_OPTIONS.map((opt) => {
                    const isSelected = currentStatus === opt.id;
                    const isDisabled = (currentStatus === "TO_DO" && (opt.id === "REVIEW" || opt.id === "COMPLETED")) ||
                                     (currentStatus === "IN_PROGRESS" && opt.id === "COMPLETED");

                    return (
                        <PressableScale
                            key={opt.id}
                            haptic={null}
                            disabled={isDisabled}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                            accessibilityLabel={opt.label}
                            style={[
                                styles.statusItem,
                                isSelected && { backgroundColor: isDark ? colors.activeTab : "#e0e7ff" },
                                isDisabled && { opacity: 0.3 }
                            ]}
                            onPress={() => {
                                haptics.selection();
                                onSelect(opt.id);
                                onClose();
                            }}
                        >
                            <View style={[styles.iconBox, { backgroundColor: getStatusBgColor(opt.id) }]}>
                                <Ionicons name={opt.icon as any} size={20} color={opt.color} />
                            </View>
                            <Text style={[
                                styles.statusLabel,
                                { color: colors.text },
                                isSelected && { color: colors.primary, fontWeight: "700" }
                            ]}>
                                {opt.label}
                            </Text>
                            {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                        </PressableScale>
                    );
                })}
            </View>
        </Sheet>
    );
}

const styles = StyleSheet.create({
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: SPACING.md, paddingBottom: 12 },
    title: { fontSize: 18, fontWeight: "700" },
    moreButton: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },

    content: { paddingHorizontal: SPACING.md, paddingTop: 4 },
    statusItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: 4,
    },
    iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: SPACING.md },
    statusLabel: { flex: 1, fontSize: 16, fontWeight: "500" },
});
