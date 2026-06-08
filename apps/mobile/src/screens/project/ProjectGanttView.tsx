import React, { useState, useMemo, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format, isToday, startOfDay } from "date-fns";
import { SPACING } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { Task } from "../../types";
import { getStatusHex, getStatusBgColor, STATUS_COLORS } from "../../utils/taskColors";
import {
    calculateTimelineRange,
    getDaysBetween,
    calculateBarPosition,
    computeTaskDates,
} from "../../utils/mobileGanttUtils";
import { useWorkspace } from "../../context/WorkspaceContext";
import { getSubTasks } from "../../services/api";
import MobileGanttBar from "../../components/gantt/MobileGanttBar";

// ─── Layout constants ─────────────────────────────────────────────────────────
const ROW_H = 52;
const NAME_W = 180;
const ASSIGNEE_W = 100;
const DAYS_W = 60;
const DATES_W = 130;
const TOTAL_TABLE_W = NAME_W + ASSIGNEE_W + DAYS_W + DATES_W;
const HEADER_H = 44;


// ─── Status colours map ───────────────────────────────────────────────────────
// STATUS_LABEL is replaced by taskColors utility

// ─── Types ────────────────────────────────────────────────────────────────────
interface FlatItem {
    task: Task;
    indentLevel: number;
    hasSubtasks: boolean;
    isExpanded: boolean;
}

interface MonthGroup { label: string; days: number }

