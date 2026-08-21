import React, { useState, useMemo, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format, startOfDay } from "date-fns";
import { SPACING, TOUCH_TARGET, FONTS } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { haptics } from "../../services/haptics";
import { Task } from "../../types";
import StatusChip, { StatusKind } from "../../components/StatusChip";
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
const STATUS_W = 92;
const ASSIGNEE_W = 100;
const DAYS_W = 60;
const DATES_W = 130;
const TOTAL_TABLE_W = NAME_W;
const HEADER_H = 44;
// Width, in px, of a single day column in the timeline pane.
const DAY_W = 34;

// ─── Status label/kind maps (semantic, theme-driven via StatusChip) ──────────
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface FlatItem {
    id: string;
    type: "project" | "task";
    name: string;
    indentLevel: number;
    hasSubtasks: boolean;
    isExpanded: boolean;
    task?: Task;
    projectColor?: string;
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

    // Group tasks by project (if projectId is empty)
    const { projectsList, projectParentTasksMap } = useMemo(() => {
        const pm = new Map<string, Task[]>();
        const uniqueProjs = new Map<string, { id: string, name: string, color?: string }>();

        allRelevantTasks.forEach(t => {
            const projId = t.projectId || "no-project";
            const projName = t.project?.name || "No Project";
            const projColor = t.project?.color;

            if (!uniqueProjs.has(projId)) {
                uniqueProjs.set(projId, { id: projId, name: projName, color: projColor });
            }

            const itemIds = new Set(allRelevantTasks.map(x => x.id));
            if (!t.parentTaskId || !itemIds.has(t.parentTaskId)) {
                const list = pm.get(projId) ?? [];
                if (!list.find(existing => existing.id === t.id)) {
                    list.push(t);
                }
                pm.set(projId, list);
            }
        });

        // Sort projects alphabetically
        const list = Array.from(uniqueProjs.values()).sort((a, b) => a.name.localeCompare(b.name));
        return { projectsList: list, projectParentTasksMap: pm };
    }, [allRelevantTasks]);

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

        const walkTask = (task: Task, depth: number) => {
            const children = childMap.get(task.id) ?? [];
            const hasSubtasks = children.length > 0 || (task._count?.subTasks ?? 0) > 0 || task.isParent;
            const expanded = expandedNodes.has(task.id);

            out.push({
                id: task.id,
                type: "task",
                name: task.name,
                indentLevel: depth,
                hasSubtasks,
                isExpanded: expanded,
                task,
            });

            if (expanded) {
                children.forEach(c => walkTask(c, depth + 1));
            }
        };

        if (!projectId) {
            // Group by Project
            projectsList.forEach(proj => {
                const projNodeId = `project-${proj.id}`;
                const parentTasks = projectParentTasksMap.get(proj.id) ?? [];
                const hasSubtasks = parentTasks.length > 0;
                const expanded = expandedNodes.has(projNodeId);

                out.push({
                    id: projNodeId,
                    type: "project",
                    name: proj.name,
                    indentLevel: 0,
                    hasSubtasks,
                    isExpanded: expanded,
                    projectColor: proj.color,
                });

                if (expanded) {
                    parentTasks.forEach(pt => walkTask(pt, 1));
                }
            });
        } else {
            // Standard single project hierarchy
            roots.forEach(r => walkTask(r, 0));
        }

        return out;
    }, [projectId, projectsList, projectParentTasksMap, roots, childMap, expandedNodes]);

    const toggleExpand = useCallback(async (id: string, task?: Task) => {
        const isExpanding = !expandedNodes.has(id);

        if (id.startsWith("project-")) {
            setExpandedNodes(prev => {
                const next = new Set(prev);
                isExpanding ? next.add(id) : next.delete(id);
                return next;
            });
            return;
        }

        if (task && isExpanding) {
            const children = childMap.get(id) ?? [];
            const hasSubCount = (task._count?.subTasks ?? 0) > 0 || task.isParent;

            // If no children in map but count > 0, fetch them
            if (children.length === 0 && hasSubCount && activeWorkspace) {
                setFetchingIds(prev => new Set(prev).add(id));
                try {
                    const data = await getSubTasks(id, activeWorkspace.id, task.projectId || projectId);
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

    // ── 5. Timeline geometry (today marker + bar positions) ─────────────────
    const timelineRange = useMemo(() => calculateTimelineRange(allRelevantTasks), [allRelevantTasks]);
    const totalDays = useMemo(
        () => Math.max(1, getDaysBetween(timelineRange.start, timelineRange.end) + 1),
        [timelineRange]
    );
    const timelineWidth = totalDays * DAY_W;
    const monthGroups = useMemo(
        () => buildMonthGroups(timelineRange.start, totalDays),
        [timelineRange, totalDays]
    );
    const todayOffset = useMemo(() => {
        const today = startOfDay(new Date());
        if (today < timelineRange.start || today > timelineRange.end) return null;
        return getDaysBetween(timelineRange.start, today) * DAY_W;
    }, [timelineRange]);


    // ── 6. Render helpers ───────────────────────────────────────────────────
    const renderRow = (item: FlatItem) => {
        const { task, indentLevel, hasSubtasks, isExpanded } = item;
        const isProject = item.type === "project";
        const isSubtask = indentLevel > 0;

        const status = task?.status ?? "TO_DO";
        const statusLabel = STATUS_LABELS[status] ?? status;
        const statusKind = STATUS_KINDS[status] ?? "todo";
        const datesText = task ? formatTaskDates(task) : "-";
        const duration = task ? getDuration(task) : "-";
        const assigneeName = task?.assignee?.surname || task?.assignee?.name || "-";

        const dates = task ? computeTaskDates(task, allRelevantTasks) : { start: null, end: null };
        const barPos = (!isProject && task && dates.start && dates.end)
            ? calculateBarPosition(dates.start, dates.end, timelineRange.start, totalDays)
            : null;

        const showDetails = !isProject && !hasSubtasks && (!task || !task.isParent);

        return (
            <View
                key={item.id}
                style={[
                    s.row,
                    {
                        height: ROW_H,
                        width: TOTAL_TABLE_W + timelineWidth,
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
                            ? toggleExpand(item.id, task)
                            : (!isProject && task ? navigation.navigate("TaskDetail", { taskId: task.id, taskName: task.name }) : null)
                    }
                    style={[
                        s.cell,
                        {
                            width: NAME_W,
                            paddingLeft: 12 + indentLevel * 14,
                        }
                    ]}
                >
                    {/* Expand icon */}
                    {hasSubtasks && (
                        (!isProject && task && fetchingIds.has(task.id)) ? (
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

                    {/* Project color bullet for project nodes */}
                    {isProject && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.projectColor || colors.primary, marginRight: 6 }} />
                    )}

                    {/* Subtask arrow (only for nested subtask levels) */}
                    {!isProject && isSubtask && indentLevel > 1 && (
                        <Ionicons name="return-down-forward-outline" size={11} color={colors.textDim} style={{ marginRight: 4 }} />
                    )}

                    <Text
                        numberOfLines={1}
                        style={[
                            s.cellText,
                            {
                                color: colors.text,
                                fontFamily: isProject ? FONTS.bold : (isSubtask ? FONTS.medium : FONTS.bold),
                                fontSize: isProject ? 13 : (isSubtask ? 11 : 12),
                                flex: 1,
                            }
                        ]}
                    >
                        {item.name}
                    </Text>
                </TouchableOpacity>

                {/* 6. TIMELINE (bar + today marker share the same horizontal scroll) */}
                <View style={{ width: timelineWidth, height: ROW_H, position: "relative" }}>
                    {barPos && task && (
                        <MobileGanttBar
                            task={task}
                            leftPercent={barPos.left}
                            widthPercent={barPos.width}
                            totalWidth={timelineWidth}
                            isSubtask={isSubtask}
                            onPress={() => navigation.navigate("TaskDetail", { taskId: task.id, taskName: task.name })}
                        />
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
                <View style={{ width: TOTAL_TABLE_W + timelineWidth }}>
                    {/* Header */}
                    <View style={[s.headerRow, { height: HEADER_H, borderBottomColor: colors.border, backgroundColor: isDark ? "#111" : colors.surface }]}>
                        <View style={[s.cell, { width: NAME_W, paddingLeft: 12 }]}>
                            <Text style={[s.headerText, { color: colors.primary }]}>TASK NAME</Text>
                        </View>

                        {/* Timeline header: month ruler + "Today" marker */}
                        <View style={{ width: timelineWidth, height: "100%", position: "relative" }}>
                            <View style={{ flexDirection: "row", height: "100%" }}>
                                {monthGroups.map((group, i) => (
                                    <View
                                        key={`${group.label}-${i}`}
                                        style={[
                                            s.monthCell,
                                            { width: group.days * DAY_W, borderLeftColor: colors.border + "55" }
                                        ]}
                                    >
                                        <Text numberOfLines={1} style={[s.headerText, { color: colors.textDim }]}>
                                            {group.label}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                            {todayOffset !== null && (
                                <View pointerEvents="none" style={[s.todayBadgeWrap, { left: todayOffset }]}>
                                    <View style={[s.todayBadge, { backgroundColor: colors.primary }]}>
                                        <Text style={s.todayBadgeText}>Today</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Body */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: SPACING.bottomTabBar }}
                        refreshControl={
                            <RefreshControl refreshing={false} onRefresh={() => { haptics.light(); refreshData(); }} tintColor={colors.primary} />
                        }
                    >
                        <View style={{ position: "relative" }}>
                            {/* "Today" vertical line — spans every row so it's unmistakable in both themes */}
                            {todayOffset !== null && (
                                <View
                                    pointerEvents="none"
                                    style={[
                                        s.todayLine,
                                        { left: TOTAL_TABLE_W + todayOffset, backgroundColor: colors.primary }
                                    ]}
                                />
                            )}
                            {flatItems.map(renderRow)}
                        </View>
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
    headerText: { fontSize: 9, fontFamily: FONTS.extrabold, letterSpacing: 1.2 },

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

    // Timeline header (month ruler)
    monthCell: {
        justifyContent: "center",
        paddingLeft: 8,
        borderLeftWidth: StyleSheet.hairlineWidth,
    },

    // "Today" marker — line spans the full body height; badge sits in the header.
    todayLine: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 2,
        zIndex: 5,
    },
    todayBadgeWrap: {
        position: "absolute",
        top: 2,
        alignItems: "center",
        transform: [{ translateX: -18 }],
    },
    todayBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    todayBadgeText: {
        color: "#fff",
        fontSize: 8,
        fontFamily: FONTS.extrabold,
        letterSpacing: 0.3,
    },

    // Empty state
    emptyTitle: { fontSize: 17, fontFamily: FONTS.bold, marginTop: 16, textAlign: "center" },
    emptySub: { fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 20 },
});

