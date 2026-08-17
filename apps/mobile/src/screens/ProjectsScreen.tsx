import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    StatusBar,
    TextInput,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import ProjectActionModal from "../components/ProjectActionModal";
import CreateProjectModal from "../components/CreateProjectModal";
import EditProjectModal from "../components/EditProjectModal";
import ProjectMembersModal from "../components/ProjectMembersModal";
import { SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useNotifications } from "../context/NotificationContext";
import { RootStackParamList, Project } from "../types";
import { deleteProject } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";
import PressableScale from "../components/PressableScale";
import { Skeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";
import ConfirmationSheet from "../components/ConfirmationSheet";
import HeaderMenu from "../components/HeaderMenu";
import { haptics } from "../services/haptics";
import { useToast } from "../context/ToastContext";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Main">;

/** Header vertical padding + button height + gap, so the menu clears the header. */
const MENU_TOP_OFFSET = SPACING.md + 42 + 8;

export default function ProjectsScreen() {
    const { projects, loading, refreshData } = useWorkspace();
    const { colors, isDark, toggleTheme } = useTheme();
    const { unreadCount } = useNotifications();
    const navigation = useNavigation<NavigationProp>();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const toast = useToast();

    const [search, setSearch] = useState<string>("");
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");
    const [refreshing, setRefreshing] = useState<boolean>(false);
    // The mockup header has no search field — it opens from the icon.
    const [searchOpen, setSearchOpen] = useState<boolean>(false);
    const [menuOpen, setMenuOpen] = useState<boolean>(false);

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

    // Delete confirmation (replaces native Alert for this consequential action).
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
    const [deleting, setDeleting] = useState(false);

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
        setDeleteTarget(project);
    };

    const confirmDeleteProject = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await deleteProject(deleteTarget.id);
            if (res.success) {
                await refreshData();
                toast.success(`"${deleteTarget.name}" deleted`);
                setDeleteTarget(null);
            } else {
                toast.error(res.error || "Failed to delete project");
            }
        } catch (err: any) {
            toast.error(err.message || "An error occurred");
        } finally {
            setDeleting(false);
        }
    };

    const filteredProjects = useMemo(
        () => projects.filter(p => p.name.toLowerCase().includes(debouncedSearch.toLowerCase())),
        [projects, debouncedSearch]
    );

    const renderItem = ({ item }: { item: Project }) => {
        const managers = item.projectManagers ?? [];
        const visibleManagers = managers.slice(0, 3);
        const extraManagers = managers.length - visibleManagers.length;

        return (
            <PressableScale
                style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}
                onPress={() => handleViewProject(item)}
                onLongPress={() => handleProjectLongPress(item)}
                delayLongPress={300}
                accessibilityLabel={`Project ${item.name}`}
                accessibilityHint="Opens the project. Long-press for actions."
            >
                {/* Folder tinted with the project colour — the only colour on the
                    row, so the list stays as calm as the mockup. */}
                <Ionicons name="folder-outline" size={24} color={item.color || colors.text} />

                <View style={{ flex: 1, marginLeft: SPACING.md, marginRight: SPACING.sm }}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.desc, { color: colors.textDim }]} numberOfLines={1}>
                        {item.description || "No description provided"}
                    </Text>
                </View>

                {visibleManagers.length > 0 && (
                    <View
                        style={styles.avatarStack}
                        accessibilityLabel={`${managers.length} project manager${managers.length === 1 ? "" : "s"}`}
                    >
                        {visibleManagers.map((m, idx) => (
                            <View
                                key={m.id}
                                style={[
                                    styles.stackAvatar,
                                    { backgroundColor: colors.surfaceHighlight, borderColor: colors.surfaceSolid, marginLeft: idx === 0 ? 0 : -8 },
                                ]}
                            >
                                <Text style={[styles.stackAvatarText, { color: colors.text }]}>
                                    {(m.surname?.[0] || m.name?.charAt(0) || "?").toUpperCase()}
                                </Text>
                            </View>
                        ))}
                        {extraManagers > 0 && (
                            <View style={[styles.stackAvatar, { backgroundColor: colors.surfaceHighlight, borderColor: colors.surfaceSolid, marginLeft: -8 }]}>
                                <Text style={[styles.stackAvatarText, { color: colors.textDim }]}>+{extraManagers}</Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={[styles.arrowCircle, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
                    <Ionicons name="arrow-forward" size={14} color={colors.text} />
                </View>
            </PressableScale>
        );
    };

    const renderSkeletonCard = (key: number) => (
        <View key={key} style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
            <Skeleton width={24} height={24} radius={6} />
            <View style={{ flex: 1, marginLeft: SPACING.md, gap: 8 }}>
                <Skeleton width="55%" height={15} />
                <Skeleton width="80%" height={12} />
            </View>
            <Skeleton width={28} height={28} radius={14} />
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                <View style={[styles.header, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <Text style={[styles.title, { color: colors.text }]}>Projects</Text>
                    <View style={{ flexDirection: "row", gap: SPACING.sm, alignItems: "center" }}>
                        <PressableScale
                            style={[styles.headerBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}
                            onPress={() => {
                                haptics.selection();
                                setSearchOpen(open => {
                                    if (open) setSearch("");
                                    return !open;
                                });
                            }}
                            accessibilityLabel={searchOpen ? "Close search" : "Search projects"}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: searchOpen }}
                            hitSlop={8}
                        >
                            <Ionicons name={searchOpen ? "close" : "search"} size={20} color={colors.text} />
                        </PressableScale>

                        <PressableScale
                            style={[styles.headerBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}
                            onPress={() => (navigation as any).navigate("Notifications")}
                            accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                            accessibilityRole="button"
                            hitSlop={8}
                        >
                            <Ionicons name="notifications-outline" size={20} color={colors.text} />
                            {unreadCount > 0 && (
                                <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                                    <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                                </View>
                            )}
                        </PressableScale>

                        <PressableScale
                            style={[styles.headerBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}
                            onPress={() => { haptics.selection(); setMenuOpen(true); }}
                            accessibilityLabel="More options"
                            accessibilityRole="button"
                            accessibilityState={{ expanded: menuOpen }}
                            hitSlop={8}
                        >
                            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
                        </PressableScale>
                    </View>
                </View>

                {searchOpen && (
                    <View style={[styles.searchBarContainer, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                        <View style={[styles.searchBar, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
                            <Ionicons name="search" size={20} color={colors.textDim} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder="Search projects..."
                                placeholderTextColor={colors.textDim}
                                value={search}
                                onChangeText={setSearch}
                                autoFocus
                                accessibilityLabel="Search projects"
                            />
                        </View>
                    </View>
                )}

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

            <HeaderMenu
                visible={menuOpen}
                onClose={() => setMenuOpen(false)}
                top={MENU_TOP_OFFSET}
                right={value(SPACING.lg, SPACING.xl, SPACING.xxl)}
                items={[
                    {
                        icon: "add-circle-outline",
                        label: "New Project",
                        color: colors.primary,
                        onPress: () => { setMenuOpen(false); setCreateProjectVisible(true); },
                    },
                    {
                        icon: isDark ? "sunny-outline" : "moon-outline",
                        label: isDark ? "Light Mode" : "Dark Mode",
                        accessibilityLabel: isDark ? "Switch to light mode" : "Switch to dark mode",
                        onPress: () => { toggleTheme(); setMenuOpen(false); },
                    },
                    {
                        icon: "sparkles-outline",
                        label: "Trava AI",
                        onPress: () => { setMenuOpen(false); (navigation as any).navigate("AI"); },
                    },
                    {
                        icon: "person-circle-outline",
                        label: "My Profile",
                        onPress: () => { setMenuOpen(false); (navigation as any).navigate("MyProfile"); },
                    },
                ]}
            />

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

            <ConfirmationSheet
                visible={!!deleteTarget}
                title="Delete project"
                description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone and will delete all tasks within it.` : undefined}
                tone="destructive"
                confirmLabel="Delete"
                cancelLabel="Cancel"
                loading={deleting}
                onConfirm={confirmDeleteProject}
                onClose={() => { if (!deleting) setDeleteTarget(null); }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACING.md },
    title: { fontSize: 28, fontFamily: FONTS.extrabold, letterSpacing: -0.6 },
    headerBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
    },
    badge: {
        position: "absolute",
        top: -2,
        right: -2,
        minWidth: 17,
        height: 17,
        borderRadius: 9,
        borderWidth: 1.5,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 4,
    },
    badgeText: { color: "#2b1c04", fontSize: 9, fontFamily: FONTS.extrabold },

    searchBarContainer: { marginBottom: SPACING.md },
    searchBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.md, height: 48, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    input: { flex: 1, fontSize: 16, marginLeft: SPACING.sm, fontFamily: FONTS.medium },

    list: { paddingBottom: 20, paddingTop: 4 },
    // Near-pill rows: radius is just under half the min height.
    card: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 32,
        borderWidth: 1,
        marginBottom: 14,
        minHeight: 74,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    name: { fontSize: 17, fontFamily: FONTS.bold, letterSpacing: -0.2 },
    desc: { fontSize: 13, marginTop: 2, fontFamily: FONTS.regular },
    arrowCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    avatarStack: { flexDirection: "row", alignItems: "center", marginRight: SPACING.sm },
    stackAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
    stackAvatarText: { fontSize: 9, fontFamily: FONTS.bold },
});