// ─── Month-label helper ───────────────────────────────────────────────────────
function buildMonthGroups(start: Date, totalDays: number): MonthGroup[] {
    const groups: MonthGroup[] = [];
    let cur = new Date(start);
    for (let d = 0; d < totalDays;) {
        const label = format(cur, "MMM yyyy");
        const endOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
        const daysLeft = Math.floor((endOfMonth.getTime() - cur.getTime()) / 86400000) + 1;
        const count = Math.min(daysLeft, totalDays - d);
        groups.push({ label, days: count });
        d += count;
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return groups;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ProjectGanttViewProps {
    projectId: string;
    tasks: Task[];
    loading: boolean;
    refreshData: () => void;
    navigation: any;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ProjectGanttView({
    projectId,
    tasks,
    loading,
    refreshData,
    navigation,
}: ProjectGanttViewProps) {
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [lazySubtasks, setLazySubtasks] = useState<Map<string, Task[]>>(new Map());
    const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());

    const allRelevantTasks = useMemo(() => {
        const itemIds = new Set(tasks.map(t => t.id));
        const out = [...tasks];
        lazySubtasks.forEach(list => list.forEach(t => {
            if (!itemIds.has(t.id)) {
                out.push(t);
                itemIds.add(t.id);
            }
        }));
        return out;
    }, [tasks, lazySubtasks]);

    // ── 2. Hierarchy flattening ─────────────────────────────────────────────
    const { roots, childMap } = useMemo(() => {
        const cm = new Map<string, Task[]>();
        const itemIds = new Set(allRelevantTasks.map(t => t.id));

        allRelevantTasks.forEach(t => {
            if (t.parentTaskId) {
                const list = cm.get(t.parentTaskId) ?? [];
                if (!list.find(existing => existing.id === t.id)) {
                    list.push(t);
                }
                cm.set(t.parentTaskId, list);
            }
        });

        // Sort all child lists by position
        cm.forEach((list, key) => {
            cm.set(key, list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
        });

        const rs = allRelevantTasks
            .filter(t => !t.parentTaskId || !itemIds.has(t.parentTaskId))
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        return { roots: rs, childMap: cm };
    }, [allRelevantTasks]);


    const flatItems = useMemo<FlatItem[]>(() => {
        const out: FlatItem[] = [];

        const walk = (task: Task, depth: number) => {
            const children = childMap.get(task.id) ?? [];
            const hasSubtasks = children.length > 0 || (task._count?.subTasks ?? 0) > 0;
            const expanded = expandedNodes.has(task.id);

            out.push({
                task,
                indentLevel: depth,
                hasSubtasks,
                isExpanded: expanded
            });

            if (expanded) {
                children.forEach(c => walk(c, depth + 1));
            }
        };

        roots.forEach(r => walk(r, 0));
        return out;
    }, [roots, childMap, expandedNodes]);

    const toggleExpand = useCallback(async (id: string, task: Task) => {
        const isExpanding = !expandedNodes.has(id);

        if (isExpanding) {
            const children = childMap.get(id) ?? [];
            const hasSubCount = (task._count?.subTasks ?? 0) > 0;

            // If no children in map but count > 0, fetch them
            if (children.length === 0 && hasSubCount && activeWorkspace) {
                setFetchingIds(prev => new Set(prev).add(id));
                try {
                    const data = await getSubTasks(id, activeWorkspace.id, projectId);
                    setLazySubtasks(prev => {
                        const next = new Map(prev);
                        next.set(id, data);
                        return next;
                    });
                } catch (e) {
                    console.error("[Gantt] Error fetching subtasks:", e);
                } finally {
                    setFetchingIds(prev => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                }
            }
        }

        setExpandedNodes(prev => {
            const next = new Set(prev);
            isExpanding ? next.add(id) : next.delete(id);
            return next;
        });
    }, [expandedNodes, childMap, activeWorkspace, projectId]);


    // ── 4. Formatting Helpers ───────────────────────────────────────────────
    const formatTaskDates = useCallback((task: Task) => {
        const dates = computeTaskDates(task, allRelevantTasks);
        if (!dates.start || !dates.end) return "-";
        return `${format(dates.start, "dd/MM/yy")} - ${format(dates.end, "dd/MM/yy")}`;
    }, [allRelevantTasks]);

    const getDuration = useCallback((task: Task) => {
        const dates = computeTaskDates(task, allRelevantTasks);
        if (!dates.start || !dates.end) return "-";
        return getDaysBetween(dates.start, dates.end) + 1;
    }, [allRelevantTasks]);


    // ── 6. Render helpers ───────────────────────────────────────────────────
    const renderRow = (item: FlatItem) => {
        const { task, indentLevel, hasSubtasks, isExpanded } = item;
        const isSubtask = indentLevel > 0;
        const sColor = getStatusHex(task.status);
        const sBg = getStatusBgColor(task.status);
        const datesText = formatTaskDates(task);
        const duration = getDuration(task);
        const assigneeName = task.assignee?.surname || task.assignee?.name || "-";

        return (
            <View
                key={task.id}
                style={[
                    s.row,
                    {
                        height: ROW_H,
                        width: TOTAL_TABLE_W,
                        backgroundColor: isDark
                            ? isSubtask ? "#181818" : "#111"
                            : isSubtask ? "#f9f9f9" : colors.surface,
                        borderBottomColor: colors.border + "33",
                    }
                ]}
            >
                {/* 1. TASK NAME */}
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                        hasSubtasks
                            ? toggleExpand(task.id, task)
                            : navigation.navigate("TaskDetail", { taskId: task.id, taskName: task.name })
                    }
                    style={[
                        s.cell,
                        {
                            width: NAME_W,
                            paddingLeft: 12 + indentLevel * 14,
                        }
                    ]}
                >
                    {/* Subtask arrow (only for nested levels) */}
                    {isSubtask && (
                        <Ionicons name="return-down-forward-outline" size={11} color={colors.textDim} style={{ marginRight: 4 }} />
                    )}

                    {/* Expand icon */}
                    {hasSubtasks && (
                        fetchingIds.has(task.id) ? (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4, transform: [{ scale: 0.7 }] }} />
                        ) : (
                            <Ionicons
                                name={isExpanded ? "chevron-down" : "chevron-forward"}
                                size={14}
                                color={colors.primary}
                                style={{ marginRight: 4 }}
                            />
                        )
                    )}

                    <Text
                        numberOfLines={1}
                        style={[
                            s.cellText,
                            {
                                color: colors.text,
                                fontWeight: isSubtask ? "500" : "700",
                                fontSize: isSubtask ? 11 : 12,
                            }
                        ]}
                    >
                        {task.name}{!isSubtask && task.project?.name ? ` / ${task.project.name}` : ""}
                    </Text>
                </TouchableOpacity>

                {/* 2. ASSIGNEE */}
                <View style={[s.cell, { width: ASSIGNEE_W, justifyContent: "center" }]}>
                    <Text numberOfLines={1} style={[s.cellText, { color: colors.textDim, fontSize: 11 }]}>
                        {assigneeName}
                    </Text>
                </View>


                {/* 4. DAYS */}
                <View style={[s.cell, { width: DAYS_W, justifyContent: "center" }]}>
                    {isSubtask && (
                        <Text style={[s.cellText, { color: colors.textDim, fontSize: 11 }]}>
                            {duration}
                        </Text>
                    )}
                </View>

                {/* 5. DATES */}
                <View style={[s.cell, { width: DATES_W, justifyContent: "center" }]}>
                    {isSubtask && (
                        <Text numberOfLines={1} style={[s.cellText, { color: colors.textDim, fontSize: 11 }]}>
                            {datesText}
                        </Text>
                    )}
                </View>
            </View>
        );
    };


    // ── 7. Early-return states ──────────────────────────────────────────────
    if (loading && tasks.length === 0) {
        return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
    }

    if (!loading && tasks.length === 0) {
        return (
            <View style={[s.center, { padding: 32 }]}>
                <Ionicons name="calendar-outline" size={52} color={colors.textDim} />
                <Text style={[s.emptyTitle, { color: colors.text }]}>No Tasks Yet</Text>
                <Text style={[s.emptySub, { color: colors.textDim }]}>
                    Create tasks with start and due dates to see them on the Gantt chart.
                </Text>
            </View>
        );
    }

    // ── 7. Main render ──────────────────────────────────────────────────────
    return (
        <View style={[s.root, { backgroundColor: isDark ? "#0a0a0a" : colors.background }]}>



            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled={true}
                overScrollMode="never"
            >
                <View style={{ width: TOTAL_TABLE_W }}>
                    {/* Header */}
                    <View style={[s.headerRow, { height: HEADER_H, borderBottomColor: colors.border, backgroundColor: isDark ? "#111" : colors.surface }]}>
                        <View style={[s.cell, { width: NAME_W, paddingLeft: 12 }]}>
                            <Text style={[s.headerText, { color: colors.primary }]}>TASK NAME</Text>
                        </View>
                        <View style={[s.cell, { width: ASSIGNEE_W, justifyContent: "center" }]}>
                            <Text style={[s.headerText, { color: colors.textDim }]}>ASSIGNEE</Text>
                        </View>
                        <View style={[s.cell, { width: DAYS_W, justifyContent: "center" }]}>
                            <Text style={[s.headerText, { color: colors.textDim }]}>DAYS</Text>
                        </View>
                        <View style={[s.cell, { width: DATES_W, justifyContent: "center" }]}>
                            <Text style={[s.headerText, { color: colors.textDim }]}>DATES</Text>
                        </View>
                    </View>

                    {/* Body */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: SPACING.bottomTabBar }}
                        refreshControl={
                            <RefreshControl refreshing={false} onRefresh={refreshData} tintColor={colors.primary} />
                        }
                    >
                        {flatItems.map(renderRow)}
                    </ScrollView>
                </View>
            </ScrollView>

        </View>
    );
}


// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    // Header logic
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
    },
    headerText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },

    // Row logic
    row: {
        flexDirection: "row",
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    cell: {
        flexDirection: "row",
        alignItems: "center",
        height: "100%",
    },
    cellText: { fontSize: 12, lineHeight: 16 },

    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6, flexShrink: 0 },

    statusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    statusText: {
        fontSize: 8,
        fontWeight: "800",
        letterSpacing: 0.2,
    },

    // Empty state
    emptyTitle: { fontSize: 17, fontWeight: "700", marginTop: 16, textAlign: "center" },
    emptySub: { fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 20 },

    // Legend
    legend: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 3 },
    legendLabel: { fontSize: 9, fontWeight: "600" },
});

