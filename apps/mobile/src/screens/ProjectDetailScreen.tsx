import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    ScrollView,
    ActivityIndicator,
    Platform,
    DeviceEventEmitter,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace, DEFAULT_FILTERS } from "../context/WorkspaceContext";
import { getTasks, getCachedSession } from "../services/api";
import { RootStackParamList, Task } from "../types";

// Sub-views
import ProjectDashboard from "./project/ProjectDashboard";
import ProjectTaskList from "./project/ProjectTaskList";
import ProjectKanban from "./project/ProjectKanban";
import ProjectGanttView from "./project/ProjectGanttView";
import TaskFilterSheet from "../components/TaskFilterSheet";
import CreateTaskModal from "../components/CreateTaskModal";
import { useResponsive } from "../hooks/useResponsive";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectDetail">;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const tabs = [
    { id: "Dashboard", label: "Dashboard", icon: "grid-outline" as const },
    { id: "Tasks", label: "List", icon: "list-outline" as const },
    { id: "Kanban", label: "Kanban", icon: "apps-outline" as const },
    { id: "Gantt", label: "Gantt", icon: "layers-outline" as const },
];

export default function ProjectDetailScreen({ route, navigation }: Props) {
    const { projectId, projectName, projectColor } = route.params;
    const { activeWorkspace, workspaces, projects, projectFilters, setProjectFilters } = useWorkspace();
    const { colors, isDark } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const COMPONENT_WIDTH = Math.min(SCREEN_WIDTH, MAX_CONTENT_WIDTH);

    const isAdminOrOwner = React.useMemo(() => {
        const wsFromList = workspaces.find(w => w.id === activeWorkspace?.id);
        const role = activeWorkspace?.workspaceRole || wsFromList?.workspaceRole;
        return role === "ADMIN" || role === "OWNER" || role === "MANAGER";
    }, [activeWorkspace, workspaces]);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    React.useEffect(() => {
        getCachedSession().then(s => setCurrentUserId(s?.user?.id || null));
    }, []);

    const isManagerOfProject = React.useMemo(() => {
        const project = projects.find(p => p.id === projectId);
        return project?.projectManagers?.some(m => m.id === currentUserId) || false;
    }, [projects, projectId, currentUserId]);

    const canSeeAllTasks = isAdminOrOwner || isManagerOfProject;

    const filters = projectFilters[projectId] || DEFAULT_FILTERS;
    const [activeTab, setActiveTabUI] = useState<string>("Dashboard");
    const scrollViewRef = React.useRef<ScrollView>(null);

    const setActiveTab = React.useCallback((tab: string) => {
        setActiveTabUI(tab);
        const index = tabs.findIndex(t => t.id === tab);
        if (index !== -1 && scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ x: index * COMPONENT_WIDTH, animated: true });
        }
    }, [COMPONENT_WIDTH]);

    const initialTabParam = route.params?.initialTab;
    React.useEffect(() => {
        if (initialTabParam) {
            setActiveTab(initialTabParam);
        }
    }, [initialTabParam, setActiveTab]);
    const [filterVisible, setFilterVisible] = useState(false);
    const [createTaskVisible, setCreateTaskVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [projectTasks, setProjectTasks] = useState<Task[]>([]);
    const [projectLoading, setProjectLoading] = useState(true);

    const handleStatPress = React.useCallback((label: string) => {
        let newFilters = { ...DEFAULT_FILTERS };

        if (label === "Completed Sub Tasks") {
            newFilters = { ...filters, status: ["COMPLETED"] };
        } else if (label === "Pending Sub Tasks") {
            newFilters = { ...filters, status: ["TO_DO", "IN_PROGRESS", "REVIEW", "HOLD"] };
        } else if (label === "Total Sub Tasks") {
            newFilters = DEFAULT_FILTERS;
        }

        setProjectFilters(projectId, newFilters);

        navigation.navigate("ProjectSubTasks", {
            parentId: "all",
            parentName: label,
            projectId: projectId
        });
    }, [projectId, filters, navigation, setProjectFilters]);

    const fetchTasks = React.useCallback(async () => {
        if (!activeWorkspace) return;
        setProjectLoading(true);
        try {
            const session = await getCachedSession();

            // Fetch tasks: Admins/Owners see everything, others see only their assigned tasks
            // Using hierarchyMode: "children" to get a flat list of all subtasks as requested
            const result = await getTasks(activeWorkspace.id, {
                projectId: projectId,
                hierarchyMode: "parents",
                includeSubTasks: true,
                limit: 1000,
                // The backend already filters tasks for members based on the session userId,
                // so we don't need to pass assigneeId explicitly here unless we want to filter by SOMEONE ELSE.
                assigneeId: undefined,
            });
            setProjectTasks(result.tasks);
        } catch (error) {
            console.error("Error fetching project tasks:", error);
        } finally {
            setProjectLoading(false);
        }
    }, [activeWorkspace, projectId, canSeeAllTasks]);

    React.useEffect(() => {
        fetchTasks();

        // Listen for real-time WebSocket updates from Pusher (emitted by NotificationContext)
        const subscription = DeviceEventEmitter.addListener("remote_update", (payload: any) => {
            // Silently refresh tasks in the background when an activity occurs
            fetchTasks();
        });

        return () => subscription.remove();
    }, [fetchTasks]);

    // Calculate active filter count
    const activeFilterCount = Object.values(filters).filter(v => Array.isArray(v) ? v.length > 0 : !!v).length;


    const props = {
        projectId,
        tasks: projectTasks,
        loading: projectLoading,
        onRefresh: fetchTasks,
        navigation,
        onEditTask: (task: Task) => {
            setEditingTask(task);
            setCreateTaskVisible(true);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            {/* Custom Header */}
            <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                <View style={{ maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.titleContainer}>
                            <View style={[styles.colorDot, { backgroundColor: projectColor || colors.primary }]} />
                            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{projectName}</Text>
                        </View>
                    </View>
                    <View style={styles.headerActions}>
                        {activeTab === "Tasks" && (
                            <TouchableOpacity
                                style={[styles.filterBtn, { backgroundColor: colors.surfaceHighlight }]}
                                onPress={() => setCreateTaskVisible(true)}
                            >
                                <Ionicons name="add" size={22} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* Sub-navigation Tabs */}
            <View style={[styles.tabBarContainer, { borderBottomColor: colors.border, paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                <View style={{ maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                    <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    onPress={() => setActiveTab(tab.id)}
                                    style={[styles.tabItem, isActive && { backgroundColor: isDark ? colors.primary + "25" : colors.primary + "15" }]}
                                >
                                    <Ionicons
                                        name={tab.icon}
                                        size={18}
                                        color={isActive ? colors.primary : colors.textDim}
                                    />
                                    <Text style={[styles.tabLabel, { color: colors.textDim }, isActive && { color: colors.primary }]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>


            {/* Main Content Area */}
            <View style={[styles.content, { maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }]}>
                <ScrollView
                    horizontal
                    scrollEnabled={false}
                    showsHorizontalScrollIndicator={false}
                    ref={scrollViewRef}
                    onMomentumScrollEnd={(e) => {
                        const page = Math.round(e.nativeEvent.contentOffset.x / COMPONENT_WIDTH);
                        const newTab = tabs[page]?.id;
                        if (newTab && activeTab !== newTab) {
                            setActiveTabUI(newTab);
                        }
                    }}
                >
                    <View style={{ width: COMPONENT_WIDTH, flex: 1 }}>
                        <ProjectDashboard {...(props as any)} isManagerOfProject={canSeeAllTasks} onStatPress={handleStatPress} />
                    </View>
                    <View style={{ width: COMPONENT_WIDTH, flex: 1 }}>
                        <ProjectTaskList {...(props as any)} />
                    </View>
                    <View style={{ width: COMPONENT_WIDTH, flex: 1 }}>
                        <ProjectKanban projectId={projectId} navigation={navigation} refreshData={fetchTasks} />
                    </View>
                    <View style={{ width: COMPONENT_WIDTH, flex: 1 }}>
                        <ProjectGanttView {...(props as any)} />
                    </View>
                </ScrollView>
            </View>

            <CreateTaskModal
                visible={createTaskVisible}
                onClose={() => {
                    setCreateTaskVisible(false);
                    setEditingTask(null);
                }}
                initialProjectId={projectId}
                editingTask={editingTask}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { justifyContent: "center", height: 60, borderBottomWidth: 1 },
    backBtn: { padding: 4 },
    titleContainer: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: SPACING.md },
    colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
    title: { fontSize: 18, fontWeight: "700" },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    filterBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
    filterBadge: { position: "absolute", top: -2, right: -2, width: 14, height: 14, borderRadius: 7, justifyContent: "center", alignItems: "center", borderWidth: 1 },
    filterBadgeText: { color: "#fff", fontSize: 8, fontWeight: "800" },
    moreBtn: { padding: 4 },

    tabBarContainer: { paddingVertical: SPACING.sm, borderBottomWidth: 1 },
    tabBar: { flexDirection: "row", borderRadius: BORDER_RADIUS.md, padding: 4, height: 44, justifyContent: "space-between" },
    tabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: BORDER_RADIUS.sm, gap: 6 },
    tabLabel: { fontSize: 12, fontWeight: "600" },

    activeFiltersBar: { paddingVertical: SPACING.sm, borderBottomWidth: 1 },
    activeFiltersScroll: { paddingHorizontal: SPACING.md, alignItems: "center", gap: 8 },
    filterChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4, borderWidth: 1 },
    filterChipText: { fontSize: 11, fontWeight: "600" },
    clearAllText: { color: "#ef4444", fontSize: 12, fontWeight: "600", marginLeft: 8 },

    content: { flex: 1 },
});
