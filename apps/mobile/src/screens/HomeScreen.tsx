import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    RefreshControl,
    Pressable,
    Animated,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { format } from "date-fns";

import { SPACING, BORDER_RADIUS, TOUCH_TARGET } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useNotifications } from "../context/NotificationContext";
import { MainTabParamList, RootStackParamList, Workspace, Task } from "../types";
import WidgetPreviewModal from "../components/WidgetPreviewModal";
import PressableScale from "../components/PressableScale";
import { haptics } from "../services/haptics";
import AttendanceWidget from "../components/AttendanceWidget";
import { useResponsive } from "../hooks/useResponsive";
import AmbientBackground from "../components/AmbientBackground";
import GlassSurface from "../components/GlassSurface";
import Sheet from "../components/Sheet";

type Props = CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, "Home">,
    NativeStackScreenProps<RootStackParamList>
>;

interface TaskDisplayItem {
    id: string;
    name: string;
    projectName: string;
    dueDateStr: string;
    color: string;
    badgeBg: string;
    badgeText: string;
}

export default function HomeScreen({ navigation }: Props) {
    const {
        workspaces,
        activeWorkspace,
        stats,
        tasks,
        loading: wsLoading,
        refreshWorkspaces,
        switchWorkspace,
    } = useWorkspace();
    const { colors, isDark, toggleTheme } = useTheme();
    const { unreadCount } = useNotifications();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
    const [wsSwitcherVisible, setWsSwitcherVisible] = useState<boolean>(false);
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [previewTarget, setPreviewTarget] = useState<"projects" | "teams" | "attendance" | null>(null);
    const [previewPos, setPreviewPos] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const projRef = React.useRef<any>(null);
    const teamRef = React.useRef<any>(null);
    const attRef = React.useRef<any>(null);
    const shimmerAnim = React.useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        let animation: Animated.CompositeAnimation | null = null;
        if (wsLoading) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(shimmerAnim, {
                        toValue: 1.0,
                        duration: 850,
                        useNativeDriver: true,
                    }),
                    Animated.timing(shimmerAnim, {
                        toValue: 0.3,
                        duration: 850,
                        useNativeDriver: true,
                    })
                ])
            );
            animation.start();
        } else {
            shimmerAnim.setValue(1.0);
        }
        return () => {
            if (animation) {
                animation.stop();
            }
        };
    }, [wsLoading]);

    const openPreview = (target: "projects" | "teams" | "attendance", ref: React.RefObject<any>) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        ref.current?.measureInWindow?.((x: number, y: number, w: number, h: number) => {
            setPreviewPos({ x, y, w, h });
            setPreviewTarget(target);
        });
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    const onRefresh = async () => {
        haptics.light();
        setRefreshing(true);
        try {
            await refreshWorkspaces();
        } finally {
            setRefreshing(false);
        }
    };

    const handleSwitchWorkspace = async (workspace: Workspace) => {
        if (workspace.id === activeWorkspace?.id) {
            setWsSwitcherVisible(false);
            return;
        }
        setSwitchingId(workspace.id);
        try {
            await switchWorkspace(workspace);
            haptics.success();
            setWsSwitcherVisible(false);
        } catch {
            haptics.error();
        } finally {
            setSwitchingId(null);
        }
    };

    // Calculate dynamic "on track" percentage from actual stats or fallback to 68
    const totalTasks = stats.totalTasks;
    const completedOrInProgress = stats.completedTasks + stats.inProgressTasks;
    const onTrackPercentage = totalTasks > 0 ? Math.round((completedOrInProgress / totalTasks) * 100) : 68;

    // Filter due soon tasks or fallback to screenshot mock tasks
    const activeTasks = (tasks || []).filter(
        (t) => t.workspaceId === activeWorkspace?.id && t.status !== "COMPLETED" && t.status !== "CANCELLED" && t.dueDate
    );

    const dueSoonTasks: TaskDisplayItem[] = activeTasks.length > 0
        ? [...activeTasks]
            .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
            .slice(0, 3)
            .map((task) => {
                const date = new Date(task.dueDate!);
                const dueDateStr = format(date, "MMM d");
                
                // Color mapping based on urgency/priority
                let color = "#10b981"; // Green
                let badgeBg = "rgba(16, 185, 129, 0.15)";
                let badgeText = "#34d399";

                if (task.priority === "URGENT" || task.priority === "HIGH") {
                    color = "#ef4444"; // Red
                    badgeBg = "rgba(239, 68, 68, 0.15)";
                    badgeText = "#f87171";
                } else if (task.priority === "NORMAL") {
                    color = "#fbbf24"; // Orange/Gold
                    badgeBg = "rgba(245, 158, 11, 0.15)";
                    badgeText = "#fbbf24";
                }

                return {
                    id: task.id,
                    name: task.name,
                    projectName: task.project?.name || activeWorkspace?.name || "Project",
                    dueDateStr,
                    color,
                    badgeBg,
                    badgeText
                };
            })
        : [
            {
                id: "mock-1",
                name: "Draft onboarding checklist for GulfT...",
                projectName: "Dubai Client Onboarding",
                dueDateStr: "Aug 8",
                color: "#ef4444",
                badgeBg: "rgba(239, 68, 68, 0.15)",
                badgeText: "#fca5a5"
            },
            {
                id: "mock-2",
                name: "Source venue options for kickoff e...",
                projectName: "Dubai Client Onboarding",
                dueDateStr: "Aug 12",
                color: "#10b981",
                badgeBg: "rgba(16, 185, 129, 0.15)",
                badgeText: "#6ee7b7"
            },
            {
                id: "mock-3",
                name: "Build lifecycle email sequence for Q3",
                projectName: "Q3 Growth Campaign",
                dueDateStr: "Aug 6",
                color: "#ef4444",
                badgeBg: "rgba(239, 68, 68, 0.15)",
                badgeText: "#fca5a5"
            }
        ];

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <StatusBar barStyle="light-content" />
            <AmbientBackground />

            {isMenuOpen && (
                <Pressable
                    style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
                    onPress={() => setIsMenuOpen(false)}
                />
            )}

            {/* Header */}
            <View style={[styles.header, { zIndex: 20, paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                <View style={[styles.headerContent, { maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }]}>
                    {/* Left side: Workspace switcher */}
                    <PressableScale
                        haptic="selection"
                        onPress={() => setWsSwitcherVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Switch workspace, current: ${activeWorkspace?.name ?? "Trava Tasks"}`}
                        accessibilityHint="Opens the workspace switcher"
                        style={{ flex: 1, marginRight: SPACING.md, minHeight: TOUCH_TARGET.min, justifyContent: "center" }}
                    >
                        {wsLoading && !activeWorkspace ? (
                            <Animated.View style={{ width: 140, height: 24, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 4, opacity: shimmerAnim }} />
                        ) : (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={[styles.workspaceNameSimple, { color: colors.text }]} numberOfLines={1}>
                                    {activeWorkspace?.name ?? "Trava Tasks"}
                                </Text>
                                <Ionicons name="chevron-down" size={18} color="#888888" style={{ marginTop: 2 }} />
                            </View>
                        )}
                        <Text style={{ color: "#888888", fontSize: 13, fontWeight: "500", marginTop: 2 }}>
                            {format(currentTime, 'EEEE d MMM • HH:mm')}
                        </Text>
                    </PressableScale>

                    {/* Right side: Actions */}
                    <View style={{ flexDirection: "row", gap: SPACING.sm, position: 'relative' }}>
                        <TouchableOpacity
                            style={styles.actionCircleBtn}
                            onPress={() => (navigation as any)?.navigate("Notifications")}
                            accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                        >
                            <Ionicons name="notifications-outline" size={20} color="#ffffff" />
                            {unreadCount > 0 && (
                                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCircleBtn}
                            onPress={() => setIsMenuOpen(!isMenuOpen)}
                            accessibilityLabel="More options"
                            accessibilityState={{ expanded: isMenuOpen }}
                        >
                            <Ionicons name="ellipsis-horizontal" size={20} color="#ffffff" />
                        </TouchableOpacity>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                            <GlassSurface level="elevated" intensity="sheet" radius="md" elevation="md" style={styles.dropdownMenu}>
                                <PressableScale
                                    haptic="selection"
                                    style={styles.dropdownItem}
                                    onPress={() => {
                                        toggleTheme();
                                        setIsMenuOpen(false);
                                    }}
                                    accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
                                >
                                    <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={colors.text} />
                                    <Text style={[styles.dropdownText, { color: colors.text }]}>{isDark ? "Light Mode" : "Dark Mode"}</Text>
                                </PressableScale>
                                <PressableScale
                                    haptic="selection"
                                    style={styles.dropdownItem}
                                    onPress={() => {
                                        setIsMenuOpen(false);
                                        (navigation as any)?.navigate("AI");
                                    }}
                                    accessibilityLabel="Trava AI"
                                >
                                    <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
                                    <Text style={[styles.dropdownText, { color: colors.primary }]}>Trava AI</Text>
                                </PressableScale>
                                <PressableScale
                                    haptic="selection"
                                    style={styles.dropdownItem}
                                    onPress={() => {
                                        setIsMenuOpen(false);
                                        (navigation as any)?.navigate("Attendance");
                                    }}
                                    accessibilityLabel="Attendance"
                                >
                                    <Ionicons name="time-outline" size={20} color={colors.text} />
                                    <Text style={[styles.dropdownText, { color: colors.text }]}>Attendance</Text>
                                </PressableScale>
                                <PressableScale
                                    haptic="selection"
                                    style={styles.dropdownItem}
                                    onPress={() => {
                                        setIsMenuOpen(false);
                                        (navigation as any)?.navigate("Leave");
                                    }}
                                    accessibilityLabel="Leaves"
                                >
                                    <Ionicons name="calendar-outline" size={20} color={colors.text} />
                                    <Text style={[styles.dropdownText, { color: colors.text }]}>Leaves</Text>
                                </PressableScale>
                            </GlassSurface>
                        )}
                    </View>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                onScrollBeginDrag={() => { if (isMenuOpen) setIsMenuOpen(false); }}
            >
                <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }}>

                    {/* Progress Card ("This Week") */}
                    <View style={styles.progressCard}>
                        <View style={styles.progressLeft}>
                            <Text style={styles.progressLabel}>THIS WEEK</Text>
                            <Text style={styles.progressValue}>{onTrackPercentage}% on track</Text>
                        </View>
                        <View style={styles.progressRight}>
                            <View style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                borderWidth: 3.5,
                                borderColor: "#f59e0b",
                                borderTopColor: "rgba(255, 255, 255, 0.08)",
                                transform: [{ rotate: "45deg" }],
                            }} />
                        </View>
                    </View>


                    {wsLoading ? (
                        <View style={{ gap: SPACING.md, marginBottom: SPACING.xl }}>
                            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                                <Animated.View style={[styles.statBox, { backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.04)", opacity: shimmerAnim }]} />
                                <Animated.View style={[styles.statBox, { backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.04)", opacity: shimmerAnim }]} />
                            </View>
                            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                                <Animated.View style={[styles.statBox, { backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.04)", opacity: shimmerAnim }]} />
                                <Animated.View style={[styles.statBox, { backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.04)", opacity: shimmerAnim }]} />
                            </View>
                        </View>
                    ) : (
                        <View style={{ gap: SPACING.md, marginBottom: SPACING.lg }}>
                            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                                {activeWorkspace?.id ? (
                                    <AttendanceWidget
                                        ref={attRef}
                                        workspaceId={activeWorkspace.id}
                                        variant="mini"
                                        onLongPress={() => openPreview("attendance", attRef)}
                                    />
                                ) : (
                                    <View style={[styles.statBox, { backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.04)" }]} />
                                )}
                                <TouchableOpacity
                                    ref={projRef}
                                    style={[styles.statBox, { backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.04)" }]}
                                    activeOpacity={0.7}
                                    onPress={() => navigation.navigate("Projects", { screen: "_Base" } as any)}
                                    onLongPress={() => openPreview("projects", projRef)}
                                    delayLongPress={300}
                                >
                                    <View style={[styles.statIcon, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                                        <Ionicons name="grid" size={20} color="#3b82f6" />
                                    </View>
                                    <View style={styles.statTextContent}>
                                        <Text
                                            style={[styles.statValue, { color: colors.text }]}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.65}
                                        >
                                            {stats.totalProjects}
                                        </Text>
                                        <Text
                                            style={[styles.statTitle, { color: "#888888" }]}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.7}
                                        >
                                            Projects
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                                <TouchableOpacity
                                    style={[styles.statBox, { backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.04)" }]}
                                    activeOpacity={0.7}
                                    onPress={() => (navigation as any).navigate("MySpace")}
                                >
                                    <View style={[styles.statIcon, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                                        <Ionicons name="person" size={20} color="#a855f7" />
                                    </View>
                                    <View style={styles.statTextContent}>
                                        <Text
                                            style={[styles.statValue, { color: colors.text }]}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.65}
                                        >
                                            My Space
                                        </Text>
                                        <Text
                                            style={[styles.statTitle, { color: "#888888" }]}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.7}
                                        >
                                            Personal
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    ref={teamRef}
                                    style={[styles.statBox, { backgroundColor: "#111111", borderColor: "rgba(255,255,255,0.04)" }]}
                                    activeOpacity={0.7}
                                    onPress={() => (navigation as any).navigate("TeamList")}
                                    onLongPress={() => openPreview("teams", teamRef)}
                                    delayLongPress={300}
                                >
                                    <View style={[styles.statIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                                        <Ionicons name="chatbubble" size={20} color="#10b981" />
                                    </View>
                                    <View style={styles.statTextContent}>
                                        <Text
                                            style={[styles.statValue, { color: colors.text }]}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.65}
                                        >
                                            Teams
                                        </Text>
                                        <Text
                                            style={[styles.statTitle, { color: "#888888" }]}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.7}
                                        >
                                            Messaging
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Hint text */}
                    <Text style={styles.hintText}>Long-press a tile for a quick preview</Text>

                    {/* Due Soon Section */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Due soon</Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate("MyTasks", { screen: "_Base" } as any)}
                        >
                            <Text style={styles.viewAllBtn}>View board</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ gap: 4, marginBottom: SPACING.xl }}>
                        {dueSoonTasks.map((task) => (
                            <TouchableOpacity
                                key={task.id}
                                style={styles.taskCard}
                                activeOpacity={0.8}
                                onPress={() => navigation.navigate("TaskDetail", { taskId: task.id } as any)}
                            >
                                <View style={[styles.taskIndicatorBar, { backgroundColor: task.color }]} />
                                <View style={styles.taskMain}>
                                    <Text style={styles.taskTitle} numberOfLines={1}>
                                        {task.name}
                                    </Text>
                                    <Text style={styles.taskSubtitle} numberOfLines={1}>
                                        {task.projectName}
                                    </Text>
                                </View>
                                <View style={[styles.taskBadge, { backgroundColor: task.badgeBg }]}>
                                    <Text style={[styles.taskBadgeText, { color: task.badgeText }]}>
                                        {task.dueDateStr}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                </View>
            </ScrollView>

            <WidgetPreviewModal
                target={previewTarget}
                position={previewPos}
                onClose={() => setPreviewTarget(null)}
            />

            <Sheet
                visible={wsSwitcherVisible}
                onClose={() => setWsSwitcherVisible(false)}
                accessibilityLabel="Switch workspace"
            >
                <View style={styles.sheetContent}>
                    <Text style={[styles.sheetTitle, { color: colors.text, marginBottom: SPACING.md }]}>
                        Switch Workspace
                    </Text>
                    {workspaces.map((ws) => {
                        const active = ws.id === activeWorkspace?.id;
                        return (
                            <PressableScale
                                key={ws.id}
                                haptic="selection"
                                onPress={() => handleSwitchWorkspace(ws)}
                                accessibilityRole="button"
                                accessibilityLabel={ws.name}
                                accessibilityState={{ selected: active, busy: switchingId === ws.id }}
                                style={[styles.wsItem, { borderBottomColor: colors.divider }]}
                            >
                                <View style={[styles.wsAvatarSmall, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.avatarTextSmall}>{ws.name.charAt(0).toUpperCase()}</Text>
                                </View>
                                <Text style={[styles.wsNameSmall, { color: colors.text }]} numberOfLines={1}>{ws.name}</Text>
                                {switchingId === ws.id ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : active ? (
                                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                                ) : null}
                            </PressableScale>
                        );
                    })}
                </View>
            </Sheet>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#000000" },
    scrollContent: { paddingBottom: 24 },

    header: { paddingVertical: SPACING.sm, marginBottom: SPACING.sm },
    headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    actionCircleBtn: { 
        width: 42, 
        height: 42, 
        borderRadius: 21, 
        borderWidth: 1, 
        borderColor: "rgba(255,255,255,0.08)", 
        backgroundColor: "#111111", 
        justifyContent: "center", 
        alignItems: "center",
        position: "relative" 
    },
    badge: { position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

    workspaceNameSimple: { fontSize: 24, fontWeight: "700", letterSpacing: 0.5 },

    dropdownMenu: { position: 'absolute', top: 50, right: 0, width: 170, padding: SPACING.sm, zIndex: 100 },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, gap: SPACING.md },
    dropdownText: { fontSize: 14, fontWeight: '500' },

    progressCard: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#111111",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    progressLeft: {
        justifyContent: "center",
    },
    progressLabel: {
        fontSize: 10,
        fontWeight: "800",
        color: "#f59e0b",
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    progressValue: {
        fontSize: 24,
        fontWeight: "800",
        color: "#ffffff",
    },
    progressRight: {
        justifyContent: "center",
        alignItems: "center",
    },

    statBox: { 
        flex: 1, 
        height: 115, 
        padding: 14, 
        borderRadius: BORDER_RADIUS.lg, 
        borderWidth: 1, 
        flexDirection: "column", 
        alignItems: "flex-start", 
        justifyContent: "space-between" 
    },
    statIcon: { 
        width: 36, 
        height: 36, 
        borderRadius: 10, 
        justifyContent: "center", 
        alignItems: "center" 
    },
    statTextContent: { 
        marginTop: "auto",
        width: "100%"
    },
    statValue: { fontSize: 16, fontWeight: "700" },
    statTitle: { fontSize: 12, fontWeight: "500" },

    hintText: {
        fontSize: 11,
        color: "#555555",
        fontWeight: "500",
        textAlign: "center",
        marginTop: 4,
        marginBottom: 20,
    },

    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#ffffff",
    },
    viewAllBtn: {
        fontSize: 14,
        fontWeight: "600",
        color: "#f59e0b",
    },

    taskCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111111",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.04)",
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    taskIndicatorBar: {
        width: 3,
        height: 32,
        borderRadius: 1.5,
        marginRight: 12,
    },
    taskMain: {
        flex: 1,
        justifyContent: "center",
    },
    taskTitle: {
        fontSize: 15,
        fontWeight: "600",
        color: "#ffffff",
    },
    taskSubtitle: {
        fontSize: 12,
        color: "#888888",
        marginTop: 3,
    },
    taskBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    taskBadgeText: {
        fontSize: 11,
        fontWeight: "700",
    },

    sheetTitle: { fontSize: 17, fontWeight: "700" },
    sheetContent: { paddingHorizontal: SPACING.lg },

    wsItem: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md, borderBottomWidth: 1 },
    wsAvatarSmall: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    avatarTextSmall: { color: "#fff", fontWeight: "700", fontSize: 16 },
    wsNameSmall: { flex: 1, marginLeft: SPACING.md, fontSize: 16, fontWeight: "500" },
});
