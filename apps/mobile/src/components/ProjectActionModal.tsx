import React from "react";
import {
    View,
    Text,
    StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import Sheet from "./Sheet";
import PressableScale from "./PressableScale";

interface ProjectActionModalProps {
    visible: boolean;
    onClose: () => void;
    projectName: string;
    onView: () => void;
    onEdit: () => void;
    onManageMembers: () => void;
    onDelete: () => void;
    canManage?: boolean;
}

export default function ProjectActionModal({
    visible,
    onClose,
    projectName,
    onView,
    onEdit,
    onManageMembers,
    onDelete,
    canManage = false
}: ProjectActionModalProps) {
    const { colors } = useTheme();

    const ActionItem = ({
        icon,
        label,
        onPress,
        destructive = false
    }: {
        icon: keyof typeof Ionicons.glyphMap;
        label: string;
        onPress: () => void;
        destructive?: boolean;
    }) => (
        <PressableScale
            haptic={destructive ? "warning" : "selection"}
            style={styles.actionItem}
            onPress={() => {
                onPress();
                onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <View style={[styles.iconContainer, { backgroundColor: destructive ? `${colors.error}18` : colors.surfaceHighlight }]}>
                <Ionicons
                    name={icon}
                    size={20}
                    color={destructive ? colors.error : colors.primary}
                />
            </View>
            <Text style={[styles.actionLabel, { color: destructive ? colors.error : colors.text }]}>
                {label}
            </Text>
        </PressableScale>
    );

    return (
        <Sheet visible={visible} onClose={onClose} accessibilityLabel="Project actions">
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.textDim }]}>PROJECT ACTIONS</Text>
                <Text style={[styles.projectName, { color: colors.text }]} numberOfLines={1}>{projectName}</Text>
            </View>

            <View style={styles.actionsList}>
                <ActionItem icon="eye-outline" label="View Project" onPress={onView} />
                {canManage && (
                    <>
                        <ActionItem icon="pencil-outline" label="Edit Project" onPress={onEdit} />
                        <ActionItem icon="people-outline" label="Manage Members" onPress={onManageMembers} />
                        <View style={[styles.separator, { backgroundColor: colors.border }]} />
                        <ActionItem icon="trash-outline" label="Delete Project" onPress={onDelete} destructive />
                    </>
                )}
            </View>

            <PressableScale
                haptic="selection"
                style={[styles.cancelBtn, { backgroundColor: colors.surfaceHighlight }]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
            >
                <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </PressableScale>
        </Sheet>
    );
}

const styles = StyleSheet.create({
    header: {
        padding: SPACING.lg,
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    projectName: {
        fontSize: 16,
        fontFamily: FONTS.bold,
    },
    actionsList: {
        paddingVertical: SPACING.sm,
    },
    actionItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        marginRight: SPACING.md,
    },
    actionLabel: {
        fontSize: 15,
        fontFamily: FONTS.medium,
    },
    cancelBtn: {
        margin: SPACING.lg,
        height: 48,
        borderRadius: BORDER_RADIUS.md,
        justifyContent: "center",
        alignItems: "center",
    },
    cancelText: {
        fontSize: 15,
        fontFamily: FONTS.semibold,
    },
    separator: {
        height: 1,
        marginVertical: SPACING.xs,
        marginHorizontal: SPACING.lg,
    },
});
