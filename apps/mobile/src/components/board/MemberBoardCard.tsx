import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from 'expo-blur';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";

import { toggleBoardItemStatus, deleteBoardItem } from "../../services/api";
import AnimatedCheckbox from "../AnimatedCheckbox";

type BoardItem = any;
type Member = any;

interface MemberBoardCardProps {
    member: Member;
    currentMemberId?: string | null;
    isOwner: boolean;
    workspaceId: string;
    onAddNote: (memberId: string, memberSurname: string) => void;
    onRefresh: () => void;
}

export default function MemberBoardCard({ member, currentMemberId, isOwner, workspaceId, onAddNote, onRefresh }: MemberBoardCardProps) {
    const { colors, isDark } = useTheme();
    const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

    const handleToggle = async (itemId: string, currentStatus: string) => {
        setLoadingStates(prev => ({ ...prev, [itemId]: true }));
        try {
            const newStatus = currentStatus === "DONE" ? "NOT_DONE" : "DONE";
            await toggleBoardItemStatus(workspaceId, itemId, newStatus);
            onRefresh();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update status");
        } finally {
            setLoadingStates(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const handleDelete = async (itemId: string) => {
        Alert.alert(
            "Delete Note",
            "Are you sure you want to delete this note?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteBoardItem(workspaceId, itemId);
                            onRefresh();
                        } catch (error: any) {
                            Alert.alert("Error", error.message || "Failed to delete note");
                        }
                    }
                }
            ]
        );
    };

    const isSelf = member.id === currentMemberId;
    const canAddNote = isOwner || isSelf;

    const CardContainer = Platform.OS === 'ios' ? BlurView : View;

    return (
        <View style={[styles.cardWrapper, { borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
            <CardContainer
                intensity={isDark ? 30 : 50}
                tint={isDark ? "dark" : "light"}
                style={[
                    styles.card,
                    { backgroundColor: isDark ? "rgba(30, 30, 30, 0.4)" : "rgba(255, 255, 255, 0.6)" }
                ]}
            >
                <View style={styles.header}>
                    <View style={styles.userInfo}>
                        <View style={[styles.avatar, { borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", backgroundColor: colors.primary + "15" }]}>
                            <Text style={[styles.avatarInitials, { color: colors.primary }]}>
                                {member.user?.surname?.[0]?.toUpperCase() || "U"}
                            </Text>
                        </View>
                        <View>
                            <Text style={[styles.userName, { color: colors.text }]}>
                                {member.user?.surname || member.user?.name || "Unknown"}
                            </Text>
                            <Text style={[styles.userRole, { color: colors.textDim }]}>
                                {(member.workspaceRole ?? "MEMBER").replace("_", " ").toLowerCase()}
                            </Text>
                        </View>
                    </View>

                    {canAddNote && (
                        <TouchableOpacity
                            style={[styles.addBtn, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "20" }]}
                            onPress={() => onAddNote(member.id, member.user?.surname || member.user?.name || "")}
                        >
                            <Ionicons name="add" size={14} color={colors.primary} />
                            <Text style={[styles.addBtnText, { color: colors.primary }]}>Note</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.content}>
                    {(!member.boardItems || member.boardItems.length === 0) ? (
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyCircle, { borderColor: colors.border + "30" }]} />
                            <Text style={[styles.emptyText, { color: colors.textDim }]}>No notes assigned yet</Text>
                        </View>
                    ) : (
                        <View style={styles.list}>
                            {member.boardItems.map((item: BoardItem) => {
                                const isDone = item.status === "DONE";
                                const assignerName = item.assignedById === member.id ? "Self" : item.assignedBy?.user?.surname || item.assignedBy?.user?.name || "Unknown";

                                const assignerRole = item.assignedBy?.workspaceRole;
                                const isAdminNote = assignerRole === "OWNER" || assignerRole === "ADMIN";

                                const canDelete = isOwner || (!isAdminNote && (item.assignedById === currentMemberId || isSelf));

                                return (
                                    <View
                                        key={item.id}
                                        style={[
                                            styles.itemRow,
                                            {
                                                backgroundColor: isDone ? "transparent" : (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                                                borderColor: isDone ? "transparent" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"),
                                                opacity: isDone ? 0.5 : 1
                                            }
                                        ]}
                                    >
                                        <AnimatedCheckbox
                                            checked={isDone}
                                            onToggle={() => handleToggle(item.id, item.status)}
                                            disabled={loadingStates[item.id]}
                                            style={styles.checkboxContainer}
                                            color={colors.primary}
                                            doneColor={colors.textDim}
                                            accessibilityLabel={isDone ? "Mark as not done" : "Mark as done"}
                                        />
                                        <View style={styles.itemTextContainer}>
                                            <Text style={[
                                                styles.itemNote,
                                                { color: isDone ? colors.textDim : colors.text },
                                                isDone && { textDecorationLine: "line-through" }
                                            ]}>
                                                {item.note}
                                            </Text>
                                            <View style={styles.itemFooterRow}>
                                                <Text style={[styles.itemAssigner, { color: colors.textDim }]}>
                                                    By {assignerName}
                                                </Text>

                                                {canDelete && (
                                                    <TouchableOpacity
                                                        style={styles.deleteBtn}
                                                        onPress={() => handleDelete(item.id)}
                                                    >
                                                        <Ionicons name="trash-outline" size={14} color={isDark ? "rgba(239, 68, 68, 0.7)" : "#ef4444"} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </CardContainer>
        </View>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        marginBottom: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 0.5,
        overflow: "hidden",
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            }
        })
    },
    card: {
        padding: 0,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    userInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 0.5,
        alignItems: "center",
        justifyContent: "center",
        marginRight: SPACING.md,
    },
    avatarInitials: {
        fontSize: 14,
        fontWeight: "700",
    },
    userName: {
        fontSize: 15,
        fontWeight: "600",
        letterSpacing: -0.3,
    },
    userRole: {
        fontSize: 11,
        textTransform: "capitalize",
        opacity: 0.7,
    },
    addBtn: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 0.5,
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 4,
    },
    addBtnText: {
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    content: {
        padding: SPACING.md,
        paddingTop: 0,
    },
    emptyState: {
        paddingVertical: SPACING.xl,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: 0.4,
    },
    emptyCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
        borderStyle: "dashed",
    },
    emptyText: {
        fontSize: 11,
        fontStyle: "italic",
    },
    list: {
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },
    itemRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        padding: 12,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 0.5,
    },
    checkboxContainer: {
        width: 24,
        height: 24,
        marginRight: 8,
        justifyContent: "center",
        alignItems: "center"
    },
    itemTextContainer: {
        flex: 1,
    },
    itemNote: {
        fontSize: 13,
        lineHeight: 18,
        letterSpacing: -0.1,
    },
    itemFooterRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 6,
    },
    itemAssigner: {
        fontSize: 10,
        opacity: 0.5,
    },
    deleteBtn: {
        padding: 4,
        margin: -4,
    },
});
