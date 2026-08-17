import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, TOUCH_TARGET, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { Task } from "../types";
import { formatGanttDateRange, calculateDuration } from "../utils/ganttUtils";
import { getStatusHex } from "../utils/taskColors";
import StatusChip, { StatusKind } from "./StatusChip";

const STATUS_LABELS: Record<string, string> = {
    TO_DO: "To Do",
    IN_PROGRESS: "In Progress",
    REVIEW: "Review",
    HOLD: "Hold",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
};
const STATUS_KINDS: Record<string, StatusKind> = {
    TO_DO: "todo",
    IN_PROGRESS: "inProgress",
    REVIEW: "review",
    HOLD: "hold",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
};

interface GanttTaskRowProps {
    task: Task;
    isExpanded?: boolean;
    onToggle?: () => void;
    hasSubtasks?: boolean;
    indentLevel?: number;
    parentTask?: Task;
    subtasksCount?: number;
    onPress: () => void;
}

export default function GanttTaskRow({
    task,
    isExpanded = false,
    onToggle,
    hasSubtasks = false,
    indentLevel = 0,
    parentTask,
    subtasksCount,
    onPress
}: GanttTaskRowProps) {
    const { colors, isDark } = useTheme();
    const [isDetailExpanded, setIsDetailExpanded] = useState(false);

    const dateStr = formatGanttDateRange(task.startDate, task.dueDate);
    const duration = calculateDuration(task.startDate, task.dueDate);

    // Dynamic styles based on indentation and status
    const paddingLeft = SPACING.md + (indentLevel * 24);
    const isSubtask = indentLevel > 0;

    const getStatusColor = () => getStatusHex(task.status);

    const handleRowPress = () => {
        if (hasSubtasks) {
            onToggle?.();
        } else {
            setIsDetailExpanded(!isDetailExpanded);
        }
    };

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: isDark ? "#141414" : (isSubtask ? "#fcfcfc" : colors.surface),
                borderBottomColor: colors.border
            }
        ]}>
            <View style={[styles.content, { paddingLeft }]}>
                {/* Expander Arrow - ONLY for Tree Expansion */}
                <View style={styles.expanderContainer}>
                    {hasSubtasks ? (
                        <TouchableOpacity
                            onPress={onToggle}
                            style={styles.expander}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
                            accessibilityState={{ expanded: isExpanded }}
                        >
                            <Ionicons
                                name={isExpanded ? "chevron-down" : "chevron-forward"}
                                size={18}
                                color={getStatusColor()}
                            />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.expanderPlaceholder}>
                            {isSubtask && (
                                <View style={[styles.treeLine, { borderLeftColor: colors.border }]} />
                            )}
                        </View>
                    )}
                </View>

                {/* Task Details - Accordion Pattern */}
                <TouchableOpacity style={styles.taskInfo} onPress={handleRowPress} activeOpacity={0.7}>
                    <View style={styles.headerArea}>
                        <View style={styles.nameSection}>
                            {isSubtask && (
                                <View style={[styles.treeVerticalLine, { borderLeftColor: colors.border + "60" }]} />
                            )}
                            {isSubtask && parentTask && (
                                <Text style={[styles.breadcrumbText, { color: colors.textDim }]} numberOfLines={1}>
                                    {parentTask.name} /
                                </Text>
                            )}
                            <View style={styles.nameWithIcon}>
                                {isSubtask && (
                                    <Ionicons 
                                        name="return-down-forward-outline" 
                                        size={14} 
                                        color={colors.textDim} 
                                        style={{ marginRight: 6 }} 
                                    />
                                )}
                                <Text
                                    style={[
                                        styles.taskName,
                                        { color: colors.text, fontFamily: isSubtask ? FONTS.medium : FONTS.bold }
                                    ]}
                                    numberOfLines={1}
                                >
                                    {task.name}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setIsDetailExpanded(!isDetailExpanded)}
                                    style={styles.detailToggle}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    accessibilityRole="button"
                                    accessibilityLabel={isDetailExpanded ? "Hide task details" : "Show task details"}
                                    accessibilityState={{ expanded: isDetailExpanded }}
                                >
                                    <Ionicons
                                        name={isDetailExpanded ? "chevron-up" : "chevron-down"}
                                        size={14}
                                        color={colors.primary}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {!isSubtask && subtasksCount !== undefined && subtasksCount > 0 && (
                            <View style={[styles.countBadge, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                                <Text style={[styles.countText, { color: colors.textDim }]}>{subtasksCount}</Text>
                            </View>
                        )}

                        {isSubtask && !isDetailExpanded && (
                            <StatusChip
                                label={STATUS_LABELS[task.status ?? "TO_DO"] ?? task.status ?? "To Do"}
                                kind={STATUS_KINDS[task.status ?? "TO_DO"] ?? "todo"}
                                size="sm"
                            />
                        )}
                    </View>

                    {/* Detailed Data - Visible on Dropdown Expansion */}
                    {isDetailExpanded && (
                        <View style={styles.expandedContent}>
                            <View style={styles.detailsGrid}>
                                {/* Status */}
                                <View style={[styles.col, { flex: 1.2 }]}>
                                    <StatusChip
                                        label={STATUS_LABELS[task.status ?? "TO_DO"] ?? task.status ?? "To Do"}
                                        kind={STATUS_KINDS[task.status ?? "TO_DO"] ?? "todo"}
                                        size="sm"
                                    />
                                </View>

                                {/* Assignee */}
                                <View style={[styles.col, { flex: 0.8 }]}>
                                    <Text style={[styles.colLabel, { color: colors.textDim }]}>BY</Text>
                                    {task.assignee ? (
                                        <View style={styles.assigneeLine}>
                                            <View style={[styles.avatarFixed, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                                                <Text style={[styles.avatarText, { color: colors.textDim }]}>
                                                    {task.assignee.name.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text style={[styles.colValue, { color: colors.text, fontSize: 10, flex: 1 }]} numberOfLines={1}>
                                                {task.assignee.name}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text style={[styles.colValue, { color: colors.textDim + "60", fontSize: 10 }]}>Unassigned</Text>
                                    )}
                                </View>

                                {/* Days */}
                                <View style={[styles.col, { flex: 0.6 }]}>
                                    <Text style={[styles.colLabel, { color: colors.textDim }]}>DAYS</Text>
                                    <Text style={[styles.colValue, { color: colors.text }]}>{duration || "-"}</Text>
                                </View>

                                {/* Dates */}
                                <View style={[styles.col, { flex: 1.5 }]}>
                                    <Text style={[styles.colLabel, { color: colors.textDim }]}>TIMELINE</Text>
                                    <Text style={[styles.colValue, { color: colors.text }]} numberOfLines={1}>{dateStr}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.detailButton, { backgroundColor: colors.surfaceHighlight }]}
                                onPress={onPress}
                            >
                                <Text style={[styles.detailButtonText, { color: colors.primary }]}>View Full Details</Text>
                                <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderBottomWidth: 1,
    },
    content: {
        flexDirection: "row",
        paddingRight: SPACING.md,
        paddingVertical: 12,
        alignItems: "flex-start",
    },
    expanderContainer: {
        width: 24,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
        paddingTop: 2,
    },
    expander: {
        width: 24,
        height: 24,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
    },
    expanderPlaceholder: {
        width: 24,
        height: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    treeLine: {
        height: 30,
        borderLeftWidth: 2,
        position: 'absolute',
        top: -12,
        left: 11,
    },
    treeVerticalLine: {
        position: 'absolute',
        left: -20,
        top: -30,
        bottom: 12,
        borderLeftWidth: 1.5,
    },
    detailToggle: {
        marginLeft: 8,
        padding: 4,
    },
    taskInfo: {
        flex: 1,
    },
    taskHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 4,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    taskName: {
        fontSize: 15,
        fontFamily: FONTS.bold,
        letterSpacing: 0.1,
    },
    headerArea: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    nameSection: {
        flex: 1,
    },
    nameWithIcon: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    miniStatus: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginLeft: 8,
    },
    expandedContent: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    assigneeLine: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 6,
    },
    avatarFixed: {
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
    },
    detailButton: {
        marginTop: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    detailButtonText: {
        fontSize: 12,
        fontFamily: FONTS.bold,
    },
    parentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    countBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        minWidth: 24,
        alignItems: 'center',
    },
    countText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    nameContainer: {
        flex: 1,
    },
    columnItem: {
        marginLeft: 8,
    },
    breadcrumbText: {
        fontSize: 10,
        fontFamily: FONTS.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    statusBadgeText: {
        fontSize: 9,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
    },
    avatarText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
    },
    detailsGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    col: {
        justifyContent: 'center',
    },
    colLabel: {
        fontSize: 8,
        fontFamily: FONTS.bold,
        opacity: 0.6,
        marginBottom: 2,
    },
    colValue: {
        fontSize: 11,
        fontFamily: FONTS.semibold,
    },
});
