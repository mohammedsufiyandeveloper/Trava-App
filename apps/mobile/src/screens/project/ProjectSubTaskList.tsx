import React, { useState, useMemo, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ScrollView, Platform, ActivityIndicator, Alert, Modal, TouchableWithoutFeedback, Dimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

const { width: SCREEN_W } = Dimensions.get("window");

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SPACING, BORDER_RADIUS } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { useWorkspace, DEFAULT_FILTERS } from "../../context/WorkspaceContext";
import { RootStackParamList, Task } from "../../types";
import TaskFilterSheet from "../../components/TaskFilterSheet";
import CreateSubTaskModal from "../../components/CreateSubTaskModal";
import { getSubTasks, getTasks, deleteTask } from "../../services/api";
import { getStatusHex, getStatusBgColor } from "../../utils/taskColors";
import { isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";

// View components
import ProjectKanban from "./ProjectKanban";
import ProjectGanttView from "./ProjectGanttView";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectSubTasks">;

export default function ProjectSubTaskList({ route, navigation }: Props) {
    const { parentId, parentName, projectId } = route.params;
    const { activeWorkspace, projectFilters, setProjectFilters, projects, tags, refreshData } = useWorkspace();
    const { colors, isDark } = useTheme();
    const [filterVisible, setFilterVisible] = useState(false);
    const [parentTaskSwitchVisible, setParentTaskSwitchVisible] = useState(false);
    const [parentTasks, setParentTasks] = useState<Task[]>([]);
    const [createSubTaskVisible, setCreateSubTaskVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [viewMode, setViewMode] = useState<"List" | "Kanban" | "Gantt">("List");

    const activeProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);
    const projectColor = activeProject?.color || colors.primary;

    // Direct fetch state
    const [subTasks, setSubTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    const filters = projectFilters[projectId] || DEFAULT_FILTERS;

    const fetchSubTasks = useCallback(async () => {
        if (!activeWorkspace?.id) return;
        setLoading(true);
        try {
            let data: Task[] = [];
            if (parentId === "all") {
                const result = await getTasks(activeWorkspace.id, {
                    projectId: projectId,
                    hierarchyMode: "children",
                    limit: 200,
                });
                data = result.tasks;
            } else {
                data = await getSubTasks(parentId, activeWorkspace.id, projectId);
            }
            console.log(`[ProjectSubTaskList] Fetched ${data.length} actual subtasks for "${parentName}"`);
            setSubTasks(data);
            await refreshData();
        } catch (e) {
            console.error("[ProjectSubTaskList] Error fetching subtasks:", e);
        } finally {
            setLoading(false);
        }
    }, [parentId, activeWorkspace?.id, projectId, parentName]);

    useEffect(() => {
        fetchSubTasks();
    }, [fetchSubTasks]);

    useEffect(() => {
        const fetchParents = async () => {
            if (!activeWorkspace?.id || !projectId) return;
            try {
                const result = await getTasks(activeWorkspace.id, { projectId, hierarchyMode: "all", limit: 200 });
                const onlyParents = result.tasks.filter(t => !t.parentTaskId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                setParentTasks(onlyParents);
            } catch (e) {
                console.error("[ProjectSubTaskList] Error fetching parent tasks:", e);
            }
        };
        fetchParents();
    }, [activeWorkspace?.id, projectId]);

    // Reset filters when leaving
    React.useEffect(() => {
        return () => {
            setProjectFilters(projectId, DEFAULT_FILTERS);
        };
    }, [projectId, setProjectFilters]);

    // Local client-side filtering
    const filteredSubTasks = useMemo(() => {
        let list = [...subTasks];
        if (filters.status.length > 0) {
            list = list.filter(t => filters.status.includes(t.status || ""));
        }
        if (filters.assigneeId.length > 0) {
            list = list.filter(t => t.assignee && filters.assigneeId.includes(t.assignee.id));
        }
        if (filters.tagId.length > 0) {
            list = list.filter(t => t.tagId && filters.tagId.includes(t.tagId));
        }
        if (filters.search) {
            const s = filters.search.toLowerCase();
            list = list.filter(t =>
                t.name.toLowerCase().includes(s) ||
                (t.description?.toLowerCase().includes(s))
            );
        }
        if (filters.dueAfter || filters.dueBefore) {
            list = list.filter(t => {
                if (!t.dueDate) return false;
                const d = parseISO(t.dueDate);
                const start = filters.dueAfter ? startOfDay(parseISO(filters.dueAfter)) : new Date(0);
                const end = filters.dueBefore ? endOfDay(parseISO(filters.dueBefore)) : new Date(8640000000000000);
                return isWithinInterval(d, { start, end });
            });
        }

        // Sorting logic
        if (filters.sorts && filters.sorts.length > 0) {
            const { field, direction } = filters.sorts[0];
            return list.sort((a, b) => {
                if (field === "dueDate") {
                    const da = a.dueDate ? parseISO(a.dueDate).getTime() : Infinity;
                    const db = b.dueDate ? parseISO(b.dueDate).getTime() : Infinity;
                    return direction === "asc" ? da - db : db - da;
                }
                return (a.position ?? 0) - (b.position ?? 0);
            });
        }

        return list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }, [subTasks, filters]);

    const activeFilterCount = Object.values(filters).filter(v => Array.isArray(v) ? v.length > 0 : !!v).length;

    // getStatusColor removed in favor of getStatusHex from taskColors utility

    const getUrgency = (dueDate?: string) => {
        if (!dueDate) return null;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);

        const diffTime = due.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { text: `${Math.abs(diffDays)}d late`, color: "#ef4444", icon: "warning-outline" };
        } else if (diffDays === 0) {
            return { text: "Due today", color: "#f59e0b", icon: "time-outline" };
        } else if (diffDays <= 3) {
            return { text: `${diffDays}d left`, color: "#3b82f6", icon: "hourglass-outline" };
        } else {
            return { text: `${diffDays} days`, color: colors.textDim, icon: "calendar-outline" };
        }
    };

    const handleLongPress = (item: Task) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            item.name,
            "What would you like to do with this deliverable?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Edit",
                    onPress: () => {
                        setEditingTask(item);
                        setCreateSubTaskVisible(true);
                    }
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => confirmDelete(item)
                }
            ]
        );
    };

    const confirmDelete = (item: Task) => {
        Alert.alert(
            "Delete Deliverable",
            `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteTask(item.id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            fetchSubTasks();
                        } catch (error: any) {
                            Alert.alert("Error", error.message || "Failed to delete task");
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: Task }) => {
        const urgency = getUrgency(item.dueDate);

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate("TaskDetail", { taskId: item.id, taskName: item.name })}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={500}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.nameContainer, { maxWidth: "60%" }]}>
                        <Ionicons name="return-down-forward" size={16} color={colors.textDim} style={{ marginRight: 8, marginTop: 4 }} />
                        <Text 
                            style={[styles.taskTitle, { color: colors.text }]} 
                            numberOfLines={1} 
                            ellipsizeMode="tail"
                        >
                            {item.name}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(item.status) }]}>
                        <Text style={[styles.statusText, { color: getStatusHex(item.status) }]}>
                            {item.status.replace("_", " ")}
                        </Text>
                    </View>
                </View>



                {/* Timeline & Members Row */}
                <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
                    <View style={styles.datesContainer}>
                        <View style={styles.dateInfo}>
                            <Text style={[styles.label, { color: colors.textDim }]}>Start</Text>
                            <Text style={[styles.dateText, { color: colors.text }]}>
                                {item.startDate ? new Date(item.startDate).toLocaleDateString([], { month: "short", day: "numeric" }) : "-"}
                            </Text>
                        </View>
                        <View style={styles.dateInfo}>
                            <Text style={[styles.label, { color: colors.textDim }]}>Due</Text>
                            <Text style={[styles.dateText, { color: colors.text, fontWeight: "700" }]}>
                                {item.dueDate ? new Date(item.dueDate).toLocaleDateString([], { month: "short", day: "numeric" }) : "-"}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.flexFiller} />

                    {/* Team Members positioned at bottom right */}
                    <View style={styles.bottomMembers}>
                        <View style={styles.memberGroup}>
                            <Text style={[styles.microLabel, { color: colors.textDim }]}>Assignee</Text>
                            <View style={styles.compactMember}>
                                <View style={[styles.avatar, { backgroundColor: colors.surfaceHighlight }]}>
                                    <Text style={[styles.avatarText, { color: colors.text }]}>{(item.assignee?.surname?.[0] || item.assignee?.name?.[0] || "?").toUpperCase()}</Text>
                                </View>
                                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                                    {(item.assignee?.surname ? item.assignee.surname.split(" ")[0] : item.assignee?.name) || "None"}
                                </Text>
                            </View>
                        </View>

                        {item.reviewer && (
                            <View style={styles.memberGroup}>
                                <Text style={[styles.microLabel, { color: colors.textDim }]}>Reviewer</Text>
                                <View style={styles.compactMember}>
                                    <View style={[styles.avatar, { backgroundColor: colors.surfaceHighlight }]}>
                                        <Text style={[styles.avatarText, { color: colors.text }]}>{(item.reviewer.surname?.[0] || item.reviewer.name[0]).toUpperCase()}</Text>
                                    </View>
                                    <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                                        {item.reviewer.surname ? item.reviewer.surname.split(" ")[0] : item.reviewer.name}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {/* Secondary Info (Tags/Urgency) */}
                <View style={styles.secondaryInfo}>
                    {urgency && (
                        <View style={styles.urgencyRow}>
                            <View style={[styles.urgencyDot, { backgroundColor: urgency.color }]} />
                            <Text style={[styles.urgencyText, { color: urgency.color }]}>{urgency.text}</Text>
                        </View>
                    )}
                    {(() => {
                        const tagObj = item.tag || (Array.isArray(item.tags) && item.tags[0]) || (item as any).Tag || (item as any).taskTag || (Array.isArray((item as any).tags) ? (item as any).tags[0] : null);
                        const tagId = item.tagId || (tagObj && typeof tagObj === 'object' ? tagObj.id : null);

                        const tagName = (typeof tagObj === 'string' ? tagObj : null) ||
                            (tagObj && typeof tagObj === 'object' ? tagObj.name : null) ||
                            (tagId ? tags.find(t => String(t.id) === String(tagId))?.name : null) ||
                            (item as any).tagName;

                        return tagName ? (
                            <View style={[styles.tagBadge, { backgroundColor: colors.surfaceHighlight }]}>
                                <Text style={[styles.tagText, { color: colors.textDim }]} numberOfLines={1} adjustsFontSizeToFit>{tagName}</Text>
                            </View>
                        ) : null;
                    })()}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={projectColor} />
                </TouchableOpacity>
                <View style={styles.titleContainer}>
                    <TouchableOpacity
                        style={styles.titleRow}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setParentTaskSwitchVisible(true);
                        }}
                    >
                        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{parentName}</Text>
                        <Ionicons name="chevron-down" size={16} color={colors.textDim} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>

                    <Text style={[styles.subtitle, { color: colors.textDim }]}>
                        {viewMode === "List" ? `${filteredSubTasks.length} subtasks` : `${viewMode} View`}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.filterBtn, { backgroundColor: colors.surfaceHighlight, marginRight: 8 }]}
                    onPress={() => setCreateSubTaskVisible(true)}
                >
                    <Ionicons name="add" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterBtn, { backgroundColor: colors.surfaceHighlight }, activeFilterCount > 0 && { backgroundColor: isDark ? colors.activeTab : "#e0e7ff" }]}
                    onPress={() => setFilterVisible(true)}
                >
                    <Ionicons
                        name="filter"
                        size={20}
                        color={activeFilterCount > 0 ? colors.primary : colors.textDim}
                    />
                    {activeFilterCount > 0 && (
                        <View style={[styles.filterBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <TaskFilterSheet
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                projectId={projectId}
            />

            {/* Active Filters Bar */}
            {activeFilterCount > 0 && viewMode === "List" && (
                <View style={[styles.activeFiltersBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersScroll}>
                        {filters.search ? (
                            <TouchableOpacity style={[styles.filterChip, { backgroundColor: isDark ? colors.activeTab : "#e0e7ff", borderColor: colors.primary + "30" }]} onPress={() => setProjectFilters(projectId, { ...filters, search: "" })}>
                                <Text style={[styles.filterChipText, { color: colors.primary }]}>Search: {filters.search}</Text>
                                <Ionicons name="close-circle" size={14} color={colors.primary} />
                            </TouchableOpacity>
                        ) : null}
                        {filters.status.map((s: string) => (
                            <TouchableOpacity key={s} style={[styles.filterChip, { backgroundColor: isDark ? colors.activeTab : "#e0e7ff", borderColor: colors.primary + "30" }]} onPress={() => {
                                const newStatus = filters.status.filter((x: string) => x !== s);
                                setProjectFilters(projectId, { ...filters, status: newStatus });
                            }}>
                                <Text style={[styles.filterChipText, { color: colors.primary }]}>{s}</Text>
                                <Ionicons name="close-circle" size={14} color={colors.primary} />
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={{ marginLeft: 8 }} onPress={() => setProjectFilters(projectId, DEFAULT_FILTERS)}>
                            <Text style={styles.clearAllText}>Clear All</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            )}

            <View style={{ flex: 1 }}>
                {viewMode === "Kanban" ? (
                    <ProjectKanban
                        projectId={projectId}
                        navigation={navigation}
                        refreshData={fetchSubTasks}
                        parentId={parentId === "all" ? undefined : parentId}
                    />
                ) : viewMode === "Gantt" ? (
                    <ProjectGanttView
                        projectId={projectId}
                        tasks={subTasks}
                        loading={loading}
                        refreshData={fetchSubTasks}
                        navigation={navigation}
                    />
                ) : (
                    <FlatList
                        data={filteredSubTasks}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            loading ? (
                                <View style={styles.empty}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                    <Text style={[styles.emptySub, { color: colors.textDim, marginTop: 16 }]}>Loading subtasks...</Text>
                                </View>
                            ) : (
                                <View style={styles.empty}>
                                    <Ionicons name="documents-outline" size={64} color={colors.textDim} />
                                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No Deliverables</Text>
                                    <Text style={[styles.emptySub, { color: colors.textDim }]}>This section doesn&apos;t have any individual tasks yet.</Text>
                                    <TouchableOpacity
                                        style={[styles.emptyCreateBtn, { backgroundColor: colors.primary }]}
                                        onPress={() => setCreateSubTaskVisible(true)}
                                    >
                                        <Text style={styles.emptyCreateBtnText}>Create Deliverable</Text>
                                    </TouchableOpacity>
                                </View>
                            )
                        }
                        onRefresh={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); fetchSubTasks(); }}
                        refreshing={loading}
                    />
                )}
            </View>

            <Modal
                visible={parentTaskSwitchVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setParentTaskSwitchVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setParentTaskSwitchVisible(false)}
                >
                    <View style={[styles.switchModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.switchTitle, { color: colors.text }]}>Switch Parent Task</Text>
                        <ScrollView style={styles.switchList} showsVerticalScrollIndicator={false}>

                            {parentTasks.map((t) => (
                                <TouchableOpacity
                                    key={t.id}
                                    style={[
                                        styles.projectOption,
                                        { borderBottomColor: colors.borderLight },
                                        t.id === parentId && { backgroundColor: colors.surfaceHighlight }
                                    ]}
                                    onPress={() => {
                                        setParentTaskSwitchVisible(false);
                                        if (t.id !== parentId) {
                                            navigation.setParams({
                                                parentId: t.id,
                                                parentName: t.name
                                            });
                                        }
                                    }}
                                >
                                    <View style={styles.projectOptionRow}>
                                        <View style={[styles.projectDot, { backgroundColor: t.id === parentId ? colors.primary : colors.textDim }]} />
                                        <Text style={[styles.projectOptionText, { color: colors.text }, t.id === parentId && { fontWeight: "700" }]}>
                                            {t.name}
                                        </Text>
                                        {t.id === parentId && (
                                            <Ionicons name="checkmark" size={18} color={colors.primary} />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            <CreateSubTaskModal
                visible={createSubTaskVisible}
                onClose={() => {
                    setCreateSubTaskVisible(false);
                    setEditingTask(null);
                    fetchSubTasks(); // Refresh after creating
                }}
                initialParentId={parentId !== "all" ? parentId : undefined}
                initialProjectId={projectId}
                initialParentName={parentId !== "all" ? parentName : undefined}
                editingTask={editingTask}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, height: 64, borderBottomWidth: 1 },
    backBtn: { padding: 4 },
    titleContainer: { marginLeft: SPACING.md, flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "center" },
    title: { fontSize: 17, fontWeight: "700" },
    subtitle: { fontSize: 12, marginTop: 2 },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
    switchModal: { width: "80%", maxHeight: "60%", borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    switchTitle: { fontSize: 18, fontWeight: "800", marginBottom: SPACING.md },
    switchList: { width: "100%" },
    projectOption: { paddingVertical: 14, borderBottomWidth: 1 },
    projectOptionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    projectDot: { width: 8, height: 8, borderRadius: 4 },
    projectOptionText: { fontSize: 15, flex: 1 },

    viewModalCompact: {
        width: 260,
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
        padding: SPACING.md,
        position: "absolute",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    modalHeaderCompact: {
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: SPACING.sm,
        marginBottom: SPACING.xs,
        borderBottomWidth: 1,
        gap: 8,
    },
    modalTitleCompact: {
        fontSize: 14,
        fontWeight: "700",
    },
    viewOptionsCompact: {
        marginTop: 4,
    },
    viewOptionCompact: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        gap: 12,
    },
    viewIconBoxCompact: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    viewLabelCompact: {
        fontSize: 13,
        fontWeight: "600",
        flex: 1,
    },

    viewModal: { width: "90%", padding: SPACING.lg, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: "800" },
    viewOptions: { gap: 12 },
    viewOption: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, gap: 16 },
    viewIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    viewLabel: { fontSize: 16, fontWeight: "600", flex: 1 },


    filterBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginRight: SPACING.md },
    filterBadge: { position: "absolute", top: -2, right: -2, width: 14, height: 14, borderRadius: 7, justifyContent: "center", alignItems: "center", borderWidth: 1 },
    filterBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800" },

    activeFiltersBar: { paddingVertical: SPACING.sm, borderBottomWidth: 1 },
    activeFiltersScroll: { paddingHorizontal: SPACING.md, alignItems: "center", gap: 8 },
    filterChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4, borderWidth: 1 },
    filterChipText: { fontSize: 11, fontWeight: "600" },
    clearAllText: { color: "#ef4444", fontSize: 12, fontWeight: "600", marginLeft: 8 },

    list: { padding: SPACING.md, paddingBottom: SPACING.bottomTabBar },
    card: { padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
    nameContainer: { flex: 1, flexDirection: "row", alignItems: "flex-start", paddingRight: 8 },
    taskTitle: { fontSize: 15, fontWeight: "700", flex: 1, lineHeight: 22 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
    statusText: { fontSize: 10, fontWeight: "800" },

    description: { fontSize: 13, lineHeight: 18, marginBottom: 12, opacity: 0.8 },

    label: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
    avatar: { width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center" },
    avatarText: { fontSize: 10, fontWeight: "700" },
    memberName: { fontSize: 11, fontWeight: "500", maxWidth: 80 },

    footer: { flexDirection: "row", alignItems: "flex-end", paddingTop: 12, borderTopWidth: 1, gap: 12 },
    datesContainer: { flexDirection: "row", gap: 12 },
    dateInfo: { gap: 2 },
    dateText: { fontSize: 11 },

    flexFiller: { flex: 1 },
    bottomMembers: { flexDirection: "row", gap: 16, alignItems: "flex-end" },
    memberGroup: { gap: 2, alignItems: "flex-start" },
    microLabel: { fontSize: 9, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, opacity: 0.7 },
    compactMember: { flexDirection: "row", alignItems: "center", gap: 6 },

    secondaryInfo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },

    urgencyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    urgencyDot: { width: 6, height: 6, borderRadius: 3 },
    urgencyText: { fontSize: 10, fontWeight: "700" },

    tagBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, minWidth: 40, alignItems: "center" },
    tagText: { fontSize: 8, fontWeight: "700", textTransform: "uppercase" },

    empty: { marginTop: 100, alignItems: "center", paddingHorizontal: SPACING.xl },
    emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: SPACING.lg },
    emptySub: { fontSize: 15, textAlign: "center", marginTop: SPACING.sm, lineHeight: 22 },
    emptyCreateBtn: {
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: BORDER_RADIUS.md,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
    },
    emptyCreateBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
