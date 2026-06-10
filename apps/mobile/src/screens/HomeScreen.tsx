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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useNotifications } from "../context/NotificationContext";
import { MainTabParamList, RootStackParamList } from "../types";
import { format } from "date-fns";
import WidgetPreviewModal from "../components/WidgetPreviewModal";
import PressableScale from "../components/PressableScale";
import { haptics } from "../services/haptics";
import AttendanceWidget from "../components/AttendanceWidget";
import { useResponsive } from "../hooks/useResponsive";

type Props = CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, "Home">,
    NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: Props) {
    const {
        activeWorkspace,
        stats,
        loading: wsLoading,
        refreshWorkspaces,
    } = useWorkspace();
    const { colors, isDark, toggleTheme } = useTheme();
    const { unreadCount } = useNotifications();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            {isMenuOpen && (
                <Pressable
                    style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
                    onPress={() => setIsMenuOpen(false)}
                />
            )}

            {/* Header */}
            <View style={[styles.header, { zIndex: 20, paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                <View style={[styles.headerContent, { maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }]}>
                    {/* Left side: Workspace Title */}
                    <View style={{ flex: 1, marginRight: SPACING.md }}>
                        {wsLoading && !activeWorkspace ? (
                            <Animated.View style={{ width: 140, height: 24, borderRadius: 6, backgroundColor: colors.border + "50", marginVertical: 4, opacity: shimmerAnim }} />
                        ) : (
                            <Text style={[styles.workspaceNameSimple, { color: colors.text }]} numberOfLines={1}>
                                {activeWorkspace?.name ?? "Trava Tasks"}
                            </Text>
                        )}
                        <Text style={{ color: colors.textDim, fontSize: 13, fontWeight: "500", marginTop: 2 }}>
                            {format(currentTime, 'EEEE, MMM d • h:mm a')}
                        </Text>
                    </View>

                    {/* Right side: Actions */}
                    <View style={{ flexDirection: "row", gap: SPACING.sm, position: 'relative' }}>
                        <PressableScale
                            style={[styles.notificationBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            onPress={() => (navigation as any)?.navigate("Notifications")}
                            accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                        >
                            <Ionicons name="notifications-outline" size={24} color={colors.text} />
                            {unreadCount > 0 && (
                                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                                </View>
                            )}
                        </PressableScale>

                        <PressableScale
                            style={[styles.notificationBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            onPress={() => setIsMenuOpen(!isMenuOpen)}
                            haptic="selection"
                            accessibilityLabel="More options"
                            accessibilityState={{ expanded: isMenuOpen }}
                        >
                            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
                        </PressableScale>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                            <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                                {/* 
                                <TouchableOpacity
                                    style={styles.dropdownItem}
                                    onPress={() => {
                                        setIsMenuOpen(false);
                                        (navigation as any)?.navigate("Procurement");
                                    }}
                                >
                                    <Ionicons name="cart-outline" size={20} color={colors.text} />
                                    <Text style={[styles.dropdownText, { color: colors.text }]}>Procurement</Text>
                                </TouchableOpacity>
                                */}
                            </View>
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

                    {wsLoading ? (
                        <View style={{ gap: SPACING.md, marginBottom: SPACING.xl }}>
                            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                                <Animated.View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border, opacity: shimmerAnim }]}>
                                    <View style={[styles.statIcon, { backgroundColor: colors.border + "40" }]} />
                                    <View style={styles.statTextContent}>
                                        <View style={{ width: 45, height: 16, borderRadius: 4, backgroundColor: colors.border + "40", marginBottom: 6 }} />
                                        <View style={{ width: 75, height: 12, borderRadius: 4, backgroundColor: colors.border + "40" }} />
                                    </View>
                                </Animated.View>
                                <Animated.View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border, opacity: shimmerAnim }]}>
                                    <View style={[styles.statIcon, { backgroundColor: colors.border + "40" }]} />
                                    <View style={styles.statTextContent}>
                                        <View style={{ width: 35, height: 16, borderRadius: 4, backgroundColor: colors.border + "40", marginBottom: 6 }} />
                                        <View style={{ width: 55, height: 12, borderRadius: 4, backgroundColor: colors.border + "40" }} />
                                    </View>
                                </Animated.View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                                <Animated.View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border, opacity: shimmerAnim }]}>
                                    <View style={[styles.statIcon, { backgroundColor: colors.border + "40" }]} />
                                    <View style={styles.statTextContent}>
                                        <View style={{ width: 65, height: 16, borderRadius: 4, backgroundColor: colors.border + "40", marginBottom: 6 }} />
                                        <View style={{ width: 45, height: 12, borderRadius: 4, backgroundColor: colors.border + "40" }} />
                                    </View>
                                </Animated.View>
                                <Animated.View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border, opacity: shimmerAnim }]}>
                                    <View style={[styles.statIcon, { backgroundColor: colors.border + "40" }]} />
                                    <View style={styles.statTextContent}>
                                        <View style={{ width: 50, height: 16, borderRadius: 4, backgroundColor: colors.border + "40", marginBottom: 6 }} />
                                        <View style={{ width: 60, height: 12, borderRadius: 4, backgroundColor: colors.border + "40" }} />
                                    </View>
                                </Animated.View>
                            </View>
                        </View>
                    ) : (
                        <View style={{ gap: SPACING.md, marginBottom: SPACING.xl }}>

                            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                                {activeWorkspace?.id && (
                                    <AttendanceWidget
                                        ref={attRef}
                                        workspaceId={activeWorkspace.id}
                                        variant="mini"
                                        onLongPress={() => openPreview("attendance", attRef)}
                                    />
                                )}
                                <TouchableOpacity
                                    ref={projRef}
                                    style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, width: 'auto' }]}
                                    activeOpacity={0.7}
                                    onPress={() => navigation.navigate("Projects", { screen: "_Base" } as any)}
                                    onLongPress={() => openPreview("projects", projRef)}
                                    delayLongPress={300}
                                >
                                    <View style={[styles.statIcon, { backgroundColor: "#3b82f620" }]}>
                                        <Ionicons name="layers" size={20} color="#3b82f6" />
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
                                            style={[styles.statTitle, { color: colors.textDim }]}
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
                                    style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, width: 'auto' }]}
                                    activeOpacity={0.7}
                                    onPress={() => (navigation as any).navigate("MySpace")}
                                >
                                    <View style={[styles.statIcon, { backgroundColor: "#a855f720" }]}>
                                        <Ionicons name="person-circle" size={20} color="#a855f7" />
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
                                            style={[styles.statTitle, { color: colors.textDim }]}
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
                                    style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, width: 'auto' }]}
                                    activeOpacity={0.7}
                                    onPress={() => (navigation as any).navigate("TeamList")}
                                    onLongPress={() => openPreview("teams", teamRef)}
                                    delayLongPress={300}
                                >
                                    <View style={[styles.statIcon, { backgroundColor: "#10b98120" }]}>
                                        <Ionicons name="chatbubbles" size={20} color="#10b981" />
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
                                            style={[styles.statTitle, { color: colors.textDim }]}
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
                </View>
            </ScrollView>

            <WidgetPreviewModal
                target={previewTarget}
                position={previewPos}
                onClose={() => setPreviewTarget(null)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 20 },

    header: { paddingVertical: SPACING.sm, marginBottom: SPACING.sm },
    headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    notificationBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", borderWidth: 1, position: "relative" },
    badge: { position: "absolute", top: 8, right: 8, minWidth: 16, height: 16, borderRadius: 8, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

    workspaceNameSimple: { fontSize: 24, fontWeight: "700", letterSpacing: 0.5 },

    dropdownMenu: { position: 'absolute', top: 50, right: 0, width: 160, borderRadius: BORDER_RADIUS.md, borderWidth: 1, padding: SPACING.sm, zIndex: 100, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, gap: SPACING.md },
    dropdownText: { fontSize: 14, fontWeight: '500' },

    statsGrid: { flexDirection: "row", gap: SPACING.md, marginBottom: SPACING.xl },
    statBox: { flex: 1, height: 80, paddingHorizontal: 14, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, flexDirection: "row", alignItems: "center" },
    statIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 12 },
    statTextContent: { flex: 1, justifyContent: 'center' },
    statValue: { fontSize: 17, fontWeight: "800", letterSpacing: -0.5 },
    statTitle: { fontSize: 12, fontWeight: "500", marginTop: 2 },
    scrollArrow: {
        position: 'absolute',
        top: '50%',
        marginTop: -15,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        zIndex: 10,
    },
    leftArrow: {
        left: -10,
    },
    rightArrow: {
        right: -10,
    },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
    bottomSheet: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, paddingBottom: 40, maxHeight: "80%" },
    sheetHeader: { alignItems: "center", paddingVertical: SPACING.md, borderBottomWidth: 1 },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, marginBottom: SPACING.md },
    sheetTitle: { fontSize: 17, fontWeight: "700" },
    sheetContent: { paddingHorizontal: SPACING.lg },

    wsItem: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md, borderBottomWidth: 1 },
    wsItemActive: { backgroundColor: "transparent" },
    wsAvatarSmall: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    avatarTextSmall: { color: "#fff", fontWeight: "700", fontSize: 16 },
    wsNameSmall: { flex: 1, marginLeft: SPACING.md, fontSize: 16, fontWeight: "500" },

    createWsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", margin: SPACING.lg, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderStyle: "dashed" },
    createWsText: { marginLeft: SPACING.sm, fontWeight: "600" },
});
