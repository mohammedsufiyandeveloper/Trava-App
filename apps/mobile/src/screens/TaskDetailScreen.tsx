import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Image, TextInput, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Keyboard, UIManager, LayoutAnimation, Animated, Dimensions, Alert, Modal } from "react-native";

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from "react-native-safe-area-context";
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
import { Ionicons } from "@expo/vector-icons";
import { format, isBefore, isSameDay, startOfToday } from "date-fns";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useNotifications } from "../context/NotificationContext";
import { 
    getTaskComments, 
    postTaskComment, 
    getCachedSession, 
    getTaskById, 
    getSubTasks, 
    getTaskActivities,
    updateTask,
    getProjectMembers,
    getWorkspaceMembers,
    getTags
} from "../services/api";
import CreateSubTaskModal from "../components/CreateSubTaskModal";
import StatusPickerModal from "../components/StatusPickerModal";
import CalendarPicker from "../components/CalendarPicker";
import CreateTaskModal from "../components/CreateTaskModal";
import { RootStackParamList, Task } from "../types";
import { getStatusHex, getStatusBgColor } from "../utils/taskColors";
import { useResponsive } from "../hooks/useResponsive";

type Props = NativeStackScreenProps<RootStackParamList, "TaskDetail">;

export default function TaskDetailScreen({ route, navigation }: Props) {
    const { 
        taskId, 
        taskName, 
        notificationTitle, 
        notificationBody, 
        isSubtask, 
        taskData 
    } = route.params;
    const { tasks, activeWorkspace, tags, projects, refreshData } = useWorkspace();
    const { colors, isDark } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const { notifications } = useNotifications();

    const [activeTab, setActiveTab] = useState<"Messages" | "Activity" | "Deliverables">("Messages");
    const [comments, setComments] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [loadingComments, setLoadingComments] = useState(true);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [sendingComment, setSendingComment] = useState(false);
    const [fetchedTask, setFetchedTask] = useState<Task | null>(null);
    const [loadingTask, setLoadingTask] = useState(false);
    const [subTasks, setSubTasks] = useState<Task[]>([]);
    const [loadingSubTasks, setLoadingSubTasks] = useState(false);
    const [createSubTaskVisible, setCreateSubTaskVisible] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

    // Edit/Picker states
    const [statusPickerVisible, setStatusPickerVisible] = useState(false);
    const [assigneePickerVisible, setAssigneePickerVisible] = useState(false);
    const [tagPickerVisible, setTagPickerVisible] = useState(false);
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);
    const [editTaskModalVisible, setEditTaskModalVisible] = useState(false);
    const [editSubTaskModalVisible, setEditSubTaskModalVisible] = useState(false);

    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Subtask sliding sheet states
    const [isSubtaskSheetOpen, setIsSubtaskSheetOpen] = useState(false);
    const [subtaskTab, setSubtaskTab] = useState<"Messages" | "Activity">("Messages");
    const sheetAnim = useRef(new Animated.Value(0)).current;
    const subtaskScrollViewRef = useRef<ScrollView>(null);

    const openSubtaskSheet = (tab?: "Messages" | "Activity") => {
        if (tab) {
            setSubtaskTab(tab);
        }
        setIsSubtaskSheetOpen(true);
        Animated.spring(sheetAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
        }).start();
    };

    const closeSubtaskSheet = () => {
        Animated.spring(sheetAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
        }).start(() => {
            setIsSubtaskSheetOpen(false);
        });
    };

    const translateY = sheetAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [SCREEN_HEIGHT, 0],
    });

    const toggleHeader = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsHeaderCollapsed(!isHeaderCollapsed);
    };

    useEffect(() => {
        const showSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => {
            setKeyboardVisible(true);
        });
        const hideSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
            setKeyboardVisible(false);
        });
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // Auto-scroll ref
    const scrollViewRef = useRef<ScrollView>(null);

    const fetchSubTasks = async () => {
        try {
            setLoadingSubTasks(true);
            const data = await getSubTasks(taskId, activeWorkspace?.id || "", task?.projectId || "");
            setSubTasks(data);
        } catch (err) {
            console.error("Failed to load subtasks", err);
        } finally {
            setLoadingSubTasks(false);
        }
    };

    // Removed auto scrollToEnd on load so the top card remains visible.

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            const session = await getCachedSession();
            if (session?.user && isMounted) {
                setCurrentUserId(session.user.id);
            }

            try {
                if (isMounted) setLoadingComments(true);
                const data = await getTaskComments(taskId);
                if (isMounted) setComments(data);
            } catch (err) {
                console.error("Failed to load comments", err);
            } finally {
                if (isMounted) setLoadingComments(false);
            }

            try {
                if (isMounted) setLoadingActivities(true);
                const actData = await getTaskActivities(taskId);
                if (isMounted) setActivities(actData);
            } catch (err) {
                console.error("Failed to load activities", err);
            } finally {
                if (isMounted) setLoadingActivities(false);
            }
        };
        init();
        fetchSubTasks();
        return () => { isMounted = false; };
    }, [taskId, activeWorkspace?.id]);

    // Find task from context OR fetch directly (needed for subtasks not in global state)
    const taskFromContext = tasks.find((t: Task) => t.id === taskId);
    useEffect(() => {
        if (!taskFromContext) {
            setLoadingTask(true);
            getTaskById(taskId).then(t => {
                setFetchedTask(t);
                setLoadingTask(false);
            });
        }
    }, [taskId, taskFromContext]);

    const handleSend = async () => {
        if (!newMessage.trim() || sendingComment) return;
        setSendingComment(true);
        try {
            const res = await postTaskComment(taskId, newMessage);
            if (res.success && res.comment) {
                setComments(prev => [...prev, res.comment]);
                setNewMessage("");
                setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
            }
        } catch (err) {
            console.error("Error sending comment", err);
        } finally {
            setSendingComment(false);
        }
    };

    useEffect(() => {
        // Auto scroll to latest message when messages load
        if (activeTab === "Messages" && comments.length > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: false });
            }, 50);
        }
    }, [activeTab, comments.length]);

    const task = taskFromContext ?? fetchedTask;

    const reloadTask = useCallback(async () => {
        try {
            const t = await getTaskById(taskId);
            if (t) {
                setFetchedTask(t);
            }
            if (t && !t.parentTaskId) {
                const subData = await getSubTasks(taskId, activeWorkspace?.id || "", t.projectId || "");
                setSubTasks(subData);
            }
        } catch (e) {
            console.error("Failed to reload task details:", e);
        }
    }, [taskId, activeWorkspace?.id]);

    const handleUpdateTaskField = async (fields: any) => {
        try {
            const res = await updateTask(taskId, fields);
            if (res.success || res.id) {
                await reloadTask();
                await refreshData();
            } else {
                Alert.alert("Error", res.error || "Failed to update task details");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to update task details");
        }
    };

    useEffect(() => {
        const fetchMembers = async () => {
            if (task?.projectId && activeWorkspace?.id) {
                setLoadingMembers(true);
                try {
                    const [pMembers, wMembers] = await Promise.all([
                        getProjectMembers(task.projectId),
                        getWorkspaceMembers(activeWorkspace.id)
                    ]);
                    const merged = [...pMembers];
                    wMembers.forEach(wm => {
                        const isAlreadyIn = merged.some(m => m.userId === wm.userId);
                        if (!isAlreadyIn && (wm.workspaceRole === "OWNER" || wm.workspaceRole === "ADMIN")) {
                            merged.push({
                                userId: wm.userId,
                                name: wm.user.name,
                                image: wm.user.image,
                                role: "VIEWER",
                                workspaceRole: wm.workspaceRole,
                                user: wm.user,
                                isExternalAdmin: true
                            });
                        }
                    });
                    setProjectMembers(merged);
                } catch (e) {
                    console.error("Failed to load members in TaskDetailScreen:", e);
                } finally {
                    setLoadingMembers(false);
                }
            }
        };
        fetchMembers();
    }, [task?.projectId, activeWorkspace?.id]);

    useEffect(() => {
        if (route.params?.openMessages && task) {
            if (task.parentTaskId) {
                openSubtaskSheet("Messages");
            } else {
                setActiveTab("Messages");
            }
        }
    }, [route.params?.openMessages, task]);

    useEffect(() => {
        if (task?.parentTaskId && subtaskTab === "Messages" && comments.length > 0) {
            setTimeout(() => {
                subtaskScrollViewRef.current?.scrollToEnd({ animated: false });
            }, 50);
        }
    }, [subtaskTab, comments.length, isSubtaskSheetOpen, task?.parentTaskId]);

    const renderActivitiesList = () => {
        if (loadingActivities) {
            return <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />;
        }
        if (activities.length === 0) {
            return (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, marginTop: 30 }}>
                    <Text style={[styles.emptyContentText, { color: colors.textDim, textAlign: "center" }]}>No activity yet.</Text>
                </View>
            );
        }

        return (
            <View style={{ flex: 1, padding: SPACING.md, width: "100%" }}>
                {activities.map((item, index) => {
                    const authorSurname = item.author?.surname ? item.author.surname.split(" ")[0] : (item.author?.name || "Someone");
                    const dateFormatted = format(new Date(item.createdAt), "dd/MM/yyyy h:mm a");

                    let prevStatus = "";
                    let targetStatus = "";
                    try {
                        const attach = typeof item.attachment === "string" ? JSON.parse(item.attachment) : item.attachment;
                        prevStatus = attach?.previousStatus || "";
                        targetStatus = attach?.targetStatus || "";
                    } catch (e) { }

                    return (
                        <View
                            key={item.id || index}
                            style={[
                                styles.activityCard,
                                {
                                    backgroundColor: colors.surfaceHighlight,
                                    borderColor: colors.border,
                                }
                            ]}
                        >
                            <View style={styles.activityHeader}>
                                <View style={[styles.activityAvatar, { backgroundColor: colors.border }]}>
                                    <Text style={[styles.activityAvatarText, { color: colors.text }]}>
                                        {authorSurname.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.activityMeta}>
                                    <Text style={[styles.activityAuthorText, { color: colors.text }]}>
                                        {authorSurname}
                                    </Text>
                                    <Text style={[styles.activityDateText, { color: colors.textDim }]}>
                                        {dateFormatted}
                                    </Text>
                                </View>
                                <View style={[styles.activityBadge, { backgroundColor: isDark ? "#2d2112" : "#fef3c7", borderColor: isDark ? "#4d3a1e" : "#fde68a" }]}>
                                    <Text style={[styles.activityBadgeText, { color: isDark ? "#fbbf24" : "#b45309" }]}>
                                        Activity
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.activityContent}>
                                <Text style={[styles.activityText, { color: colors.text }]}>
                                    {item.text}
                                </Text>

                                {prevStatus && targetStatus && (
                                    <View style={styles.statusTransitionRow}>
                                        <View style={[styles.statusBubble, { backgroundColor: colors.border }]}>
                                            <Text style={[styles.statusBubbleText, { color: colors.text }]}>
                                                {prevStatus.replace("_", " ")}
                                            </Text>
                                        </View>
                                        <Ionicons name="arrow-forward" size={12} color={colors.textDim} style={{ marginHorizontal: 6 }} />
                                        <View style={[styles.statusBubble, { backgroundColor: colors.primary }]}>
                                            <Text style={[styles.statusBubbleText, { color: "#FFFFFF" }]}>
                                                {targetStatus.replace("_", " ")}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    if (!task) {
        if (loadingTask) {
            return (
                <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
                    <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                        <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                                <Ionicons name="arrow-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <View style={styles.titleContainer}>
                                <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{taskName}</Text>
                            </View>
                        </View>
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    </View>
                </SafeAreaView>
            );
        }

        // Find a sibling notification or activity for the same entityId that contains rich metadata (e.g. from creation log)
        const siblingWithMetadata = notifications?.find(n => 
            n.data?.entityId === taskId && 
            (n.data?.payload || n.data?.oldData || n.data?.newData)
        );

        const resolvedTaskData = taskData?.payload || taskData?.oldData || taskData?.newData 
            ? taskData 
            : siblingWithMetadata?.data;

        const hasArchiveContext = !!(notificationBody || taskData || resolvedTaskData);

        if (hasArchiveContext) {
            const previewName = resolvedTaskData?.payload?.name || resolvedTaskData?.oldData?.name || resolvedTaskData?.newData?.name || taskName;
            const previewStatus = resolvedTaskData?.payload?.status || resolvedTaskData?.oldData?.status || resolvedTaskData?.newData?.status || "DELETED";
            
            const previewProjectId = resolvedTaskData?.payload?.projectId || resolvedTaskData?.oldData?.projectId || resolvedTaskData?.newData?.projectId;
            const previewProject = projects.find((p: any) => p.id === previewProjectId);
            const previewProjectName = previewProject?.name || resolvedTaskData?.payload?.projectName || resolvedTaskData?.oldData?.projectName || resolvedTaskData?.newData?.projectName || "PROJECT";
            const previewProjectColor = previewProject?.color || colors.primary;

            const previewParentTaskName = resolvedTaskData?.payload?.parentTaskName || resolvedTaskData?.oldData?.parentTaskName || resolvedTaskData?.newData?.parentTaskName;

            const isSubtaskPreview = isSubtask || taskData?.entityType === "SUBTASK" || taskData?.action?.includes("SUBTASK") || resolvedTaskData?.entityType === "SUBTASK" || resolvedTaskData?.action?.includes("SUBTASK");

            const isCreation = taskData?.action === "SUBTASK_CREATED" || taskData?.action === "TASK_CREATED" || resolvedTaskData?.action === "SUBTASK_CREATED" || resolvedTaskData?.action === "TASK_CREATED" || notificationBody?.toLowerCase()?.includes("created");
            const isDeletion = taskData?.action === "SUBTASK_DELETED" || taskData?.action === "TASK_DELETED" || resolvedTaskData?.action === "SUBTASK_DELETED" || resolvedTaskData?.action === "TASK_DELETED" || notificationBody?.toLowerCase()?.includes("deleted");

            let activityHeader = "HISTORICAL ACTIVITY LOG";
            let activityDotColor = "#fbbf24";

            if (isDeletion) {
                activityHeader = "DELETION ACTIVITY LOG";
                activityDotColor = "#ef4444";
            } else if (isCreation) {
                activityHeader = "CREATION ACTIVITY LOG";
                activityDotColor = "#10b981";
            }

            const formattedDate = (resolvedTaskData?.createdAt || taskData?.createdAt)
                ? format(new Date(resolvedTaskData?.createdAt || taskData?.createdAt), "MMM dd, yyyy 'at' hh:mm a")
                : format(new Date(), "MMM dd, yyyy 'at' hh:mm a");

            return (
                <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
                    <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
                    <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                        
                        {/* Header with breadcrumbs matching the project */}
                        <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                                <Ionicons name="arrow-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <View style={styles.titleContainer}>
                                <View style={{ flexDirection: "column", alignItems: "flex-start", width: "100%" }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2, flexWrap: "wrap" }}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: previewProjectColor, marginRight: 6 }} />
                                        <Text style={[styles.title, { color: colors.textDim, fontSize: 11 }]} numberOfLines={1}>
                                            {previewProjectName.toUpperCase()}
                                        </Text>
                                        {previewParentTaskName && (
                                            <>
                                                <Ionicons name="chevron-forward" size={10} color={colors.textDim} style={{ marginHorizontal: 4 }} />
                                                <Text style={[styles.title, { color: colors.textDim, fontSize: 11 }]} numberOfLines={1}>
                                                    {previewParentTaskName.toUpperCase()}
                                                </Text>
                                            </>
                                        )}
                                    </View>
                                    <Text style={[styles.subtaskTitleText, { color: colors.text, fontSize: 16 }]} numberOfLines={1}>
                                        Archived {isSubtaskPreview ? "Subtask" : "Task"} Preview
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <ScrollView 
                            contentContainerStyle={{ padding: SPACING.lg, gap: 16 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Warning Alert Banner */}
                            <View style={[
                                styles.archiveBanner, 
                                { 
                                    backgroundColor: isDark ? "rgba(245, 158, 11, 0.1)" : "rgba(251, 191, 36, 0.15)",
                                    borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "rgba(251, 191, 36, 0.3)",
                                }
                            ]}>
                                <View style={[styles.archiveBannerIconBox, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "rgba(251, 191, 36, 0.2)" }]}>
                                    <Ionicons name="trash-outline" size={24} color={isDark ? "#fbbf24" : "#d97706"} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.archiveBannerTitle, { color: isDark ? "#fbbf24" : "#b45309" }]}>
                                        {isSubtaskPreview ? "Subtask Deleted" : "Task Deleted"}
                                    </Text>
                                    <Text style={[styles.archiveBannerText, { color: colors.text }]}>
                                        This {isSubtaskPreview ? "subtask" : "task"} was permanently deleted from the workspace. You are viewing a premium, read-only historical archive.
                                    </Text>
                                </View>
                            </View>

                            {/* High-Fidelity Details Card */}
                            <View style={[styles.archiveCardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12, marginBottom: 12 }}>
                                    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                                        {isSubtaskPreview ? "Subtask Title" : "Task Title"}
                                    </Text>
                                    <Text style={[styles.archiveTaskName, { color: colors.text }]}>{previewName}</Text>
                                </View>

                                <View style={{ gap: 12 }}>
                                    {isSubtaskPreview && previewParentTaskName && (
                                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                            <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textDim }}>Parent Task</Text>
                                            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }} numberOfLines={1}>{previewParentTaskName}</Text>
                                        </View>
                                    )}

                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textDim }}>Project Source</Text>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: previewProjectColor }} />
                                            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>{previewProjectName}</Text>
                                        </View>
                                    </View>

                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textDim }}>Last Known Status</Text>
                                        <View style={[
                                            styles.statusBadge, 
                                            { 
                                                backgroundColor: getStatusBgColor ? getStatusBgColor(previewStatus) : colors.surfaceHighlight,
                                                borderColor: getStatusHex ? getStatusHex(previewStatus) : colors.border
                                            }
                                        ]}>
                                            <Text style={[
                                                styles.statusBadgeText, 
                                                { color: getStatusHex ? getStatusHex(previewStatus) : colors.text }
                                            ]}>
                                                {previewStatus.replace("_", " ")}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textDim }}>Archive Level</Text>
                                        <View style={{ backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#ef4444" }}>READ ONLY PREVIEW</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Timeline Activity Section */}
                            {notificationBody && (
                                <View style={{ marginTop: 8 }}>
                                    <Text style={[styles.sectionTitle, { paddingHorizontal: 0, marginTop: 0, marginBottom: 8, color: colors.textDim }]}>
                                        {activityHeader}
                                    </Text>
                                    
                                    <View style={[styles.activityTimelineCard, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                                        <View style={{ flexDirection: "row", gap: 12 }}>
                                            <View style={{ alignItems: "center" }}>
                                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: activityDotColor, marginTop: 4 }} />
                                                <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4, minHeight: 40 }} />
                                            </View>
                                            
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, lineHeight: 20 }}>
                                                    {notificationBody}
                                                </Text>
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                                                    <Ionicons name="time-outline" size={13} color={colors.textDim} />
                                                    <Text style={{ fontSize: 12, color: colors.textDim }}>
                                                        {formattedDate}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}

                        </ScrollView>
                    </View>
                </SafeAreaView>
            );
        }

        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
                <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                    <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.titleContainer}>
                            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{taskName}</Text>
                        </View>
                    </View>
                    <View style={styles.center}>
                        <View style={[styles.center, { paddingHorizontal: 40, gap: 12 }]}>
                            <Ionicons name="alert-circle-outline" size={48} color={colors.textDim} />
                            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, textAlign: "center" }}>Task Not Found</Text>
                            <Text style={{ fontSize: 14, color: colors.textDim, textAlign: "center" }}>
                                This task could not be loaded. It may have been deleted or is not accessible.
                            </Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const resolvedProject = projects.find(p => p.id === task.projectId) || task.project;
    const resolvedParentTask = tasks.find(t => t.id === task.parentTaskId) || task.parentTask;

    const parentTaskName = resolvedParentTask?.name || task.parentTask?.name || "PARENT TASK";
    const projectName = resolvedProject?.name || task.project?.name || "PROJECT";
    const projectColor = resolvedProject?.color || task.project?.color || colors.primary;

    const breadcrumbs = [];
    if (projectName) breadcrumbs.push(projectName.toUpperCase());

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
            >
                <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

                <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.titleContainer}>
                            {task.parentTaskId ? (
                                <View style={{ flexDirection: "column", alignItems: "flex-start", width: "100%" }}>
                                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4, width: "100%" }}>
                                        {projectName ? (
                                            <View style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: 3,
                                                backgroundColor: projectColor,
                                                marginRight: 6,
                                                flexShrink: 0
                                            }} />
                                        ) : null}
                                        <Text
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                            style={{
                                                color: colors.textDim,
                                                fontSize: 10,
                                                fontWeight: "600",
                                                letterSpacing: 0.5,
                                                flex: 1
                                            }}
                                        >
                                            {projectName ? projectName.toUpperCase() : ""}
                                            {parentTaskName ? `${projectName ? " / " : ""}${parentTaskName.toUpperCase()}` : ""}
                                        </Text>
                                    </View>
                                    <Text style={[styles.subtaskTitleText, { color: colors.text }]} numberOfLines={2}>
                                        {task.name}
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    {breadcrumbs.length > 0 && (
                                        <Text style={[styles.breadcrumbText, { color: colors.text }]}>{breadcrumbs.join(" / ")} /</Text>
                                    )}
                                    <Text style={[styles.title, { color: colors.textDim }]} numberOfLines={2}>
                                        {taskName.toUpperCase()}
                                    </Text>
                                </>
                            )}
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <TouchableOpacity
                                style={{ padding: 4 }}
                                onPress={() => {
                                    if (task.parentTaskId) {
                                        setEditSubTaskModalVisible(true);
                                    } else {
                                        setEditTaskModalVisible(true);
                                    }
                                }}
                            >
                                <Ionicons name="create-outline" size={24} color={colors.textDim} />
                            </TouchableOpacity>
                            {!task.parentTaskId && activeTab === "Deliverables" && (
                                <TouchableOpacity
                                    style={[styles.headerActionBtn, { backgroundColor: colors.primary + "15", marginRight: 0 }]}
                                    onPress={() => setCreateSubTaskVisible(true)}
                                >
                                    <Ionicons name="add" size={22} color={colors.primary} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.moreBtn} onPress={() => navigation.goBack()}>
                                <Ionicons name="close" size={24} color={colors.textDim} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ flex: 1, backgroundColor: colors.background }}>
                        {task.parentTaskId ? (
                            // Subtask Details View (Full Screen)
                            <>
                                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: 80 }]}>
                                    {task.description ? (
                                        <Text style={[styles.taskDescription, { color: colors.text }]}>
                                            {task.description}
                                        </Text>
                                    ) : null}

                                    <Text style={[styles.sectionTitle, { color: colors.textDim }]}>DETAILS</Text>

                                    <View style={styles.detailsBox}>
                                        {/* Assignee Row */}
                                        <TouchableOpacity 
                                            activeOpacity={0.7} 
                                            onPress={() => setAssigneePickerVisible(true)}
                                            style={[styles.detailRow, { borderBottomColor: colors.border }]}
                                        >
                                            <View style={styles.detailLabelBox}>
                                                <Ionicons name="person-outline" size={16} color={colors.textDim} />
                                                <Text style={[styles.detailLabel, { color: colors.text }]}>Assignee</Text>
                                            </View>
                                            <View style={[styles.detailValueBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                                                {task.assignee ? (
                                                    <View style={styles.assigneeLine}>
                                                        <View style={styles.avatarFallback}>
                                                            <Text style={styles.avatarInitial}>{(task.assignee.surname?.[0] || task.assignee.name.charAt(0)).toUpperCase()}</Text>
                                                        </View>
                                                        <Text style={[styles.detailValueText, { color: colors.text }]}>
                                                            {task.assignee.surname ? task.assignee.surname.split(" ")[0] : task.assignee.name}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <Text style={[styles.detailValueText, { color: colors.textDim }]}>Unassigned</Text>
                                                )}
                                                <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                                            </View>
                                        </TouchableOpacity>

                                        {/* Start Date Row */}
                                        <TouchableOpacity 
                                            activeOpacity={0.7} 
                                            onPress={() => setShowStartDatePicker(true)}
                                            style={[styles.detailRow, { borderBottomColor: colors.border }]}
                                        >
                                            <View style={styles.detailLabelBox}>
                                                <Ionicons name="calendar-outline" size={16} color={colors.textDim} />
                                                <Text style={[styles.detailLabel, { color: colors.text }]}>Start Date</Text>
                                            </View>
                                            <View style={[styles.detailValueBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                                                <Text style={[styles.detailValueText, { color: colors.text }]}>
                                                    {task.startDate ? format(new Date(task.startDate), "dd-MM-yyyy") : "No Date"}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                                            </View>
                                        </TouchableOpacity>

                                        {/* Due Date Row */}
                                        <TouchableOpacity 
                                            activeOpacity={0.7} 
                                            onPress={() => setShowDueDatePicker(true)}
                                            style={[styles.detailRow, { borderBottomColor: colors.border }]}
                                        >
                                            <View style={styles.detailLabelBox}>
                                                <Ionicons name="calendar-outline" size={16} color={colors.textDim} />
                                                <Text style={[styles.detailLabel, { color: colors.text }]}>Due Date</Text>
                                            </View>
                                            <View style={[styles.detailValueBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                                                <Text style={[styles.detailValueText, { color: colors.text }]}>
                                                    {task.dueDate ? format(new Date(task.dueDate), "dd-MM-yyyy") : "No Date"}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                                            </View>
                                        </TouchableOpacity>

                                        {/* Tag Row */}
                                        <TouchableOpacity 
                                            activeOpacity={0.7} 
                                            onPress={() => setTagPickerVisible(true)}
                                            style={[styles.detailRow, { borderBottomColor: colors.border }]}
                                        >
                                            <View style={styles.detailLabelBox}>
                                                <Ionicons name="pricetag-outline" size={16} color={colors.textDim} />
                                                <Text style={[styles.detailLabel, { color: colors.text }]}>Tag</Text>
                                            </View>
                                            <View style={[styles.detailValueBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                                                {(() => {
                                                    const allTags = task.tags || [];
                                                    if (allTags.length === 0) {
                                                        const tagObj = task.tag || (task as any).Tag || (task as any).taskTag || (Array.isArray((task as any).tags) ? (task as any).tags[0] : null);
                                                        const tagId = task.tagId || (tagObj && typeof tagObj === 'object' ? tagObj.id : null);
                                                        const tagName = (typeof tagObj === 'string' ? tagObj : null) ||
                                                            (tagObj && typeof tagObj === 'object' ? tagObj.name : null) ||
                                                            (tagId ? tags.find(t => String(t.id) === String(tagId))?.name : null) ||
                                                            (task as any).tagName;
                                                        if (tagName) allTags.push({ id: tagId || tagName, name: tagName });
                                                    }

                                                    return allTags.length > 0 ? (
                                                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                                                            {allTags.map((t, idx) => (
                                                                <View key={t.id || idx} style={[styles.tagBadge, { backgroundColor: colors.surfaceHighlight }]}>
                                                                    <Text style={[styles.tagBadgeText, { color: colors.textDim }]}>{t.name}</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    ) : (
                                                        <Text style={[styles.detailValueText, { color: colors.textDim }]}>None</Text>
                                                    );
                                                })()}
                                                <Ionicons name="chevron-forward" size={14} color={colors.textDim} style={{ marginLeft: 8 }} />
                                            </View>
                                        </TouchableOpacity>

                                        {/* Status Row */}
                                        <TouchableOpacity 
                                            activeOpacity={0.7} 
                                            onPress={() => setStatusPickerVisible(true)}
                                            style={[styles.detailRow, { borderBottomColor: colors.border }]}
                                        >
                                            <View style={styles.detailLabelBox}>
                                                <Ionicons name="document-text-outline" size={16} color={colors.textDim} />
                                                <Text style={[styles.detailLabel, { color: colors.text }]}>Status</Text>
                                            </View>
                                            <View style={[styles.detailValueBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                                                <View style={[
                                                    styles.statusBadge,
                                                    {
                                                        borderColor: getStatusHex(task.status),
                                                        backgroundColor: getStatusBgColor(task.status)
                                                    }
                                                ]}>
                                                    <Text style={[
                                                        styles.statusBadgeText,
                                                        { color: getStatusHex(task.status) }
                                                    ]}>
                                                        {(task.status ?? "TO_DO").replace("_", " ")}
                                                    </Text>
                                                </View>
                                                <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>

                                {/* Persistent Bottom Bar for Subtask */}
                                <View style={[styles.subtaskBottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                                    <View style={styles.subtaskBottomBarTabs}>
                                        <TouchableOpacity
                                            style={styles.subtaskBottomBarTabBtn}
                                            onPress={() => openSubtaskSheet("Messages")}
                                        >
                                            <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
                                            <Text style={[styles.subtaskBottomBarTabText, { color: colors.text }]}>Messages</Text>
                                            <View style={[styles.countPill, { backgroundColor: colors.surfaceHighlight }]}>
                                                <Text style={[styles.countPillText, { color: colors.textDim }]}>{comments.length}</Text>
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.subtaskBottomBarTabBtn}
                                            onPress={() => openSubtaskSheet("Activity")}
                                        >
                                            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                                            <Text style={[styles.subtaskBottomBarTabText, { color: colors.text }]}>Activity</Text>
                                            <View style={[styles.countPill, { backgroundColor: colors.surfaceHighlight }]}>
                                                <Text style={[styles.countPillText, { color: colors.textDim }]}>{activities.length}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.subtaskBottomBarArrowBtn}
                                        onPress={() => openSubtaskSheet()}
                                    >
                                        <Ionicons name="chevron-up" size={24} color={colors.primary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Sliding Overlay Sheet for Subtask Messages/Reviews */}
                                <Animated.View style={[
                                    styles.subtaskSheet,
                                    {
                                        backgroundColor: colors.background,
                                        transform: [{ translateY }],
                                        zIndex: isSubtaskSheetOpen ? 100 : -1,
                                    }
                                ]}
                                    pointerEvents={isSubtaskSheetOpen ? "auto" : "none"}
                                >
                                    {/* Sheet Header */}
                                    <View style={[styles.subtaskSheetHeader, { borderBottomColor: colors.border }]}>
                                        <View style={styles.subtaskSheetTabs}>
                                            <TouchableOpacity
                                                style={[styles.subtaskSheetTabBtn, subtaskTab === "Messages" && [styles.subtaskSheetTabBtnActive, { borderBottomColor: colors.primary }]]}
                                                onPress={() => setSubtaskTab("Messages")}
                                            >
                                                <Ionicons name="chatbubble-outline" size={16} color={subtaskTab === "Messages" ? colors.primary : colors.textDim} />
                                                <Text style={[styles.subtaskSheetTabText, { color: colors.textDim }, subtaskTab === "Messages" && { color: colors.primary }]}>Messages</Text>
                                                <View style={[styles.countPill, { backgroundColor: colors.surfaceHighlight }]}>
                                                    <Text style={[styles.countPillText, { color: colors.textDim }]}>{comments.length}</Text>
                                                </View>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.subtaskSheetTabBtn, subtaskTab === "Activity" && [styles.subtaskSheetTabBtnActive, { borderBottomColor: colors.primary }]]}
                                                onPress={() => setSubtaskTab("Activity")}
                                            >
                                                <Ionicons name="document-text-outline" size={16} color={subtaskTab === "Activity" ? colors.primary : colors.textDim} />
                                                <Text style={[styles.subtaskSheetTabText, { color: colors.textDim }, subtaskTab === "Activity" && { color: colors.primary }]}>Activity</Text>
                                                <View style={[styles.countPill, { backgroundColor: colors.surfaceHighlight }]}>
                                                    <Text style={[styles.countPillText, { color: colors.textDim }]}>{activities.length}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.subtaskSheetCloseBtn}
                                            onPress={closeSubtaskSheet}
                                        >
                                            <Ionicons name="chevron-down" size={24} color={colors.primary} />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Content Area within Sheet */}
                                    <ScrollView
                                        ref={subtaskScrollViewRef}
                                        style={{ flex: 1, backgroundColor: subtaskTab === "Messages" ? (isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)") : colors.background }}
                                        showsVerticalScrollIndicator={false}
                                        onContentSizeChange={(w, h) => {
                                            if (subtaskTab === "Messages") {
                                                subtaskScrollViewRef.current?.scrollToEnd({ animated: false });
                                            }
                                        }}
                                    >
                                        <View style={[styles.tabContentArea, subtaskTab === "Messages" && { padding: 0, alignItems: "stretch" }]}>
                                            {subtaskTab === "Activity" ? (
                                                renderActivitiesList()
                                            ) : (
                                                loadingComments ? (
                                                    <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                                                ) : comments.length === 0 ? (
                                                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, marginTop: 30 }}>
                                                        <Text style={[styles.emptyContentText, { color: colors.textDim, textAlign: "center" }]}>No messages yet. Start the conversation!</Text>
                                                    </View>
                                                ) : (
                                                    <View style={{ flex: 1, padding: SPACING.md }}>
                                                        {comments.map((item, index) => {
                                                            const isMine = item.userId === currentUserId || item.user?.id === currentUserId;

                                                            // Date separation logic
                                                            const currentMsgDate = format(new Date(item.createdAt), "MMMM d, yyyy");
                                                            const prevMsg = index > 0 ? comments[index - 1] : null;
                                                            const prevMsgDate = prevMsg ? format(new Date(prevMsg.createdAt), "MMMM d, yyyy") : null;
                                                            const showDateHeader = currentMsgDate !== prevMsgDate;

                                                            const authorSurname = item.user?.surname ? item.user.surname.split(" ")[0] : item.user?.name;

                                                            return (
                                                                <React.Fragment key={item.id || index}>
                                                                    {showDateHeader && (
                                                                        <View style={styles.dateSeparatorBox}>
                                                                            <Text style={[styles.dateSeparatorText, { color: colors.textDim }]}>
                                                                                {currentMsgDate.toUpperCase()}
                                                                            </Text>
                                                                        </View>
                                                                    )}
                                                                    <View style={[styles.messageRow, isMine ? styles.messageMineRow : styles.messageOtherRow]}>
                                                                        {!isMine && (
                                                                            <View style={[styles.messageAvatar, { backgroundColor: colors.border }]}>
                                                                                <Text style={[styles.messageAvatarText, { color: colors.text }]}>{authorSurname?.charAt(0) || "U"}</Text>
                                                                            </View>
                                                                        )}
                                                                        <View style={[
                                                                            styles.messageBubble,
                                                                            isMine
                                                                                ? [styles.messageMineBubble, { backgroundColor: colors.primary }]
                                                                                : [styles.messageOtherBubble, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]
                                                                        ]}>
                                                                            {!isMine && (
                                                                                <Text style={[styles.messageAuthor, { color: colors.primary }]}>{authorSurname || "Member"}</Text>
                                                                            )}
                                                                            <Text style={[styles.messageText, { color: isMine ? "#fff" : colors.text }]}>{item.content}</Text>
                                                                            <Text style={[styles.messageTime, { color: isMine ? "rgba(255,255,255,0.7)" : colors.textDim }]}>
                                                                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </Text>
                                                                        </View>
                                                                    </View>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </View>
                                                )
                                            )}
                                        </View>
                                    </ScrollView>

                                    {/* Message Input within Sheet */}
                                    {subtaskTab === "Messages" && (
                                        <View style={[styles.inputArea, {
                                            borderTopColor: colors.border,
                                            backgroundColor: colors.surface,
                                            paddingBottom: isKeyboardVisible ? SPACING.md : 12
                                        }]}>
                                            <View style={[styles.inputBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                                <TextInput
                                                    style={[styles.input, { color: colors.text }]}
                                                    placeholder="Type your message..."
                                                    placeholderTextColor={colors.textDim}
                                                    value={newMessage}
                                                    onChangeText={setNewMessage}
                                                    multiline
                                                />
                                            </View>
                                            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }, (!newMessage.trim() || sendingComment) && { opacity: 0.5 }]} disabled={!newMessage.trim() || sendingComment} onPress={handleSend}>
                                                {sendingComment ? (
                                                    <ActivityIndicator color="#fff" size="small" />
                                                ) : (
                                                    <Ionicons name="arrow-up" size={18} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </Animated.View>
                            </>
                        ) : (
                            // Regular Task Layout
                            <>
                                <View style={{ flex: 1, backgroundColor: colors.background }}>
                                    {!isHeaderCollapsed && (
                                        <ScrollView style={{ maxHeight: '40%', flexShrink: 0 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                                            {task.description ? (
                                                <Text style={[styles.taskDescription, { color: colors.text }]}>
                                                    {task.description}
                                                </Text>
                                            ) : null}

                                            <Text style={[styles.sectionTitle, { color: colors.textDim }]}>DETAILS</Text>

                                            <View style={styles.detailsBox}>
                                                {/* Assignee Row */}
                                                <TouchableOpacity 
                                                    activeOpacity={0.7} 
                                                    onPress={() => setAssigneePickerVisible(true)}
                                                    style={[styles.detailRow, { borderBottomColor: colors.border }]}
                                                >
                                                    <View style={styles.detailLabelBox}>
                                                        <Ionicons name="person-outline" size={16} color={colors.textDim} />
                                                        <Text style={[styles.detailLabel, { color: colors.text }]}>Assignee</Text>
                                                    </View>
                                                    <View style={[styles.detailValueBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                                                        {task.assignee ? (
                                                            <View style={styles.assigneeLine}>
                                                                <View style={styles.avatarFallback}>
                                                                    <Text style={styles.avatarInitial}>{(task.assignee.surname?.[0] || task.assignee.name.charAt(0)).toUpperCase()}</Text>
                                                                </View>
                                                                <Text style={[styles.detailValueText, { color: colors.text }]}>
                                                                    {task.assignee.surname ? task.assignee.surname.split(" ")[0] : task.assignee.name}
                                                                </Text>
                                                            </View>
                                                        ) : (
                                                            <Text style={[styles.detailValueText, { color: colors.textDim }]}>Unassigned</Text>
                                                        )}
                                                        <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                                                    </View>
                                                </TouchableOpacity>

                                                {/* Start Date Row */}
                                                <TouchableOpacity 
                                                    activeOpacity={0.7} 
                                                    onPress={() => setShowStartDatePicker(true)}
                                                    style={[styles.detailRow, { borderBottomColor: colors.border }]}
                                                >
                                                    <View style={styles.detailLabelBox}>
                                                        <Ionicons name="calendar-outline" size={16} color={colors.textDim} />
                                                        <Text style={[styles.detailLabel, { color: colors.text }]}>Start Date</Text>
                                                    </View>
                                                    <View style={[styles.detailValueBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                                                        <Text style={[styles.detailValueText, { color: colors.text }]}>
                                                            {task.startDate ? format(new Date(task.startDate), "dd-MM-yyyy") : "No Date"}
                                                        </Text>
                                                        <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                                                    </View>
                                                </TouchableOpacity>

                                                {/* Due Date Row */}
                                                <TouchableOpacity 
                                                    activeOpacity={0.7} 
                                                    onPress={() => setShowDueDatePicker(true)}
                                                    style={[styles.detailRow, { borderBottomColor: colors.border }]}
                                                >
                                                    <View style={styles.detailLabelBox}>
                                                        <Ionicons name="calendar-outline" size={16} color={colors.textDim} />
                                                        <Text style={[styles.detailLabel, { color: colors.text }]}>Due Date</Text>
                                                    </View>
                                                    <View style={[styles.detailValueBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                                                        <Text style={[styles.detailValueText, { color: colors.text }]}>
                                                            {task.dueDate ? format(new Date(task.dueDate), "dd-MM-yyyy") : "No Date"}
                                                        </Text>
                                                        <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                                                    </View>
                                                </TouchableOpacity>

                                                {/* Tag Row */}
                                                <TouchableOpacity 
                                                    activeOpacity={0.7} 
                                                    onPress={() => setTagPickerVisible(true)}
                                                    style={[styles.detailRow, { borderBottomColor: colors.border }]}
                                                >
                                                    <View style={styles.detailLabelBox}>
                                                        <Ionicons name="pricetag-outline" size={16} color={colors.textDim} />
                                                        <Text style={[styles.detailLabel, { color: colors.text }]}>Tag</Text>
                                                    </View>
                                                    <View style={[styles.detailValueBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                                                        {(() => {
                                                            const allTags = task.tags || [];
                                                            if (allTags.length === 0) {
                                                                const tagObj = task.tag || (task as any).Tag || (task as any).taskTag || (Array.isArray((task as any).tags) ? (task as any).tags[0] : null);
                                                                const tagId = task.tagId || (tagObj && typeof tagObj === 'object' ? tagObj.id : null);
                                                                const tagName = (typeof tagObj === 'string' ? tagObj : null) ||
                                                                    (tagObj && typeof tagObj === 'object' ? tagObj.name : null) ||
                                                                    (tagId ? tags.find(t => String(t.id) === String(tagId))?.name : null) ||
                                                                    (task as any).tagName;
                                                                if (tagName) allTags.push({ id: tagId || tagName, name: tagName });
                                                            }

                                                            return allTags.length > 0 ? (
                                                                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                                                                    {allTags.map((t, idx) => (
                                                                        <View key={t.id || idx} style={[styles.tagBadge, { backgroundColor: colors.surfaceHighlight }]}>
                                                                            <Text style={[styles.tagBadgeText, { color: colors.textDim }]}>{t.name}</Text>
                                                                        </View>
                                                                    ))}
                                                                </View>
                                                            ) : (
                                                                <Text style={[styles.detailValueText, { color: colors.textDim }]}>None</Text>
                                                            );
                                                        })()}
                                                        <Ionicons name="chevron-forward" size={14} color={colors.textDim} style={{ marginLeft: 8 }} />
                                                    </View>
                                                </TouchableOpacity>

                                                {/* Status Row */}
                                                <TouchableOpacity 
                                                    activeOpacity={0.7} 
                                                    onPress={() => setStatusPickerVisible(true)}
                                                    style={[styles.detailRow, { borderBottomColor: colors.border }]}
                                                >
                                                    <View style={styles.detailLabelBox}>
                                                        <Ionicons name="document-text-outline" size={16} color={colors.textDim} />
                                                        <Text style={[styles.detailLabel, { color: colors.text }]}>Status</Text>
                                                    </View>
                                                    <View style={[styles.detailValueBox, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                                                        <View style={[
                                                            styles.statusBadge,
                                                            {
                                                                borderColor: getStatusHex(task.status),
                                                                backgroundColor: getStatusBgColor(task.status)
                                                            }
                                                        ]}>
                                                            <Text style={[
                                                                styles.statusBadgeText,
                                                                { color: getStatusHex(task.status) }
                                                            ]}>
                                                                {(task.status ?? "TO_DO").replace("_", " ")}
                                                            </Text>
                                                        </View>
                                                        <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                                                    </View>
                                                </TouchableOpacity>
                                            </View>

                                            {!task.parentTaskId && subTasks.length > 0 && activeTab !== "Deliverables" && (
                                                <TouchableOpacity
                                                    style={[styles.subtasksBtn, { backgroundColor: colors.surfaceHighlight }]}
                                                    onPress={() => setActiveTab("Deliverables")}
                                                >
                                                    <Ionicons name="list" size={16} color={colors.primary} />
                                                    <Text style={[styles.subtasksBtnText, { color: colors.primary }]}>View {subTasks.length} Deliverables</Text>
                                                    <Ionicons name="chevron-forward" size={16} color={colors.primary} style={{ marginLeft: "auto" }} />
                                                </TouchableOpacity>
                                            )}

                                            {/* Tabs */}
                                            <View style={[styles.tabBar, { borderBottomColor: colors.border, paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                                                {!task.parentTaskId && (
                                                    <TouchableOpacity
                                                        style={[styles.tabBtn, activeTab === "Deliverables" && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
                                                        onPress={() => setActiveTab("Deliverables")}
                                                    >
                                                        <Ionicons name="git-branch-outline" size={16} color={activeTab === "Deliverables" ? colors.primary : colors.textDim} />
                                                        <Text style={[styles.tabText, { color: colors.textDim }, activeTab === "Deliverables" && [styles.tabTextActive, { color: colors.primary }]]}>Deliverables</Text>
                                                        <View style={[styles.countPill, { backgroundColor: colors.surfaceHighlight }]}>
                                                            <Text style={[styles.countPillText, { color: colors.textDim }]}>{subTasks.length}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                )}

                                                <TouchableOpacity
                                                    style={[styles.tabBtn, activeTab === "Messages" && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
                                                    onPress={() => setActiveTab("Messages")}
                                                >
                                                    <Ionicons name="chatbubble-outline" size={16} color={activeTab === "Messages" ? colors.primary : colors.textDim} />
                                                    <Text style={[styles.tabText, { color: colors.textDim }, activeTab === "Messages" && [styles.tabTextActive, { color: colors.primary }]]}>Messages</Text>
                                                    <View style={[styles.countPill, { backgroundColor: colors.surfaceHighlight }]}>
                                                        <Text style={[styles.countPillText, { color: colors.textDim }]}>{comments.length}</Text>
                                                    </View>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.tabBtn, activeTab === "Activity" && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
                                                    onPress={() => setActiveTab("Activity")}
                                                >
                                                    <Ionicons name="document-text-outline" size={16} color={activeTab === "Activity" ? colors.primary : colors.textDim} />
                                                    <Text style={[styles.tabText, { color: colors.textDim }, activeTab === "Activity" && [styles.tabTextActive, { color: colors.primary }]]}>Activity</Text>
                                                    <View style={[styles.countPill, { backgroundColor: colors.surfaceHighlight }]}>
                                                        <Text style={[styles.countPillText, { color: colors.textDim }]}>{activities.length}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            </View>
                                        </ScrollView>
                                    )}

                                    <TouchableOpacity
                                        style={[styles.collapseBtn, { backgroundColor: colors.surfaceHighlight }]}
                                        onPress={toggleHeader}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name={isHeaderCollapsed ? "chevron-down" : "chevron-up"} size={20} color={colors.primary} />
                                        <Text style={[styles.collapseBtnText, { color: colors.primary }]}>
                                            {isHeaderCollapsed ? "Show Task Details" : "Collapse Task Details"}
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Content Area */}
                                    <ScrollView
                                        ref={scrollViewRef}
                                        style={{ flex: 1 }}
                                        showsVerticalScrollIndicator={false}
                                        onContentSizeChange={(w, h) => {
                                            if (activeTab === "Messages") {
                                                scrollViewRef.current?.scrollToEnd({ animated: false });
                                            }
                                        }}
                                    >
                                        <View style={[styles.tabContentArea, (activeTab === "Messages" || activeTab === "Deliverables") && { padding: 0, alignItems: "stretch" }]}>
                                            {activeTab === "Activity" ? (
                                                renderActivitiesList()
                                            ) : activeTab === "Deliverables" ? (
                                                loadingSubTasks ? (
                                                    <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                                                ) : subTasks.length === 0 ? (
                                                    <View style={styles.emptyTabBox}>
                                                        <Ionicons name="git-branch-outline" size={48} color={colors.textDim} />
                                                        <Text style={[styles.emptyContentText, { color: colors.textDim, marginTop: 12, textAlign: "center" }]}>No deliverables yet.</Text>
                                                        <TouchableOpacity
                                                            style={[styles.createDeliverableBtn, { backgroundColor: colors.primary }]}
                                                            onPress={() => setCreateSubTaskVisible(true)}
                                                        >
                                                            <Text style={styles.createDeliverableBtnText}>Create Deliverable</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : (
                                                    <View style={styles.subtasksList}>
                                                        {subTasks.map((item) => (
                                                            <TouchableOpacity
                                                                key={item.id}
                                                                style={[styles.subtaskCard, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}
                                                                onPress={() => navigation.push("TaskDetail", { taskId: item.id, taskName: item.name })}
                                                            >
                                                                <View style={styles.subtaskMain}>
                                                                    <Ionicons name="return-down-forward" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                                                                    <Text style={[styles.subtaskName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                                                                    <View style={[styles.miniStatus, { backgroundColor: getStatusBgColor(item.status) }]}>
                                                                        <Text style={[styles.miniStatusText, { color: getStatusHex(item.status) }]}>{item.status.charAt(0)}</Text>
                                                                    </View>
                                                                </View>
                                                                <View style={styles.subtaskFooter}>
                                                                    <Text style={[styles.subtaskMeta, { color: colors.textDim }]}>
                                                                        {(item.assignee?.surname ? item.assignee.surname.split(" ")[0] : item.assignee?.name) || "Unassigned"} • {item.dueDate ? format(new Date(item.dueDate), "dd-MM-yyyy") : "No date"}
                                                                    </Text>
                                                                    <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
                                                                </View>
                                                            </TouchableOpacity>
                                                        ))}
                                                        <TouchableOpacity
                                                            style={[styles.addSubtaskSmallBtn, { borderColor: colors.border }]}
                                                            onPress={() => setCreateSubTaskVisible(true)}
                                                        >
                                                            <Ionicons name="add" size={16} color={colors.primary} />
                                                            <Text style={[styles.addSubtaskSmallText, { color: colors.primary }]}>Add Deliverable</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )
                                            ) : (
                                                loadingComments ? (
                                                    <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                                                ) : comments.length === 0 ? (
                                                    <Text style={[styles.emptyContentText, { color: colors.textDim, marginTop: 20 }]}>No messages yet. Start the conversation!</Text>
                                                ) : (
                                                    <View style={{ flex: 1, minHeight: 250, padding: SPACING.md, backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)" }}>
                                                        {comments.map((item, index) => {
                                                            const isMine = item.userId === currentUserId || item.user?.id === currentUserId;

                                                            // Date separation logic
                                                            const currentMsgDate = format(new Date(item.createdAt), "MMMM d, yyyy");
                                                            const prevMsg = index > 0 ? comments[index - 1] : null;
                                                            const prevMsgDate = prevMsg ? format(new Date(prevMsg.createdAt), "MMMM d, yyyy") : null;
                                                            const showDateHeader = currentMsgDate !== prevMsgDate;

                                                            const authorSurname = item.user?.surname ? item.user.surname.split(" ")[0] : item.user?.name;

                                                            return (
                                                                <React.Fragment key={item.id || index}>
                                                                    {showDateHeader && (
                                                                        <View style={styles.dateSeparatorBox}>
                                                                            <Text style={[styles.dateSeparatorText, { color: colors.textDim }]}>
                                                                                {currentMsgDate.toUpperCase()}
                                                                            </Text>
                                                                        </View>
                                                                    )}
                                                                    <View style={[styles.messageRow, isMine ? styles.messageMineRow : styles.messageOtherRow]}>
                                                                        {!isMine && (
                                                                            <View style={[styles.messageAvatar, { backgroundColor: colors.border }]}>
                                                                                <Text style={[styles.messageAvatarText, { color: colors.text }]}>{authorSurname?.charAt(0) || "U"}</Text>
                                                                            </View>
                                                                        )}
                                                                        <View style={[
                                                                            styles.messageBubble,
                                                                            isMine
                                                                                ? [styles.messageMineBubble, { backgroundColor: colors.primary }]
                                                                                : [styles.messageOtherBubble, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]
                                                                        ]}>
                                                                            {!isMine && (
                                                                                <Text style={[styles.messageAuthor, { color: colors.primary }]}>{authorSurname || "Member"}</Text>
                                                                            )}
                                                                            <Text style={[styles.messageText, { color: isMine ? "#fff" : colors.text }]}>{item.content}</Text>
                                                                            <Text style={[styles.messageTime, { color: isMine ? "rgba(255,255,255,0.7)" : colors.textDim }]}>
                                                                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </Text>
                                                                        </View>
                                                                    </View>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </View>
                                                )
                                            )}
                                        </View>
                                    </ScrollView>
                                </View>
                            </>
                        )}
                    </View>

                    {!task.parentTaskId && activeTab === "Messages" && (
                        <View style={[styles.inputArea, {
                            borderTopColor: colors.border,
                            backgroundColor: colors.surface,
                            paddingBottom: isKeyboardVisible ? SPACING.md : 12
                        }]}>
                            <View style={[styles.inputBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    placeholder="Type your message..."
                                    placeholderTextColor={colors.textDim}
                                    value={newMessage}
                                    onChangeText={setNewMessage}
                                    multiline
                                />
                            </View>
                            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }, (!newMessage.trim() || sendingComment) && { opacity: 0.5 }]} disabled={!newMessage.trim() || sendingComment} onPress={handleSend}>
                                {sendingComment ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Ionicons name="arrow-up" size={18} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>

            <CreateSubTaskModal
                visible={createSubTaskVisible}
                onClose={() => {
                    setCreateSubTaskVisible(false);
                    fetchSubTasks();
                }}
                initialParentId={taskId}
                initialProjectId={task?.projectId}
                initialParentName={task?.name}
            />

            <StatusPickerModal
                visible={statusPickerVisible}
                onClose={() => setStatusPickerVisible(false)}
                onSelect={(newStatus) => handleUpdateTaskField({ status: newStatus })}
                currentStatus={task?.status ?? "TO_DO"}
            />

            <CalendarPicker
                visible={showStartDatePicker}
                onClose={() => setShowStartDatePicker(false)}
                onSelect={(date) => {
                    handleUpdateTaskField({ startDate: date ? date.toISOString() : null });
                }}
                value={task?.startDate ? new Date(task.startDate) : null}
                title="Select Start Date"
            />

            <CalendarPicker
                visible={showDueDatePicker}
                onClose={() => setShowDueDatePicker(false)}
                onSelect={(date) => {
                    handleUpdateTaskField({ dueDate: date ? date.toISOString() : null });
                }}
                value={task?.dueDate ? new Date(task.dueDate) : null}
                title="Select Due Date"
            />

            <AssigneePickerModal
                visible={assigneePickerVisible}
                onClose={() => setAssigneePickerVisible(false)}
                currentAssigneeId={task?.assignee?.id || null}
                members={projectMembers}
                onSelect={(userId) => {
                    handleUpdateTaskField({ assigneeUserId: userId });
                }}
            />

            <TagPickerModal
                visible={tagPickerVisible}
                onClose={() => setTagPickerVisible(false)}
                currentTagId={task?.tagId || null}
                tags={tags}
                onSelect={(tagId) => {
                    handleUpdateTaskField({ tagId: tagId });
                }}
            />

            <CreateTaskModal
                visible={editTaskModalVisible}
                onClose={() => {
                    setEditTaskModalVisible(false);
                    reloadTask();
                }}
                initialProjectId={task?.projectId}
                editingTask={task}
            />

            <CreateSubTaskModal
                visible={editSubTaskModalVisible}
                onClose={() => {
                    setEditSubTaskModalVisible(false);
                    reloadTask();
                }}
                initialParentId={task?.parentTaskId || undefined}
                initialProjectId={task?.projectId || undefined}
                editingTask={task}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    archiveBanner: {
        flexDirection: "row",
        padding: 16,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        gap: 12,
        alignItems: "flex-start",
    },
    archiveBannerIconBox: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: "center",
        alignItems: "center",
    },
    archiveBannerTitle: {
        fontSize: 15,
        fontWeight: "700",
        marginBottom: 4,
    },
    archiveBannerText: {
        fontSize: 13,
        lineHeight: 18,
        opacity: 0.8,
    },
    archiveCardContainer: {
        padding: 16,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    archiveTaskName: {
        fontSize: 18,
        fontWeight: "700",
        lineHeight: 24,
    },
    activityTimelineCard: {
        padding: 16,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
    },

    header: { flexDirection: "row", paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, alignItems: "flex-start" },
    backBtn: { padding: 4, marginRight: 12 },
    titleContainer: { flex: 1 },
    breadcrumbText: { fontSize: 18, fontWeight: "700", lineHeight: 26 },
    title: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginTop: 1, textTransform: "uppercase" },
    subtaskTitleText: { fontSize: 18, fontWeight: "700", lineHeight: 24 },
    moreBtn: { padding: 4, marginLeft: 12 },

    content: { paddingBottom: SPACING.bottomTabBar },
    taskDescription: { fontSize: 15, lineHeight: 22, paddingHorizontal: SPACING.lg, marginTop: SPACING.lg, opacity: 0.9 },

    sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: SPACING.xl, marginBottom: SPACING.sm, paddingHorizontal: SPACING.lg },

    detailsBox: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
    detailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
    detailLabelBox: { width: 120, flexDirection: "row", alignItems: "center", gap: 10 },
    detailLabel: { fontSize: 14, fontWeight: "500" },
    detailValueBox: { flex: 1 },
    detailValueText: { fontSize: 14 },

    assigneeLine: { flexDirection: "row", alignItems: "center", gap: 8 },
    avatar: { width: 24, height: 24, borderRadius: 12 },
    avatarFallback: { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    avatarInitial: { fontSize: 12, fontWeight: "700" },

    tagBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
    tagBadgeText: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },

    statusBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, backgroundColor: "transparent" },
    statusBadgeText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },

    subtasksBtn: { flexDirection: "row", alignItems: "center", marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, gap: 8 },
    subtasksBtnText: { fontSize: 14, fontWeight: "600" },

    collapseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, paddingHorizontal: SPACING.md, gap: 4, zIndex: 20 },
    collapseBtnText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

    tabBar: { flexDirection: "row", paddingHorizontal: SPACING.md, borderBottomWidth: 1 },
    tabBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: SPACING.md, gap: 6, borderBottomWidth: 2, borderBottomColor: "transparent" },
    tabBtnActive: {},
    tabText: { fontSize: 14, fontWeight: "600" },
    tabTextActive: {},
    countPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 4 },
    countPillText: { fontSize: 10, fontWeight: "700" },

    tabContentArea: { padding: SPACING.xl, alignItems: "center" },
    emptyContentText: { fontSize: 14 },

    messageRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12, width: "100%" },
    messageMineRow: { justifyContent: "flex-end" },
    messageOtherRow: { justifyContent: "flex-start" },
    messageAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 8 },
    messageAvatarText: { fontSize: 12, fontWeight: "600" },
    messageBubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, maxWidth: "80%", elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    messageMineBubble: { borderBottomRightRadius: 2 },
    messageOtherBubble: { borderBottomLeftRadius: 2, borderWidth: 1 },
    messageAuthor: { fontSize: 10, fontWeight: "600", marginBottom: 2 },
    messageText: { fontSize: 14, lineHeight: 20 },
    messageTime: { fontSize: 9, marginTop: 4, alignSelf: "flex-end" },

    inputArea: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: SPACING.md, paddingVertical: 8, borderTopWidth: 1 },
    inputBox: { flex: 1, minHeight: 36, maxHeight: 100, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingTop: Platform.OS === "ios" ? 8 : 4, paddingBottom: Platform.OS === "ios" ? 8 : 4, borderWidth: 1 },
    input: { fontSize: 14, paddingRight: 0 },
    sendBtn: { width: 36, height: 36, borderRadius: 18, marginLeft: SPACING.sm, justifyContent: "center", alignItems: "center" },

    headerActionBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginRight: 4 },

    emptyTabBox: { padding: 40, alignItems: "center", justifyContent: "center" },
    createDeliverableBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BORDER_RADIUS.md, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    createDeliverableBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

    subtasksList: { padding: SPACING.md, gap: 10 },
    subtaskCard: { padding: 12, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    subtaskMain: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    subtaskName: { fontSize: 14, fontWeight: "600", flex: 1 },
    miniStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    miniStatusText: { fontSize: 9, fontWeight: "800" },
    subtaskFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    subtaskMeta: { fontSize: 11 },
    addSubtaskSmallBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: BORDER_RADIUS.md, borderStyle: "dashed", borderWidth: 1, marginTop: 4 },
    addSubtaskSmallText: { fontSize: 13, fontWeight: "600", marginLeft: 4 },
    dateSeparatorBox: { alignItems: "center", justifyContent: "center", marginVertical: 16, width: "100%" },
    dateSeparatorText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.7 },
    subtaskBottomBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: 60,
        borderTopWidth: 1,
        paddingHorizontal: SPACING.md,
    },
    subtaskBottomBarTabs: {
        flexDirection: "row",
        gap: 16,
        alignItems: "center",
    },
    subtaskBottomBarTabBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: BORDER_RADIUS.md,
        gap: 6,
    },
    subtaskBottomBarTabText: {
        fontSize: 14,
        fontWeight: "600",
    },
    subtaskBottomBarArrowBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    subtaskSheet: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        elevation: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    subtaskSheetHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: SPACING.md,
        borderBottomWidth: 1,
        height: 60,
    },
    subtaskSheetTabs: {
        flexDirection: "row",
        gap: 16,
    },
    subtaskSheetTabBtn: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 8,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: "transparent",
    },
    subtaskSheetTabBtnActive: {},
    subtaskSheetTabText: {
        fontSize: 14,
        fontWeight: "600",
    },
    subtaskSheetCloseBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    activityCard: {
        padding: 16,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    activityHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },
    activityAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
    },
    activityAvatarText: {
        fontSize: 14,
        fontWeight: "600",
    },
    activityMeta: {
        flex: 1,
    },
    activityAuthorText: {
        fontSize: 14,
        fontWeight: "600",
    },
    activityDateText: {
        fontSize: 11,
        marginTop: 2,
    },
    activityBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        alignSelf: "flex-start",
    },
    activityBadgeText: {
        fontSize: 10,
        fontWeight: "700",
    },
    activityContent: {
        marginTop: 4,
    },
    activityText: {
        fontSize: 13,
        lineHeight: 18,
    },
    statusTransitionRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
        flexWrap: "wrap",
    },
    statusBubble: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    statusBubbleText: {
        fontSize: 10,
        fontWeight: "700",
        textTransform: "uppercase",
    },
    pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: SPACING.xl },
    pickerSheet: {
        width: "100%",
        maxHeight: "60%",
        borderRadius: BORDER_RADIUS.xl,
        paddingBottom: SPACING.xl,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    pickerHeader: { alignItems: "center", paddingTop: 12, paddingBottom: 16 },
    pickerHandle: { width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
    pickerHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: SPACING.md },
    pickerTitle: { fontSize: 18, fontWeight: "700" },
    pickerContent: { paddingHorizontal: SPACING.md },
    pickerMemberItem: { 
        flexDirection: "row", 
        alignItems: "center", 
        padding: SPACING.md, 
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: 4,
        gap: 12
    },
    pickerAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    pickerAvatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    pickerMemberName: { flex: 1, fontSize: 15, fontWeight: "500" },
});

// --- Picker Modals ---

interface AssigneePickerModalProps {
    visible: boolean;
    onClose: () => void;
    currentAssigneeId: string | null;
    members: any[];
    onSelect: (assigneeId: string | null) => void;
}

function AssigneePickerModal({ visible, onClose, currentAssigneeId, members, onSelect }: AssigneePickerModalProps) {
    const { colors, isDark } = useTheme();
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity 
                style={styles.pickerOverlay} 
                activeOpacity={1} 
                onPress={onClose}
            >
                <View style={[styles.pickerSheet, { backgroundColor: colors.surface }]}>
                    <View style={styles.pickerHeader}>
                        <View style={[styles.pickerHandle, { backgroundColor: colors.border }]} />
                        <View style={styles.pickerHeaderRow}>
                            <View style={{ width: 40 }} />
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Assign Member</Text>
                            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                                <Ionicons name="close" size={22} color={colors.textDim} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView style={styles.pickerContent} showsVerticalScrollIndicator={false}>
                        <TouchableOpacity
                            style={[
                                styles.pickerMemberItem,
                                !currentAssigneeId && { backgroundColor: isDark ? colors.activeTab : "#e0e7ff" }
                            ]}
                            onPress={() => {
                                onSelect(null);
                                onClose();
                            }}
                        >
                            <View style={[styles.pickerAvatar, { backgroundColor: colors.border }]}>
                                <Ionicons name="person-remove-outline" size={16} color={colors.textDim} />
                            </View>
                            <Text style={[
                                styles.pickerMemberName,
                                { color: colors.text },
                                !currentAssigneeId && { color: colors.primary, fontWeight: "700" }
                            ]}>
                                Unassigned
                            </Text>
                            {!currentAssigneeId && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                        </TouchableOpacity>

                        {members.map((member) => {
                            const isSelected = currentAssigneeId === member.userId;
                            const displayName = member.user?.surname || member.surname || member.user?.name || member.name || "Unknown";
                            const initials = displayName.charAt(0).toUpperCase();
                            const photoUrl = member.image || member.user?.image || null;
                            const colorSeed = member.userId ? member.userId.charCodeAt(0) % 5 : 0;
                            const avatarColors = ["#ef4444", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];
                            const avatarBg = avatarColors[colorSeed];

                            return (
                                <TouchableOpacity
                                    key={member.userId}
                                    style={[
                                        styles.pickerMemberItem,
                                        isSelected && { backgroundColor: isDark ? colors.activeTab : "#e0e7ff" }
                                    ]}
                                    onPress={() => {
                                        onSelect(member.userId);
                                        onClose();
                                    }}
                                >
                                    <View style={[styles.pickerAvatar, { backgroundColor: avatarBg }]}>
                                        {photoUrl ? (
                                            <Image source={{ uri: photoUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                                        ) : (
                                            <Text style={styles.pickerAvatarText}>{initials}</Text>
                                        )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[
                                            styles.pickerMemberName,
                                            { color: colors.text },
                                            isSelected && { color: colors.primary, fontWeight: "700" }
                                        ]}>
                                            {displayName}
                                        </Text>
                                        {member.workspaceRole && (
                                            <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 1 }}>
                                                {member.workspaceRole}
                                            </Text>
                                        )}
                                    </View>
                                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

interface TagPickerModalProps {
    visible: boolean;
    onClose: () => void;
    currentTagId: string | null;
    tags: any[];
    onSelect: (tagId: string | null) => void;
}

function TagPickerModal({ visible, onClose, currentTagId, tags, onSelect }: TagPickerModalProps) {
    const { colors, isDark } = useTheme();
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity 
                style={styles.pickerOverlay} 
                activeOpacity={1} 
                onPress={onClose}
            >
                <View style={[styles.pickerSheet, { backgroundColor: colors.surface }]}>
                    <View style={styles.pickerHeader}>
                        <View style={[styles.pickerHandle, { backgroundColor: colors.border }]} />
                        <View style={styles.pickerHeaderRow}>
                            <View style={{ width: 40 }} />
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Tag</Text>
                            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                                <Ionicons name="close" size={22} color={colors.textDim} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView style={styles.pickerContent} showsVerticalScrollIndicator={false}>
                        <TouchableOpacity
                            style={[
                                styles.pickerMemberItem,
                                !currentTagId && { backgroundColor: isDark ? colors.activeTab : "#e0e7ff" }
                            ]}
                            onPress={() => {
                                onSelect(null);
                                onClose();
                            }}
                        >
                            <View style={[styles.pickerAvatar, { backgroundColor: colors.border }]}>
                                <Ionicons name="pricetag-outline" size={16} color={colors.textDim} />
                            </View>
                            <Text style={[
                                styles.pickerMemberName,
                                { color: colors.text },
                                !currentTagId && { color: colors.primary, fontWeight: "700" }
                            ]}>
                                No Tag
                            </Text>
                            {!currentTagId && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                        </TouchableOpacity>

                        {tags.map((tag) => {
                            const isSelected = String(currentTagId) === String(tag.id);
                            return (
                                <TouchableOpacity
                                    key={tag.id}
                                    style={[
                                        styles.pickerMemberItem,
                                        isSelected && { backgroundColor: isDark ? colors.activeTab : "#e0e7ff" }
                                    ]}
                                    onPress={() => {
                                        onSelect(tag.id);
                                        onClose();
                                    }}
                                >
                                    <View style={[styles.pickerAvatar, { backgroundColor: colors.primary + "15" }]}>
                                        <Ionicons name="pricetag" size={16} color={colors.primary} />
                                    </View>
                                    <Text style={[
                                        styles.pickerMemberName,
                                        { color: colors.text },
                                        isSelected && { color: colors.primary, fontWeight: "700" }
                                    ]}>
                                        {tag.name}
                                    </Text>
                                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

// getStatusColor removed in favor of getStatusHex from taskColors utility
