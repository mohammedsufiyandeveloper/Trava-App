import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    StatusBar,
    TextInput,
    RefreshControl,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import ProjectActionModal from "../components/ProjectActionModal";
import CreateProjectModal from "../components/CreateProjectModal";
import EditProjectModal from "../components/EditProjectModal";
import ProjectMembersModal from "../components/ProjectMembersModal";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useNotifications } from "../context/NotificationContext";
import { RootStackParamList, Project } from "../types";
import { deleteProject } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";
import PressableScale from "../components/PressableScale";
import { Skeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import { haptics } from "../services/haptics";
import { useToast } from "../context/ToastContext";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Main">;

export default function ProjectsScreen() {
    const { projects, loading, refreshData } = useWorkspace();
    const { colors, isDark } = useTheme();
    const { unreadCount } = useNotifications();
    const navigation = useNavigation<NavigationProp>();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const toast = useToast();

    const [search, setSearch] = useState<string>("");
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Debounce search so filtering doesn't run on every keystroke.
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 200);
        return () => clearTimeout(t);
    }, [search]);
    
    // Action Modal State
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [createProjectVisible, setCreateProjectVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [membersModalVisible, setMembersModalVisible] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    const onRefresh = async () => {
        haptics.light();
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    const handleProjectLongPress = (project: Project) => {
        haptics.medium();
        setSelectedProject(project);
        setActionModalVisible(true);
    };

    const handleViewProject = (project: Project) => {
        setActionModalVisible(false);
        navigation.navigate("ProjectDetail", { 
            projectId: project.id, 
            projectName: project.name,
            projectColor: project.color 
        });
    };

    const handleEditProject = (project: Project) => {
        setActionModalVisible(false);
        setEditModalVisible(true);
    };

    const handleManageMembers = (project: Project) => {
        setActionModalVisible(false);
        setMembersModalVisible(true);
    };

    const handleDeleteProject = (project: Project) => {
        setActionModalVisible(false);
        Alert.alert(
            "Delete Project",
            `Are you sure you want to delete "${project.name}"? This action cannot be undone and will delete all tasks within it.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const res = await deleteProject(project.id);
                            if (res.success) {
                                await refreshData();
                                toast.success(`"${project.name}" deleted`);
                            } else {
                                toast.error(res.error || "Failed to delete project");
                            }
                        } catch (err: any) {
                            toast.error(err.message || "An error occurred");
                        }
                    },
                },
            ]
        );
    };

    const filteredProjects = useMemo(
        () => projects.filter(p => p.name.toLowerCase().includes(debouncedSearch.toLowerCase())),
        [projects, debouncedSearch]
    );

    const renderItem = ({ item }: { item: Project }) => (
        <PressableScale
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleViewProject(item)}
            onLongPress={() => handleProjectLongPress(item)}
            delayLongPress={300}
            accessibilityLabel={`Project ${item.name}`}
            accessibilityHint="Opens the project. Long-press for actions."
        >
            <View style={[styles.avatar, { backgroundColor: item.color || colors.primary }]}>
                <Ionicons name="folder" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.desc, { color: colors.textDim }]} numberOfLines={1}>
                    {item.description || "No description provided"}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </PressableScale>
    );

    const renderSkeletonCard = (key: number) => (
        <View key={key} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Skeleton width={44} height={44} radius={12} />
            <View style={{ flex: 1, marginLeft: SPACING.md, gap: 8 }}>
                <Skeleton width="55%" height={15} />
                <Skeleton width="80%" height={12} />
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            
            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                <View style={[styles.header, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Projects</Text>
                    <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                        <PressableScale
                            style={[styles.headerBtn, { backgroundColor: colors.surfaceHighlight }]}
                            onPress={() => (navigation as any).navigate("Notifications")}
                            accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                            hitSlop={8}
                        >
                            <Ionicons name="notifications-outline" size={22} color={colors.text} />
                            {unreadCount > 0 && (
                                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                                </View>
                            )}
                        </PressableScale>
                        <PressableScale
                            style={[styles.headerBtn, { backgroundColor: colors.surfaceHighlight }]}
                            onPress={() => setCreateProjectVisible(true)}
                            accessibilityLabel="Create project"
                            hitSlop={8}
                        >
                            <Ionicons name="add" size={22} color={colors.primary} />
                        </PressableScale>
                    </View>
                </View>

                <View style={[styles.searchBarContainer, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons name="search" size={20} color={colors.textDim} />
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            placeholder="Search projects..."
                            placeholderTextColor={colors.textDim}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                </View>

                {loading ? (
                    <View style={[styles.list, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                        {[0, 1, 2, 3, 4, 5].map(renderSkeletonCard)}
                    </View>
                ) : (
                    <FlatList
                        data={filteredProjects}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={[
                            styles.list,
                            { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) },
                            filteredProjects.length === 0 && { flexGrow: 1 },
                        ]}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                        ListEmptyComponent={
                            <EmptyState
                                icon="folder-open-outline"
                                title={debouncedSearch ? "No matching projects" : "No projects yet"}
                                message={debouncedSearch
                                    ? "Try a different search term."
                                    : "Create your first project to get started."}
                                actionLabel={debouncedSearch ? undefined : "Create project"}
                                onAction={debouncedSearch ? undefined : () => setCreateProjectVisible(true)}
                            />
                        }
                    />
                )}
            </View>

            <ProjectActionModal
                visible={actionModalVisible}
                onClose={() => setActionModalVisible(false)}
                projectName={selectedProject?.name || ""}
                onView={() => selectedProject && handleViewProject(selectedProject)}
                onEdit={() => selectedProject && handleEditProject(selectedProject)}
                onManageMembers={() => selectedProject && handleManageMembers(selectedProject)}
                onDelete={() => selectedProject && handleDeleteProject(selectedProject)}
                canManage={selectedProject?.canManageMembers}
            />

            <CreateProjectModal
                visible={createProjectVisible}
                onClose={() => setCreateProjectVisible(false)}
            />

            <EditProjectModal
                visible={editModalVisible}
                onClose={() => setEditModalVisible(false)}
                projectId={selectedProject?.id || ""}
            />

            <ProjectMembersModal
                visible={membersModalVisible}
                onClose={() => setMembersModalVisible(false)}
                projectId={selectedProject?.id || ""}
                projectName={selectedProject?.name || ""}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACING.md },
    title: { fontSize: 24, fontWeight: "700" },
    headerBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", position: "relative" },
    badge: { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
    badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

    searchBarContainer: { marginBottom: SPACING.md },
    searchBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, height: 48, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    input: { flex: 1, fontSize: 16, marginLeft: SPACING.sm },

    list: { paddingBottom: 20 },
    card: { flexDirection: "row", alignItems: "center", padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
    avatar: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    name: { fontSize: 16, fontWeight: "600" },
    desc: { fontSize: 13, marginTop: 2 },

    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    empty: { marginTop: 100, alignItems: "center", paddingHorizontal: SPACING.xl },
    emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: SPACING.md },
    emptySub: { fontSize: 14, textAlign: "center", marginTop: SPACING.sm },
});
