import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Dimensions,
    Image,
    LayoutAnimation,
    UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format, isBefore, isSameDay, startOfToday } from "date-fns";
import CalendarPicker from "./CalendarPicker";
import TimeWheelPicker from "./TimeWheelPicker";
import { SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { createSubTask, getWorkspaceMembers, getProjectMembers, getTags, getTasks, updateTask } from "../services/api";
import { getStatusHex, getStatusBgColor } from "../utils/taskColors";
import AppButton from "./AppButton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

if (Platform.OS === "android") {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface CreateSubTaskModalProps {
    visible: boolean;
    onClose: () => void;
    initialParentId?: string;
    initialProjectId?: string;
    initialParentName?: string;
    editingTask?: any;
}

export default function CreateSubTaskModal({ visible, onClose, initialParentId, initialProjectId, initialParentName, editingTask }: CreateSubTaskModalProps) {
    const { tasks, projects, activeWorkspace, refreshData } = useWorkspace();
    const { colors, isDark } = useTheme();

    const isEditing = !!editingTask;

    // Core fields
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
    const [status, setStatus] = useState("TO_DO");
    const [assigneeId, setAssigneeId] = useState<string | null>(null);
    const [reviewerId, setReviewerId] = useState<string | null>(null);
    const [tagId, setTagId] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showDueTimePicker, setShowDueTimePicker] = useState(false);
    const [days, setDays] = useState("1");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data for pickers
    const [members, setMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [tags, setTags] = useState<any[]>([]);

    const [fetchedTasks, setFetchedTasks] = useState<any[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

    const handleSelectProject = async (projId: string) => {
        if (!activeWorkspace?.id) return;
        setLoadingProjectId(projId);
        try {
            const result = await getTasks(activeWorkspace.id, { projectId: projId, hierarchyMode: "parents", limit: 200 });
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setFetchedTasks(result.tasks);
            setSelectedProjectId(projId);
            setSelectedParentId(null);
        } catch (err) {
            console.error("Failed fetching project tasks", err);
            setError("Failed to load project tasks. Please try again.");
        } finally {
            setLoadingProjectId(null);
        }
    };

    const projectTasks = fetchedTasks;

    const STATUS_OPTIONS = [
        { id: "TO_DO", label: "To Do", color: getStatusHex("TO_DO") },
        { id: "IN_PROGRESS", label: "In Progress", color: getStatusHex("IN_PROGRESS") },
        { id: "REVIEW", label: "Review", color: getStatusHex("REVIEW") },
        { id: "HOLD", label: "On Hold", color: getStatusHex("HOLD") },
        { id: "COMPLETED", label: "Completed", color: getStatusHex("COMPLETED") },
    ];

    useEffect(() => {
        if (visible) {
            loadWorkspaceData();
            if (editingTask) {
                setName(editingTask.name || "");
                setDescription(editingTask.description || "");
                setStatus(editingTask.status || "TO_DO");
                setAssigneeId(editingTask.assignee?.id || null);
                setReviewerId(editingTask.reviewer?.id || null);
                setTagId(editingTask.tagId || null);
                setStartDate(editingTask.startDate ? new Date(editingTask.startDate) : null);
                setDueDate(editingTask.dueDate ? new Date(editingTask.dueDate) : null);
                setDays(editingTask.days?.toString() || "1");
                setSelectedParentId(editingTask.parentTaskId || null);
                setSelectedProjectId(editingTask.projectId || null);
            } else if (initialParentId) {
                setSelectedParentId(initialParentId);
                const parent = tasks.find(t => t.id === initialParentId);
                if (parent) {
                    setSelectedProjectId(parent.projectId || initialProjectId || null);
                    setTagId(parent.tagId || null);
                } else {
                    setSelectedProjectId(initialProjectId || null);
                }
            } else {
                setSelectedParentId(null);
                setSelectedProjectId(null);
            }
        } else {
            // Reset
            setName("");
            setDescription("");
            setError(null);
            setSelectedParentId(null);
            setSelectedProjectId(null);
            setAssigneeId(null);
            setReviewerId(null);
            setTagId(null);
            setStartDate(null);
            setDueDate(null);
            setShowStartDatePicker(false);
            setShowDueDatePicker(false);
            setShowStartTimePicker(false);
            setShowDueTimePicker(false);
            setDays("1");
            setStatus("TO_DO");
        }
    }, [visible, initialParentId, editingTask]);

    useEffect(() => {
        const fetchProjectMembers = async () => {
            if (!visible) return;
            // Prefer selectedProjectId (always correctly set, whether from initialProjectId or user selection)
            // Fallback: look up parent task in cached tasks
            const resolvedProjectId =
                selectedProjectId ||
                tasks.find(t => t.id === selectedParentId)?.projectId ||
                null;

            if (resolvedProjectId && activeWorkspace?.id) {
                setLoadingMembers(true);
                try {
                    // Fetch project members AND workspace members (to include all Owners/Admins)
                    const [pMembers, wMembers] = await Promise.all([
                        getProjectMembers(resolvedProjectId),
                        getWorkspaceMembers(activeWorkspace.id)
                    ]);

                    // Merge: start with project members
                    const merged = [...pMembers];

                    // Add workspace Owners/Admins if not already in the list
                    wMembers.forEach(wm => {
                        const isAlreadyIn = merged.some(m => m.userId === wm.userId);
                        if (!isAlreadyIn && (wm.workspaceRole === "OWNER" || wm.workspaceRole === "ADMIN")) {
                            merged.push({
                                userId: wm.userId,
                                name: wm.user.name,
                                image: wm.user.image,
                                role: "VIEWER", // External admins have no specific role in this project
                                workspaceRole: wm.workspaceRole,
                                user: wm.user,
                                isExternalAdmin: true // Mark as external admin for filtering
                            });
                        }
                    });

                    setMembers(merged);
                } catch (e) {
                    console.error("[CreateSubTaskModal] Error loading members:", e);
                } finally {
                    setLoadingMembers(false);
                }
            }
        };
        fetchProjectMembers();
    }, [visible, selectedProjectId, selectedParentId, activeWorkspace?.id]);

    const loadWorkspaceData = async () => {
        if (!activeWorkspace?.id) return;
        try {
            const t = await getTags(activeWorkspace.id);
            setTags(t);
        } catch (e) {
            console.error("[CreateSubTaskModal] Error loading data:", e);
        }
    };

    useEffect(() => {
        const fetchProjectTasks = async () => {
            if (!visible || !selectedProjectId || !activeWorkspace?.id) {
                setFetchedTasks([]);
                return;
            }
            // Avoid refetching if tasks are already populated for the selected project
            const alreadyFetched = fetchedTasks.length > 0 && fetchedTasks[0].projectId === selectedProjectId;
            if (alreadyFetched) {
                return;
            }
            setLoadingTasks(true);
            try {
                // Fetch ONLY parent tasks (not subtasks) to be parents
                const result = await getTasks(activeWorkspace.id, { projectId: selectedProjectId, hierarchyMode: "parents", limit: 200 });
                setFetchedTasks(result.tasks);
            } catch (err) {
                console.error("Failed fetching project tasks", err);
            } finally {
                setLoadingTasks(false);
            }
        };
        fetchProjectTasks();
    }, [visible, selectedProjectId, activeWorkspace?.id]);

    const handleSubmit = async () => {
        if (!name.trim() || !selectedParentId) {
            setError("Please check the form details and try again.");
            return;
        }

        // Date and Time validation logic
        const now = new Date();
        const validationBuffer = new Date(now.getTime() - 60000); // 1 minute buffer for slow submissions

        if (!isEditing && startDate && isBefore(startDate, validationBuffer)) {
            setError("Start date/time cannot be in the past");
            return;
        }
        if (dueDate && isBefore(dueDate, startOfToday()) && !isSameDay(dueDate, startOfToday())) {
            setError("Due date cannot be in the past");
            return;
        }
        if (startDate && dueDate && isBefore(dueDate, startDate)) {
            setError("Due date cannot be before start date");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const taskData = {
                name: name.trim(),
                description: description.trim() || undefined,
                status,
                assigneeUserId: assigneeId || undefined,
                reviewerId: reviewerId || undefined,
                tagId: tagId || undefined,
                startDate: startDate ? startDate.toISOString() : undefined,
                dueDate: dueDate ? dueDate.toISOString() : undefined,
                days: parseInt(days) || 1,
                parentTaskId: selectedParentId
            };

            let res;
            if (isEditing) {
                res = await updateTask(editingTask.id, taskData);
            } else {
                res = await createSubTask(selectedParentId, taskData);
            }

            if (res.success || res.id) {
                await refreshData();
                onClose();
            } else {
                setError(res.error || `Failed to ${isEditing ? "update" : "create"} subtask`);
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const renderUserChip = (member: any, isSelected: boolean, onSelect: () => void) => {
        // API returns { userId, name, email, image, role }
        const getSurname = (fullName: string) => {
            const name = fullName?.trim() || "";
            if (!name) return "Unknown";
            const parts = name.split(/\s+/);
            return parts[parts.length - 1];
        };
        const displayName = getSurname(member.user?.surname || member.surname || member.user?.name || member.name);
        const photoUrl = member.image || member.user?.image || null;
        const initials = displayName.charAt(0).toUpperCase();
        // Use distinct hue per member to differentiate avatars (like web)
        const colorSeed = member.userId ? member.userId.charCodeAt(0) % 5 : 0;
        const avatarColors = ["#ef4444", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];
        const avatarBg = avatarColors[colorSeed];
        return (
            <TouchableOpacity
                key={member.userId}
                style={[
                    styles.avatarChip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + "15" }
                ]}
                onPress={onSelect}
            >
                <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                    {photoUrl ? (
                        <Image source={{ uri: photoUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                    ) : (
                        <Text style={styles.avatarText}>{initials}</Text>
                    )}
                </View>
                <Text style={[styles.chipText, { color: colors.textDim }, isSelected && { color: colors.primary, fontFamily: FONTS.bold }]}>
                    {displayName}
                </Text>
                {isSelected && (
                    <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
                )}
            </TouchableOpacity>
        );
    };

    const renderMemberRow = (label: string, selectedId: string | null, setter: (id: string | null) => void, filterFn?: (m: any) => boolean) => {
        let displayMembers = members;
        if (filterFn) {
            displayMembers = members.filter(filterFn);
        }

        return (
            <>
                <Text style={[styles.label, { color: colors.textDim }]}>{label}</Text>
                {loadingMembers ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: "flex-start", marginBottom: 12 }} />
                ) : displayMembers.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {displayMembers.map(m => renderUserChip(m, selectedId === m.userId, () => setter(selectedId === m.userId ? null : m.userId)))}
                    </ScrollView>
                ) : (
                    <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 12 }}>
                        {filterFn ? `No eligible ${label.toLowerCase()}s found` : "No project members available"}
                    </Text>
                )}
            </>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    style={styles.container}
                    pointerEvents="box-none"
                >
                    <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
                        <View style={styles.header}>
                            <View style={[styles.handle, { backgroundColor: colors.border }]} />
                            <View style={styles.titleRow}>
                                <View style={styles.titleLeft}>
                                    <View style={[styles.iconBox, { backgroundColor: colors.primary + "20" }]}>
                                        <Ionicons name="git-branch-outline" size={18} color={colors.primary} />
                                    </View>
                                    <Text style={[styles.title, { color: colors.text }]}>{isEditing ? "Edit Sub Task" : "Create Sub Task"}</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
                                    <Ionicons name="close" size={22} color={colors.textDim} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView
                            style={[styles.content, { flexShrink: 1 }]}
                            contentContainerStyle={{ paddingBottom: 60 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Project Selection (Step 1 or Read Only) */}
                            {(!initialParentId && !isEditing) ? (
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={[styles.label, { color: colors.textDim, marginTop: 0 }]}>Project</Text>
                                    {selectedProjectId ? (
                                        <View style={[styles.parentItem, { backgroundColor: colors.background, borderColor: colors.border, justifyContent: "space-between" }]}>
                                            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                                                <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{ marginRight: 12 }} />
                                                <Text style={[styles.parentLabel, { color: colors.text, fontFamily: FONTS.bold, flex: 1 }]} numberOfLines={1}>
                                                    {projects.find(p => p.id === selectedProjectId)?.name || "Selected Project"}
                                                </Text>
                                            </View>
                                            <TouchableOpacity onPress={() => {
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                setSelectedProjectId(null);
                                                setSelectedParentId(null);
                                                setFetchedTasks([]);
                                            }}>
                                                <Text style={{ color: colors.primary, fontFamily: FONTS.bold, fontSize: 13, paddingLeft: 8 }}>Change</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.parentList}>
                                            {projects.map((proj) => {
                                                const isItemLoading = loadingProjectId === proj.id;
                                                return (
                                                    <TouchableOpacity
                                                        key={proj.id}
                                                        style={[
                                                            styles.parentItem,
                                                            { backgroundColor: colors.background, borderColor: colors.border },
                                                            selectedProjectId === proj.id && { borderColor: colors.primary, backgroundColor: colors.primary + "15" }
                                                        ]}
                                                        disabled={loadingProjectId !== null}
                                                        onPress={() => handleSelectProject(proj.id)}
                                                    >
                                                        <View style={[styles.dot, { backgroundColor: proj.color || colors.primary, width: 12, height: 12, borderRadius: 6, marginRight: 12 }]} />
                                                        <Text style={[styles.parentLabel, { color: colors.text }, selectedProjectId === proj.id && { color: colors.primary, fontFamily: FONTS.bold }, loadingProjectId !== null && { opacity: 0.6 }]}>
                                                            {proj.name}
                                                        </Text>
                                                        {isItemLoading ? (
                                                            <ActivityIndicator size="small" color={colors.primary} />
                                                        ) : selectedProjectId === proj.id ? (
                                                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                                                        ) : null}
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            ) : (
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={[styles.label, { color: colors.textDim, marginTop: 0 }]}>Project</Text>
                                    <View style={[styles.parentItem, { backgroundColor: colors.background, borderColor: colors.border, opacity: 0.7 }]}>
                                        <View style={[styles.dot, { backgroundColor: projects.find(p => p.id === selectedProjectId)?.color || colors.primary, width: 12, height: 12, borderRadius: 6, marginRight: 12 }]} />
                                        <Text style={[styles.parentLabel, { color: colors.text }]}>
                                            {projects.find(p => p.id === selectedProjectId)?.name || "Unknown Project"}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Parent Task Selection (Step 2 or Read Only) */}
                            {(selectedProjectId && !initialParentId && !isEditing) ? (
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={[styles.label, { color: colors.textDim, marginTop: 0 }]}>Parent Task</Text>
                                    {selectedParentId ? (
                                        <View style={[styles.parentItem, { backgroundColor: colors.background, borderColor: colors.border, justifyContent: "space-between" }]}>
                                            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                                                <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{ marginRight: 12 }} />
                                                <Text style={[styles.parentLabel, { color: colors.text, fontFamily: FONTS.bold, flex: 1 }]} numberOfLines={1}>
                                                    {projectTasks.find(t => t.id === selectedParentId)?.name || tasks.find(t => t.id === selectedParentId)?.name || "Selected Task"}
                                                </Text>
                                            </View>
                                            <TouchableOpacity onPress={() => {
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                setSelectedParentId(null);
                                            }}>
                                                <Text style={{ color: colors.primary, fontFamily: FONTS.bold, fontSize: 13, paddingLeft: 8 }}>Change</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.parentList}>
                                            {loadingTasks ? (
                                                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
                                            ) : projectTasks.length > 0 ? (
                                                projectTasks.map((task) => (
                                                    <TouchableOpacity
                                                        key={task.id}
                                                        style={[
                                                            styles.parentItem,
                                                            { backgroundColor: colors.background, borderColor: colors.border },
                                                            selectedParentId === task.id && { backgroundColor: isDark ? colors.activeTab : "#e0e7ff", borderColor: colors.primary }
                                                        ]}
                                                        onPress={() => {
                                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                            setSelectedParentId(task.id);
                                                        }}
                                                    >
                                                        <Ionicons
                                                            name={selectedParentId === task.id ? "checkmark-circle" : "ellipse-outline"}
                                                            size={20}
                                                            color={selectedParentId === task.id ? colors.primary : colors.border}
                                                        />
                                                        <Text style={[styles.parentLabel, { color: colors.text }, selectedParentId === task.id && { color: colors.primary, fontFamily: FONTS.bold }]}>
                                                            {task.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))
                                            ) : (
                                                <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 4 }}>No parent tasks found in this project.</Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            ) : (initialParentId || isEditing) ? (
                                <View style={{ marginBottom: 24 }}>
                                    <Text style={[styles.label, { color: colors.textDim, marginTop: 0 }]}>Parent Task</Text>
                                    <View style={[styles.parentItem, { backgroundColor: colors.background, borderColor: colors.border, opacity: 0.7 }]}>
                                        <Ionicons name="git-branch-outline" size={20} color={colors.textDim} />
                                        <Text style={[styles.parentLabel, { color: colors.text, marginLeft: 8 }]}>
                                            {initialParentName || editingTask?.parentTask?.name || projectTasks.find(t => t.id === selectedParentId)?.name || tasks.find(t => t.id === selectedParentId)?.name || "Unknown Task"}
                                        </Text>
                                    </View>
                                </View>
                            ) : null}

                            {/* Additional Subtask Details (Step 3) */}
                            {((!initialParentId && !isEditing && selectedParentId) || initialParentId || isEditing) && (
                                <>
                                    {/* Subtask Name */}
                                    <Text style={[styles.label, { color: colors.textDim, marginTop: 0 }]}>Title</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                        placeholder="What is this subtask about?"
                                        placeholderTextColor={colors.textDim}
                                        value={name}
                                        onChangeText={setName}
                                    />

                                    {/* Description */}
                                    <Text style={[styles.label, { color: colors.textDim }]}>Description</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, minHeight: 80, textAlignVertical: "top" }]}
                                        placeholder="Add more details..."
                                        placeholderTextColor={colors.textDim}
                                        value={description}
                                        onChangeText={setDescription}
                                        multiline
                                    />

                                    {/* Status */}
                                    <Text style={[styles.label, { color: colors.textDim }]}>Status</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                                        {STATUS_OPTIONS.map((opt) => (
                                            <TouchableOpacity
                                                key={opt.id}
                                                style={[
                                                    styles.chip,
                                                    { backgroundColor: colors.background, borderColor: colors.border },
                                                    status === opt.id && { borderColor: opt.color, backgroundColor: getStatusBgColor(opt.id) }
                                                ]}
                                                onPress={() => setStatus(opt.id)}
                                            >
                                                <View style={[styles.dot, { backgroundColor: opt.color }]} />
                                                <Text style={[styles.chipText, { color: colors.textDim }, status === opt.id && { color: opt.color, fontFamily: FONTS.bold }]}>
                                                    {opt.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {/* Assignee - Restricted to Project Members only */}
                                    {renderMemberRow("Assignee", assigneeId, setAssigneeId, (m) => !m.isExternalAdmin)}

                                    {/* Reviewer - Restricted to Respective PM, Leads, and Workspace Admins */}
                                    {renderMemberRow("Reviewer", reviewerId, setReviewerId, (m) => {
                                        const pRole = m.role || m.projectRole;
                                        const wsRole = m.workspaceRole || m.workspaceMember?.workspaceRole;
                                        return (
                                            pRole === "PROJECT_MANAGER" ||
                                            pRole === "LEAD" ||
                                            wsRole === "OWNER" ||
                                            wsRole === "ADMIN"
                                        );
                                    })}

                                    {/* Tags */}
                                    {tags.length > 0 && (
                                        <>
                                            <Text style={[styles.label, { color: colors.textDim }]}>Tag</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                                                {tags.map((tag) => (
                                                    <TouchableOpacity
                                                        key={tag.id}
                                                        style={[
                                                            styles.chip,
                                                            { backgroundColor: colors.background, borderColor: colors.border },
                                                            tagId === tag.id && { borderColor: colors.primary, backgroundColor: colors.primary + "15" }
                                                        ]}
                                                        onPress={() => setTagId(tagId === tag.id ? null : tag.id)}
                                                    >
                                                        <Ionicons name="pricetag-outline" size={14} color={tagId === tag.id ? colors.primary : colors.textDim} />
                                                        <Text style={[styles.chipText, { color: colors.textDim }, tagId === tag.id && { color: colors.primary, fontFamily: FONTS.bold }]}>
                                                            {tag.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </>
                                    )}

                                    {/* Timeline */}
                                    {/* Start Date & Time */}
                                    <View style={styles.row}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.label, { color: colors.textDim }]}>Start Date</Text>
                                            <TouchableOpacity
                                                style={[styles.datePickerBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                                                onPress={() => setShowStartDatePicker(true)}
                                            >
                                                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                                                <Text style={[styles.dateText, { color: startDate ? colors.text : colors.textDim }]}>
                                                    {startDate ? format(startDate, "dd-MM-yyyy") : "DD-MM-YYYY"}
                                                </Text>
                                            </TouchableOpacity>
                                            <CalendarPicker
                                                visible={showStartDatePicker}
                                                onClose={() => setShowStartDatePicker(false)}
                                                onSelect={(date) => {
                                                    const newDate = startDate ? new Date(startDate) : new Date();
                                                    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                                                    setStartDate(newDate);
                                                    if (dueDate && isBefore(dueDate, newDate)) {
                                                        setDueDate(null);
                                                    }
                                                }}
                                                value={startDate}
                                                title="Select Start Date"
                                                minimumDate={startOfToday()}
                                            />
                                        </View>
                                        <View style={{ width: 16 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.label, { color: colors.textDim }]}>Start Time</Text>
                                            <TouchableOpacity
                                                style={[styles.datePickerBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                                                onPress={() => setShowStartTimePicker(true)}
                                            >
                                                <Ionicons name="time-outline" size={18} color={colors.primary} />
                                                <Text style={[styles.dateText, { color: startDate ? colors.text : colors.textDim }]}>
                                                    {startDate ? format(startDate, "hh:mm a") : "Select Time"}
                                                </Text>
                                            </TouchableOpacity>
                                            <TimeWheelPicker
                                                visible={showStartTimePicker}
                                                onClose={() => setShowStartTimePicker(false)}
                                                value={startDate}
                                                title="Select Start Time"
                                                minimumDate={isEditing ? null : new Date()}
                                                onSelect={(date) => {
                                                    setStartDate(date);
                                                    if (dueDate && isBefore(dueDate, date)) {
                                                        setDueDate(null);
                                                    }
                                                }}
                                            />
                                        </View>
                                    </View>

                                    {/* Due Date & Time */}
                                    <View style={[styles.row, { marginTop: 16 }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.label, { color: colors.textDim }]}>Due Date</Text>
                                            <TouchableOpacity
                                                style={[styles.datePickerBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                                                onPress={() => setShowDueDatePicker(true)}
                                            >
                                                <Ionicons name="calendar-outline" size={18} color="#ef4444" />
                                                <Text style={[styles.dateText, { color: dueDate ? colors.text : colors.textDim }]}>
                                                    {dueDate ? format(dueDate, "dd-MM-yyyy") : "DD-MM-YYYY"}
                                                </Text>
                                            </TouchableOpacity>
                                            <CalendarPicker
                                                visible={showDueDatePicker}
                                                onClose={() => setShowDueDatePicker(false)}
                                                onSelect={(date) => {
                                                    const newDate = dueDate ? new Date(dueDate) : new Date();
                                                    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                                                    setDueDate(newDate);
                                                }}
                                                value={dueDate}
                                                title="Select Due Date"
                                                minimumDate={startDate || startOfToday()}
                                            />
                                        </View>
                                        <View style={{ width: 16 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.label, { color: colors.textDim }]}>Due Time</Text>
                                            <TouchableOpacity
                                                style={[styles.datePickerBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                                                onPress={() => setShowDueTimePicker(true)}
                                            >
                                                <Ionicons name="time-outline" size={18} color="#ef4444" />
                                                <Text style={[styles.dateText, { color: dueDate ? colors.text : colors.textDim }]}>
                                                    {dueDate ? format(dueDate, "hh:mm a") : "Select Time"}
                                                </Text>
                                            </TouchableOpacity>
                                            <TimeWheelPicker
                                                visible={showDueTimePicker}
                                                onClose={() => setShowDueTimePicker(false)}
                                                value={dueDate}
                                                title="Select Due Time"
                                                accentIcon="flag-outline"
                                                minimumDate={startDate || (isEditing ? null : new Date())}
                                                onSelect={setDueDate}
                                            />
                                        </View>
                                    </View>

                                </>
                            )}

                            <View style={{ height: 40 }} />
                        </ScrollView>

                        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                            {error && <Text style={[styles.errorText, { marginBottom: 12, marginTop: 0 }]}>{error}</Text>}
                            <AppButton
                                label={isEditing ? "Save Changes" : "Create Sub Task"}
                                icon="save-outline"
                                onPress={handleSubmit}
                                loading={loading}
                                fullWidth
                                size="lg"
                                haptic="medium"
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    container: {
        width: "100%",
    },
    sheet: {
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        maxHeight: "90%",
    },
    header: {
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 8,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        paddingHorizontal: SPACING.lg,
    },
    titleLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: SCREEN_WIDTH < 380 ? 17 : 19,
        fontFamily: FONTS.bold,
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        padding: SPACING.lg,
    },
    label: {
        fontSize: 13,
        fontFamily: FONTS.semibold,
        marginBottom: 8,
        marginTop: 16,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    input: {
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        borderWidth: 1,
    },
    datePickerBtn: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
        gap: 10,
        height: 52,
    },
    dateText: {
        fontSize: 15,
        fontFamily: FONTS.medium,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    pickerContainer: {
        width: "100%",
        borderRadius: BORDER_RADIUS.lg,
        padding: 16,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    pickerHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    pickerTitle: {
        fontSize: 16,
        fontFamily: FONTS.bold,
    },
    parentList: {
        gap: 8,
    },
    parentItem: {
        flexDirection: "row",
        alignItems: "center",
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        gap: 12,
    },
    parentItemSelected: {
    },
    parentInfo: {
        flex: 1,
    },
    parentLabel: {
        fontSize: 14,
        fontFamily: FONTS.medium,
    },
    parentLabelSelected: {
        fontFamily: FONTS.bold,
    },
    parentProjectName: {
        fontSize: 11,
        marginTop: 2,
    },
    emptyState: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
    },
    emptyStateText: {
        fontSize: 13,
        flex: 1,
    },
    footer: {
        padding: SPACING.lg,
        borderTopWidth: 1,
    },
    createBtn: {
        borderRadius: BORDER_RADIUS.md,
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    createBtnDisabled: {
        opacity: 0.45,
    },
    createBtnText: {
        color: "#fff",
        fontSize: 16,
        fontFamily: FONTS.bold,
    },
    errorText: {
        color: "#ef4444",
        fontSize: 12,
        marginTop: 12,
        textAlign: "center",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
    },
    horizontalScroll: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        marginRight: 10,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    chipText: {
        fontSize: 14,
        fontFamily: FONTS.medium,
    },
    avatarChip: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 24,
        padding: 6,
        paddingRight: 16,
        borderWidth: 1,
        marginRight: 10,
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
    },
    avatarText: {
        color: "#fff",
        fontSize: 12,
        fontFamily: FONTS.bold,
    },
});
