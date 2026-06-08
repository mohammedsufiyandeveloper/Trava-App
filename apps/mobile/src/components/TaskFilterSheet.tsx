import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Platform,
    TextInput,
    TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace, DEFAULT_FILTERS } from "../context/WorkspaceContext";
import { getWorkspaceMembers, getTags, getProjectMembers, getTasks } from "../services/api";
import CalendarPicker from "./CalendarPicker";
import { getStatusHex, getStatusBgColor } from "../utils/taskColors";
import { format, startOfToday, endOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isBefore } from "date-fns";

interface TaskFilterSheetProps {
    visible: boolean;
    onClose: () => void;
    showProjectFilter?: boolean;
    projectId?: string;
}

export default function TaskFilterSheet({
    visible,
    onClose,
    showProjectFilter = false,
    projectId
}: TaskFilterSheetProps) {
    const {
        activeWorkspace,
        projects,
        globalFilters,
        setGlobalFilters,
        projectFilters,
        setProjectFilters
    } = useWorkspace();
    const { colors, isDark } = useTheme();

    const currentFilters = useMemo(() => {
        if (projectId) {
            return projectFilters[projectId] || DEFAULT_FILTERS;
        }
        return globalFilters;
    }, [projectId, projectFilters, globalFilters]);

    const [localFilters, setLocalFilters] = useState(currentFilters);

    const STATUS_OPTIONS = [
        { id: "TO_DO", label: "To Do", color: getStatusHex("TO_DO") },
        { id: "IN_PROGRESS", label: "In Progress", color: getStatusHex("IN_PROGRESS") },
        { id: "REVIEW", label: "Review", color: getStatusHex("REVIEW") },
        { id: "HOLD", label: "On Hold", color: getStatusHex("HOLD") },
        { id: "COMPLETED", label: "Completed", color: getStatusHex("COMPLETED") },
    ];

    const TIME_OPTIONS = [
        { id: "today", label: "Today" },
        { id: "week", label: "This Week" },
        { id: "month", label: "This Month" },
        { id: "delayed", label: "Delayed" },
    ];
    const [members, setMembers] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [showDatePicker, setShowDatePicker] = useState<"after" | "before" | null>(null);
    const [showTimeOptions, setShowTimeOptions] = useState(false);

    useEffect(() => {
        if (visible) {
            setLocalFilters(currentFilters);
            loadData();
        }
    }, [visible]); // Refetch data when visible, but only update localFilters once when visible becomes true.

    const loadData = async () => {
        if (!activeWorkspace) return;
        try {
            if (projectId) {
                // Fetch project-specific members and tasks to find used tags
                const [projectMembers, projectTasksResult, allTags] = await Promise.all([
                    getProjectMembers(projectId),
                    getTasks(activeWorkspace.id, { projectId, hierarchyMode: "all" }),
                    getTags(activeWorkspace.id)
                ]);
                const projectTasks = projectTasksResult.tasks;

                // Normalize project members to match workspace member structure
                const normalizedMembers = projectMembers.map(pm => ({
                    userId: pm.userId,
                    user: pm.user || { name: pm.name || "Member" }
                }));
                setMembers(normalizedMembers);

                // Filter tags to only show those used in this project's tasks (recursive)
                const usedTagIds = new Set<string>();
                const extractTags = (tasks: any[]) => {
                    tasks.forEach(task => {
                        if (task.tagId) usedTagIds.add(task.tagId);
                        if (task.tags && Array.isArray(task.tags)) {
                            task.tags.forEach((tag: any) => usedTagIds.add(tag.id || tag));
                        }
                        if (task.subTasks && task.subTasks.length > 0) {
                            extractTags(task.subTasks);
                        }
                    });
                };
                extractTags(projectTasks);

                let filteredTags = allTags.filter(tag => usedTagIds.has(tag.id));

                // Fallback: If no tags are used in the project yet, show all tags 
                // so the user can start using them.
                if (filteredTags.length === 0) {
                    filteredTags = allTags;
                }
                setTags(filteredTags);
            } else {
                // Workspace-wide filters
                const [m, t] = await Promise.all([
                    getWorkspaceMembers(activeWorkspace.id),
                    getTags(activeWorkspace.id)
                ]);
                setMembers(m);
                setTags(t);
            }
        } catch (error) {
            console.error("Error loading filter data:", error);
        }
    };

    const toggleFilter = (type: "status" | "assigneeId" | "tagId" | "projectId", id: string) => {
        const current = [...(localFilters[type] || [])];
        const index = current.indexOf(id);
        if (index > -1) {
            current.splice(index, 1);
        } else {
            current.push(id);
        }
        setLocalFilters({ ...localFilters, [type]: current });
    };

    const handleRangeSelect = (start: Date, end: Date) => {
        setLocalFilters({
            ...localFilters,
            dueAfter: start.toISOString(),
            dueBefore: end.toISOString(),
            sorts: [{ field: "dueDate", direction: "asc" }]
        });
        setShowDatePicker(null);
    };

    const handleTimeQuickFilter = (type: string) => {
        const today = new Date();
        let dueAfter: string | undefined = undefined;
        let dueBefore: string | undefined = undefined;
        let sorts = localFilters.sorts;

        switch (type) {
            case "today":
                dueAfter = startOfToday().toISOString();
                dueBefore = endOfToday().toISOString();
                sorts = [{ field: "dueDate", direction: "asc" }];
                break;
            case "week":
                dueAfter = startOfWeek(today, { weekStartsOn: 1 }).toISOString();
                dueBefore = endOfWeek(today, { weekStartsOn: 1 }).toISOString();
                sorts = [{ field: "dueDate", direction: "asc" }];
                break;
            case "month":
                dueAfter = startOfMonth(today).toISOString();
                dueBefore = endOfMonth(today).toISOString();
                sorts = [{ field: "dueDate", direction: "asc" }];
                break;
            case "delayed":
                dueBefore = startOfToday().toISOString();
                // Filter for incomplete tasks that are before today
                setLocalFilters({
                    ...localFilters,
                    dueBefore: startOfToday().toISOString(),
                    dueAfter: undefined,
                    status: ["TO_DO", "IN_PROGRESS", "REVIEW", "HOLD"],
                    sorts: [{ field: "dueDate", direction: "asc" }]
                });
                return;
        }

        setLocalFilters({
            ...localFilters,
            dueAfter,
            dueBefore,
            sorts
        });
        setShowTimeOptions(false);
    };

    const handleApply = () => {
        if (projectId) {
            setProjectFilters(projectId, localFilters);
        } else {
            setGlobalFilters(localFilters);
        }
        onClose();
    };

    const handleReset = () => {
        const reset = { ...DEFAULT_FILTERS };
        setLocalFilters(reset);
        if (projectId) {
            setProjectFilters(projectId, reset);
        } else {
            setGlobalFilters(reset);
        }
        onClose();
    };

    const isSelected = (type: "status" | "assigneeId" | "tagId" | "projectId", id: string) => {
        return (localFilters[type] || []).includes(id);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>

                <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
                    <View style={styles.header}>
                        <View style={[styles.handle, { backgroundColor: colors.border }]} />
                        <View style={styles.titleRow}>
                            <Text style={[styles.title, { color: colors.text }]}>Filters</Text>
                            <TouchableOpacity onPress={handleReset}>
                                <Text style={styles.resetText}>Reset All</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Search */}
                        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Search</Text>
                        <View style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <Ionicons name="search" size={18} color={colors.textDim} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Search tasks..."
                                placeholderTextColor={colors.textDim}
                                value={localFilters.search}
                                onChangeText={(text) => setLocalFilters({ ...localFilters, search: text })}
                            />
                        </View>

                        {/* Projects Filter - HIDDEN when inside a project */}
                        {showProjectFilter && !projectId && projects.length > 0 && (
                            <>
                                <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Projects</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                                    {projects.map((project) => {
                                        const selected = isSelected("projectId", project.id);
                                        return (
                                            <TouchableOpacity
                                                key={project.id}
                                                style={[
                                                    styles.projectChip,
                                                    { backgroundColor: colors.background, borderColor: colors.border },
                                                    selected && [styles.chipSelected, { borderColor: project.color || colors.primary, backgroundColor: (project.color || colors.primary) + "15" }]
                                                ]}
                                                onPress={() => toggleFilter("projectId", project.id)}
                                            >
                                                <View style={[styles.projectDot, { backgroundColor: project.color || colors.primary }]} />
                                                <Text style={[styles.chipText, { color: colors.textDim }, selected && { color: project.color || colors.primary, fontWeight: "700" }]}>
                                                    {project.name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </>
                        )}

                        {/* Status */}
                        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Status</Text>
                        <View style={styles.chipContainer}>
                            {STATUS_OPTIONS.map((opt) => {
                                const selected = isSelected("status", opt.id);
                                return (
                                    <TouchableOpacity
                                        key={opt.id}
                                        style={[
                                            styles.chip,
                                            { backgroundColor: colors.background, borderColor: colors.border },
                                            selected && [styles.chipSelected, { borderColor: opt.color, backgroundColor: getStatusBgColor(opt.id) }]
                                        ]}
                                        onPress={() => toggleFilter("status", opt.id)}
                                    >
                                        <View style={[styles.dot, { backgroundColor: opt.color }]} />
                                        <Text style={[styles.chipText, { color: colors.textDim }, selected && [styles.chipTextSelected, { color: opt.color, fontWeight: "700" }]]}>
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Date Picker Section */}
                        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Date Picker</Text>
                        <View style={styles.chipContainer}>
                            {/* Date Range Chip */}
                            <TouchableOpacity
                                style={[
                                    styles.chip,
                                    { backgroundColor: colors.background, borderColor: colors.border },
                                    (localFilters.dueAfter || localFilters.dueBefore) && [styles.chipSelected, { borderColor: colors.primary, backgroundColor: colors.activeTab }]
                                ]}
                                onPress={() => setShowDatePicker("after")}
                            >
                                <Ionicons name="calendar-outline" size={16} color={(localFilters.dueAfter || localFilters.dueBefore) ? colors.primary : colors.textDim} />
                                <Text style={[styles.chipText, { color: colors.textDim, marginLeft: 6 }, (localFilters.dueAfter || localFilters.dueBefore) && [styles.chipTextSelected, { color: colors.primary }]]}>
                                    {localFilters.dueAfter && localFilters.dueBefore
                                        ? `${format(new Date(localFilters.dueAfter), "MMM d")} - ${format(new Date(localFilters.dueBefore), "MMM d")}`
                                        : "Date Range"}
                                </Text>
                            </TouchableOpacity>

                            {/* Time Period Chip */}
                            <TouchableOpacity
                                style={[
                                    styles.chip,
                                    { backgroundColor: colors.background, borderColor: colors.border },
                                    (localFilters.dueAfter || localFilters.dueBefore) && [styles.chipSelected, { borderColor: colors.primary, backgroundColor: colors.activeTab }]
                                ]}
                                onPress={() => setShowTimeOptions(true)}
                            >
                                <Ionicons name="time-outline" size={16} color={(localFilters.dueAfter || localFilters.dueBefore) ? colors.primary : colors.textDim} />
                                <Text style={[styles.chipText, { color: colors.textDim, marginLeft: 6 }, (localFilters.dueAfter || localFilters.dueBefore) && [styles.chipTextSelected, { color: colors.primary }]]}>
                                    {(() => {
                                        const today = new Date();
                                        if (localFilters.dueAfter === startOfToday().toISOString() && localFilters.dueBefore === endOfToday().toISOString()) return "Today";
                                        if (localFilters.dueAfter === startOfWeek(today, { weekStartsOn: 1 }).toISOString() && localFilters.dueBefore === endOfWeek(today, { weekStartsOn: 1 }).toISOString()) return "This Week";
                                        if (localFilters.dueAfter === startOfMonth(today).toISOString() && localFilters.dueBefore === endOfMonth(today).toISOString()) return "This Month";
                                        if (localFilters.dueBefore && isBefore(new Date(localFilters.dueBefore), startOfToday()) && !localFilters.dueAfter) return "Delayed";
                                        return "Time Period";
                                    })()}
                                </Text>
                            </TouchableOpacity>
                        </View>


                        {/* Assignee */}
                        {members.length > 0 && (
                            <>
                                <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Assignee</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                                    {members.map((member) => {
                                        const selected = isSelected("assigneeId", member.userId);
                                        return (
                                            <TouchableOpacity
                                                key={member.userId}
                                                style={[
                                                    styles.avatarChip,
                                                    { backgroundColor: colors.background, borderColor: colors.border },
                                                    selected && [styles.avatarChipSelected, { borderColor: colors.primary, backgroundColor: colors.activeTab }]
                                                ]}
                                                onPress={() => toggleFilter("assigneeId", member.userId)}
                                            >
                                                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                                                    <Text style={styles.avatarText}>
                                                        {(member.user.surname?.[0] || member.user.name.charAt(0)).toUpperCase()}
                                                    </Text>
                                                </View>
                                                <Text style={[styles.chipText, { color: colors.textDim }, selected && [styles.chipTextSelected, { color: colors.primary }]]}>
                                                    {member.user.surname || member.user.name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </>
                        )}

                        {/* Tags */}
                        {tags.length > 0 && (
                            <>
                                <Text style={[styles.sectionTitle, { color: colors.textDim }]}>Tags</Text>
                                <View style={styles.chipContainer}>
                                    {tags.map((tag) => {
                                        const selected = isSelected("tagId", tag.id);
                                        return (
                                            <TouchableOpacity
                                                key={tag.id}
                                                style={[
                                                    styles.chip,
                                                    { backgroundColor: colors.background, borderColor: colors.border },
                                                    selected && [styles.chipSelected, { borderColor: colors.primary, backgroundColor: colors.activeTab }]
                                                ]}
                                                onPress={() => toggleFilter("tagId", tag.id)}
                                            >
                                                <Ionicons name="pricetag-outline" size={14} color={selected ? colors.primary : colors.textDim} />
                                                <Text style={[styles.chipText, { color: colors.textDim }, selected && [styles.chipTextSelected, { color: colors.primary }]]}>
                                                    {tag.name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>

                    {/* Time Period Pop-up */}
                    <Modal
                        visible={showTimeOptions}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setShowTimeOptions(false)}
                    >
                        <TouchableWithoutFeedback onPress={() => setShowTimeOptions(false)}>
                            <View style={styles.modalOverlay}>
                                <TouchableWithoutFeedback>
                                    <View style={[styles.timeOptionsModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                        <Text style={[styles.modalTitle, { color: colors.text }]}>Select Time Period</Text>
                                        {TIME_OPTIONS.map((opt) => {
                                            const today = new Date();
                                            let isActive = false;
                                            if (opt.id === "today") {
                                                isActive = localFilters.dueAfter === startOfToday().toISOString() && localFilters.dueBefore === endOfToday().toISOString();
                                            } else if (opt.id === "week") {
                                                isActive = localFilters.dueAfter === startOfWeek(today, { weekStartsOn: 1 }).toISOString() && localFilters.dueBefore === endOfWeek(today, { weekStartsOn: 1 }).toISOString();
                                            } else if (opt.id === "month") {
                                                isActive = localFilters.dueAfter === startOfMonth(today).toISOString() && localFilters.dueBefore === endOfMonth(today).toISOString();
                                            } else if (opt.id === "delayed") {
                                                isActive = !!localFilters.dueBefore && isBefore(new Date(localFilters.dueBefore), startOfToday()) && !localFilters.dueAfter;
                                            }

                                            return (
                                                <TouchableOpacity
                                                    key={opt.id}
                                                    style={[
                                                        styles.dropdownItem,
                                                        isActive && { backgroundColor: colors.primary + "15" }
                                                    ]}
                                                    onPress={() => handleTimeQuickFilter(opt.id)}
                                                >
                                                    <Text style={[styles.dropdownItemText, { color: isActive ? colors.primary : colors.text }]}>
                                                        {opt.label}
                                                    </Text>
                                                    {isActive && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </TouchableWithoutFeedback>
                            </View>
                        </TouchableWithoutFeedback>
                    </Modal>

                    <View style={[styles.footer, { borderTopColor: colors.border }]}>
                        <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={handleApply}>
                            <Text style={styles.applyBtnText}>Apply Filters</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <CalendarPicker
                    visible={showDatePicker !== null}
                    onClose={() => setShowDatePicker(null)}
                    mode="range"
                    onSelectRange={handleRangeSelect}
                    startDate={localFilters.dueAfter ? new Date(localFilters.dueAfter) : null}
                    endDate={localFilters.dueBefore ? new Date(localFilters.dueBefore) : null}
                    title="Select Date Range"
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        height: "80%",
        paddingBottom: Platform.OS === "ios" ? 40 : 20,
    },
    header: { alignItems: "center", paddingTop: 12, paddingBottom: 16 },
    handle: { width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
    titleRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: SPACING.lg },
    title: { fontSize: 20, fontWeight: "700" },
    resetText: { fontSize: 14, color: "#ef4444", fontWeight: "600" },

    content: { flex: 1, paddingHorizontal: SPACING.lg },
    sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: 24, marginBottom: 12 },

    searchContainer: { flexDirection: "row", alignItems: "center", borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, height: 48, borderWidth: 1 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15 },

    chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { flexDirection: "row", alignItems: "center", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1 },
    chipSelected: {},
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    chipText: { fontSize: 14, fontWeight: "500" },
    chipTextSelected: {},

    horizontalScroll: { marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg, marginBottom: 4 },
    avatarChip: { flexDirection: "row", alignItems: "center", borderRadius: 24, padding: 6, paddingRight: 16, borderWidth: 1, marginRight: 10 },
    avatarChipSelected: {},
    avatar: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 8 },
    avatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },

    projectChip: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, marginRight: 10 },
    projectDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },

    footer: { padding: SPACING.lg, borderTopWidth: 1 },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    timeOptionsModal: {
        width: "90%",
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        paddingVertical: 16,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 16,
    },
    applyBtn: { borderRadius: BORDER_RADIUS.md, height: 52, justifyContent: "center", alignItems: "center" },
    applyBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    dropdownButton: {
        height: 48,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        paddingHorizontal: 12,
        marginBottom: 8,
        justifyContent: "center",
    },
    dropdownButtonText: {
        fontSize: 14,
        fontWeight: "500",
    },
    dropdownMenu: {
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        marginBottom: 16,
        overflow: "hidden",
    },
    dropdownItem: {
        height: 48,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    dropdownItemText: {
        fontSize: 14,
        fontWeight: "500",
    },
});
