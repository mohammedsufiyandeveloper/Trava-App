import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    RefreshControl,
    Animated,
    ActivityIndicator,
    Alert,
    Platform,
    Linking,
    PanResponder,
    Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { format } from "date-fns";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";

import { SPACING, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useNotifications } from "../context/NotificationContext";
import { MainTabParamList, RootStackParamList, Workspace, Task } from "../types";
import WidgetPreviewModal from "../components/WidgetPreviewModal";
import HeaderMenu from "../components/HeaderMenu";
import PressableScale from "../components/PressableScale";
import { haptics } from "../services/haptics";
import { useResponsive } from "../hooks/useResponsive";
import Sheet from "../components/Sheet";
import ConfirmationSheet from "../components/ConfirmationSheet";
import { getProfile, submitCheckIn, submitCheckOut } from "../services/api";

/** Card top margin (SPACING.md) + card padding + header row height + gap. */
const MENU_TOP_OFFSET = SPACING.md + 16 + 42 + 8;

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
        loading: wsLoading,
        refreshWorkspaces,
        switchWorkspace,
        todayAttendance,
        teamAttendance,
        setTodayAttendance,
    } = useWorkspace();
    const { colors, isDark, toggleTheme } = useTheme();
    const { unreadCount } = useNotifications();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const isAdminOrOwner = activeWorkspace?.workspaceRole === "OWNER" || activeWorkspace?.workspaceRole === "ADMIN";

    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
    const [wsSwitcherVisible, setWsSwitcherVisible] = useState<boolean>(false);
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [previewTarget, setPreviewTarget] = useState<"projects" | "teams" | "attendance" | null>(null);
    const [previewPos, setPreviewPos] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const [profile, setProfile] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [checkOutSheetVisible, setCheckOutSheetVisible] = useState<boolean>(false);

    const projRef = React.useRef<any>(null);
    const teamRef = React.useRef<any>(null);
    const attRef = React.useRef<any>(null);
    const shimmerAnim = React.useRef(new Animated.Value(0.3)).current;

    // Draggable AI Floating Button
    const pan = useRef(new Animated.ValueXY()).current;
    const [isDraggable, setIsDraggable] = useState(false);
    const longPressTimeout = useRef<any>(null);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
            },
            onPanResponderGrant: (evt, gestureState) => {
                longPressTimeout.current = setTimeout(() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setIsDraggable(true);
                }, 400);

                pan.setOffset({
                    x: (pan.x as any)._value,
                    y: (pan.y as any)._value
                });
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: (evt, gestureState) => {
                if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) {
                    if (longPressTimeout.current) {
                        clearTimeout(longPressTimeout.current);
                        longPressTimeout.current = null;
                    }
                }

                Animated.event(
                    [null, { dx: pan.x, dy: pan.y }],
                    { useNativeDriver: false }
                )(evt, gestureState);
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (longPressTimeout.current) {
                    clearTimeout(longPressTimeout.current);
                    longPressTimeout.current = null;
                }
                pan.flattenOffset();
                setIsDraggable(false);

                if (Math.abs(gestureState.dx) < 8 && Math.abs(gestureState.dy) < 8) {
                    haptics.selection();
                    navigation.navigate("AI");
                }
            },
            onPanResponderTerminate: () => {
                if (longPressTimeout.current) {
                    clearTimeout(longPressTimeout.current);
                    longPressTimeout.current = null;
                }
                setIsDraggable(false);
            }
        })
    ).current;

    const fetchProfile = async () => {
        try {
            const data = await getProfile();
            if (data?.success) {
                setProfile(data.user);
            }
        } catch (err) {
            console.error("Failed to fetch profile on home screen:", err);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const openLocationSettings = () => {
        if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
        } else {
            Linking.openSettings();
        }
    };

    const handleCheckAction = async (type: 'check-in' | 'check-out') => {
        if (!activeWorkspace) return;
        setActionLoading(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                haptics.error();
                Alert.alert(
                    'Location access needed',
                    'Trava needs location access to record attendance. Enable it for this app in your device settings, then try again.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Open Settings', onPress: openLocationSettings },
                    ]
                );
                setActionLoading(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

            const todayString = new Date().toISOString().split('T')[0];
            const latitude = location.coords.latitude;
            const longitude = location.coords.longitude;

            let addressString = "";
            try {
                const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (geocode && geocode.length > 0) {
                    const place = geocode[0];
                    addressString = [place.name || place.streetNumber, place.street, place.city || place.subregion, place.region].filter(Boolean).join(", ");
                }
            } catch (err) {
                console.warn("Reverse geocoding failed", err);
            }

            if (type === 'check-in') {
                const result = await submitCheckIn(activeWorkspace.id, latitude, longitude, addressString, todayString);
                setTodayAttendance(result);
                haptics.success();
                Alert.alert('Checked In', 'Checked in successfully!');
            } else {
                const result = await submitCheckOut(activeWorkspace.id, latitude, longitude, addressString, todayString);
                setTodayAttendance(result);
                setCheckOutSheetVisible(false);
                haptics.success();
                Alert.alert('Checked Out', 'Checked out successfully!');
            }
        } catch (error: any) {
            haptics.error();
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setActionLoading(false);
        }
    };

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

    /**
     * The menu renders in a Modal (nested in the card it would sit under any
     * full-screen dismiss layer, which swallows its taps) but is placed by
     * layout, not by measureInWindow — under Android edge-to-edge the modal's
     * window and the measured coordinates don't share an origin, which pushed
     * the menu up over the header by the status bar height.
     */
    const openMenu = () => {
        haptics.selection();
        setIsMenuOpen(true);
    };

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
            await fetchProfile();
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



    const isCheckedIn = !!(todayAttendance && todayAttendance.checkIn);
    const isCheckedOut = !!(todayAttendance && todayAttendance.checkOut);

    const getCheckInStatusText = () => {
        if (isCheckedOut) return "Shift Done";
        if (isCheckedIn) return "Check Out";
        return "Check In";
    };

    const getLocationText = () => {
        if (isCheckedIn && todayAttendance?.checkInAddress) {
            return `Location : ${todayAttendance.checkInAddress}`;
        }
        if (isCheckedIn && todayAttendance?.checkInLatitude) {
            return `Location : ${todayAttendance.checkInLatitude.toFixed(4)}, ${todayAttendance.checkInLongitude.toFixed(4)}`;
        }
        return "Location : You are not in office";
    };

    const handleBigButtonPress = () => {
        if (isCheckedOut) return;
        if (isCheckedIn) {
            haptics.warning();
            setCheckOutSheetVisible(true);
        } else {
            handleCheckAction('check-in');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <View style={[styles.mainContentContainer, { maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center', flex: 1, paddingHorizontal: value(SPACING.md, SPACING.lg, SPACING.xl), paddingBottom: SPACING.md }]}>

                {/* Top Main Card */}
                <View style={[styles.mainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {/* Card Header: Workspace Name, Notification Bell, User Avatar */}
                    <View style={styles.cardHeaderRow}>
                        <View style={StyleSheet.absoluteFill}>
                            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                                <Text style={[styles.workspaceNameHeader, { color: colors.text }]} numberOfLines={1}>
                                    {activeWorkspace?.name ?? "Trava Tasks"}
                                </Text>
                            </View>
                        </View>
                        <View style={{ flex: 1 }} />

                        <View style={{ flexDirection: "row", gap: SPACING.sm, alignItems: "center", zIndex: 10 }}>
                            <TouchableOpacity
                                style={[styles.bellBtn, { backgroundColor: "transparent" }]}
                                onPress={() => {
                                    haptics.light();
                                    toggleTheme();
                                }}
                                accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
                                accessibilityRole="button"
                            >
                                <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={colors.text} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.bellBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}
                                onPress={() => (navigation as any)?.navigate("Notifications")}
                                accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                            >
                                <Ionicons name="notifications-outline" size={20} color={colors.text} />
                                {unreadCount > 0 && (
                                    <View style={[styles.blackBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                                        <Text style={styles.blackBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Welcome Back & Name */}
                    <View style={{ paddingHorizontal: SPACING.xs, marginTop: -10 }}>
                        <Text style={[styles.welcomeText, { color: colors.textDim }]}>Welcome back,</Text>
                        <Text style={[styles.profileNameText, { color: colors.text }]}>
                            {profile?.name ?? "Sufiyan"}
                        </Text>
                    </View>

                    {/* Day and Date */}
                    <View style={{ alignItems: "center", marginTop: SPACING.sm }}>
                        <Text style={[styles.dayText, { color: colors.text }]}>
                            {format(currentTime, 'EEEE')}
                        </Text>
                        <Text style={[styles.dateText, { color: colors.textDim }]}>
                            {format(currentTime, 'MMM d - yyyy')}
                        </Text>
                    </View>

                    {/* Big Liquid Circular Button */}
                    <View style={{ alignItems: "center", marginVertical: SPACING.sm }}>
                        <View style={[styles.circularCheckShadow, isCheckedOut && { opacity: 0.6 }]}>
                            <TouchableOpacity
                                style={styles.circularCheckButton}
                                activeOpacity={0.85}
                                onPress={handleBigButtonPress}
                                disabled={actionLoading || isCheckedOut}
                                accessibilityRole="button"
                                accessibilityLabel={getCheckInStatusText()}
                                accessibilityState={{ disabled: actionLoading || isCheckedOut, busy: actionLoading }}
                            >
                                {/* Liquid glass body — brand primary #fbb54a */}
                                <LinearGradient
                                    colors={["#ffd694", "#fbb54a", "#e0972a"]}
                                    locations={[0, 0.55, 1]}
                                    start={{ x: 0.15, y: 0 }}
                                    end={{ x: 0.85, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />
                                {/* Top-left specular sheen */}
                                <View style={styles.circleSheenTop} pointerEvents="none" />
                                {/* Bottom-right soft bounce light */}
                                <View style={styles.circleSheenBottom} pointerEvents="none" />
                                {/* Rim highlight */}
                                <View style={styles.circleRim} pointerEvents="none" />

                                {actionLoading ? (
                                    <ActivityIndicator size="large" color="#2b1c04" />
                                ) : (
                                    <Text style={styles.circularButtonText}>
                                        {getCheckInStatusText()}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bottom Location Indicator */}
                    <View style={styles.locationContainer}>
                        <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                        <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                            {getLocationText()}
                        </Text>
                    </View>
                </View>

                {/* Spacing spacer */}
                <View style={{ height: 12 }} />

                {/* Bottom grid (2x2) */}
                <View style={styles.gridContainer}>
                    {isAdminOrOwner ? (
                        <>
                            {/* Row 1 */}
                            <View style={styles.gridRow}>
                                {/* Card 1: Team Roster */}
                                <TouchableOpacity
                                    ref={attRef}
                                    style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    activeOpacity={0.8}
                                    onPress={() => navigation.navigate("Attendance")}
                                    onLongPress={() => openPreview("attendance", attRef)}
                                    delayLongPress={300}
                                >
                                    <View style={styles.gridCardHeader}>
                                        <MaterialCommunityIcons name="account-group-outline" size={22} color={colors.text} />
                                    </View>
                                    <Text style={[styles.gridCardValue, { color: colors.text }]}>
                                        {teamAttendance ? `${teamAttendance.filter((r: any) => !!r.attendance?.checkIn).length} / ${teamAttendance.length}` : "32 / 38"}
                                    </Text>
                                    <Text style={[styles.gridCardTitle, { color: colors.textDim }]}>Team Roster</Text>
                                    <View style={[styles.arrowCircle, { backgroundColor: colors.primary + "24" }]}>
                                        <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                                    </View>
                                </TouchableOpacity>

                                {/* Card 2: Projects */}
                                <TouchableOpacity
                                    ref={projRef}
                                    style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    activeOpacity={0.8}
                                    onPress={() => navigation.navigate("Projects", { screen: "_Base" } as any)}
                                    onLongPress={() => openPreview("projects", projRef)}
                                    delayLongPress={300}
                                >
                                    <View style={styles.gridCardHeader}>
                                        <MaterialCommunityIcons name="view-dashboard-outline" size={20} color={colors.text} />
                                    </View>
                                    <Text style={[styles.gridCardValue, { color: colors.text }]}>
                                        {stats.totalProjects}
                                    </Text>
                                    <Text style={[styles.gridCardTitle, { color: colors.textDim }]}>Projects</Text>
                                    <View style={[styles.arrowCircle, { backgroundColor: colors.primary + "24" }]}>
                                        <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Row 2 */}
                            <View style={styles.gridRow}>
                                {/* Card 3: Teams */}
                                <TouchableOpacity
                                    ref={teamRef}
                                    style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    activeOpacity={0.8}
                                    onPress={() => (navigation as any).navigate("TeamList")}
                                    onLongPress={() => openPreview("teams", teamRef)}
                                    delayLongPress={300}
                                >
                                    <View style={styles.gridCardHeader}>
                                        <MaterialCommunityIcons name="forum-outline" size={20} color={colors.text} />
                                    </View>
                                    <Text style={[styles.gridCardValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                                        Teams
                                    </Text>
                                    <Text style={[styles.gridCardTitle, { color: colors.textDim }]}>Messaging</Text>
                                    <View style={[styles.arrowCircle, { backgroundColor: colors.primary + "24" }]}>
                                        <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                                    </View>
                                </TouchableOpacity>

                                {/* Card 4: My Space */}
                                <TouchableOpacity
                                    style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    activeOpacity={0.8}
                                    onPress={() => (navigation as any).navigate("MySpace")}
                                >
                                    <View style={styles.gridCardHeader}>
                                        <View style={{ position: "relative", width: 22, height: 22, justifyContent: "center", alignItems: "center" }}>
                                            <MaterialCommunityIcons name="hexagon-outline" size={22} color={colors.text} style={{ position: "absolute" }} />
                                            <MaterialCommunityIcons name="account-outline" size={12} color={colors.text} style={{ position: "absolute" }} />
                                        </View>
                                    </View>
                                    <Text style={[styles.gridCardValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                                        My Space
                                    </Text>
                                    <Text style={[styles.gridCardTitle, { color: colors.textDim }]}>Personal</Text>
                                    <View style={[styles.arrowCircle, { backgroundColor: colors.primary + "24" }]}>
                                        <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            {/* Row 1 */}
                            <View style={styles.gridRow}>
                                {/* Card 2: Projects */}
                                <TouchableOpacity
                                    ref={projRef}
                                    style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    activeOpacity={0.8}
                                    onPress={() => navigation.navigate("Projects", { screen: "_Base" } as any)}
                                    onLongPress={() => openPreview("projects", projRef)}
                                    delayLongPress={300}
                                >
                                    <View style={styles.gridCardHeader}>
                                        <MaterialCommunityIcons name="view-dashboard-outline" size={20} color={colors.text} />
                                    </View>
                                    <Text style={[styles.gridCardValue, { color: colors.text }]}>
                                        {stats.totalProjects}
                                    </Text>
                                    <Text style={[styles.gridCardTitle, { color: colors.textDim }]}>Projects</Text>
                                    <View style={[styles.arrowCircle, { backgroundColor: colors.primary + "24" }]}>
                                        <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                                    </View>
                                </TouchableOpacity>

                                {/* Card 3: Teams */}
                                <TouchableOpacity
                                    ref={teamRef}
                                    style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    activeOpacity={0.8}
                                    onPress={() => (navigation as any).navigate("TeamList")}
                                    onLongPress={() => openPreview("teams", teamRef)}
                                    delayLongPress={300}
                                >
                                    <View style={styles.gridCardHeader}>
                                        <MaterialCommunityIcons name="forum-outline" size={20} color={colors.text} />
                                    </View>
                                    <Text style={[styles.gridCardValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                                        Teams
                                    </Text>
                                    <Text style={[styles.gridCardTitle, { color: colors.textDim }]}>Messaging</Text>
                                    <View style={[styles.arrowCircle, { backgroundColor: colors.primary + "24" }]}>
                                        <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Row 2 */}
                            <View style={styles.gridRow}>
                                {/* Card 4: My Space */}
                                <TouchableOpacity
                                    style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                    activeOpacity={0.8}
                                    onPress={() => (navigation as any).navigate("MySpace")}
                                >
                                    <View style={styles.gridCardHeader}>
                                        <View style={{ position: "relative", width: 22, height: 22, justifyContent: "center", alignItems: "center" }}>
                                            <MaterialCommunityIcons name="hexagon-outline" size={22} color={colors.text} style={{ position: "absolute" }} />
                                            <MaterialCommunityIcons name="account-outline" size={12} color={colors.text} style={{ position: "absolute" }} />
                                        </View>
                                    </View>
                                    <Text style={[styles.gridCardValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                                        My Space
                                    </Text>
                                    <Text style={[styles.gridCardTitle, { color: colors.textDim }]}>Personal</Text>
                                    <View style={[styles.arrowCircle, { backgroundColor: colors.primary + "24" }]}>
                                        <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                                    </View>
                                </TouchableOpacity>

                                {/* Spacer placeholder view to keep sizes equal */}
                                <View style={{ flex: 1 }} />
                            </View>
                        </>
                    )}
                </View>

                {/* Trailing spacer — keeps the card + widgets grouped at the top */}
                <View style={{ flex: 1 }} />

            </View>

            <HeaderMenu
                visible={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                top={MENU_TOP_OFFSET}
                right={value(SPACING.md, SPACING.lg, SPACING.xl) + 16}
                items={[
                    {
                        icon: isDark ? "sunny-outline" : "moon-outline",
                        label: isDark ? "Light Mode" : "Dark Mode",
                        accessibilityLabel: isDark ? "Switch to light mode" : "Switch to dark mode",
                        onPress: () => { toggleTheme(); setIsMenuOpen(false); },
                    },
                    {
                        icon: "sparkles-outline",
                        label: "Trava AI",
                        color: colors.primary,
                        onPress: () => { setIsMenuOpen(false); (navigation as any)?.navigate("AI"); },
                    },
                ]}
            />

            <WidgetPreviewModal
                target={previewTarget}
                position={previewPos}
                onClose={() => setPreviewTarget(null)}
            />



            <ConfirmationSheet
                visible={checkOutSheetVisible}
                title="Confirm Check Out"
                description="Are you sure you want to check out? This will end your shift for today."
                confirmLabel="Check Out"
                cancelLabel="Cancel"
                tone="warning"
                loading={actionLoading}
                onConfirm={() => handleCheckAction('check-out')}
                onClose={() => setCheckOutSheetVisible(false)}
            />
            {/* Draggable AI Floating Button */}
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.floatingAI,
                    {
                        transform: [
                            { translateX: pan.x },
                            { translateY: pan.y },
                            { scale: isDraggable ? 1.15 : 1 }
                        ],
                        backgroundColor: "transparent",
                    }
                ]}
            >
                <MaterialCommunityIcons 
                    name="robot" 
                    size={28} 
                    color={colors.primary} 
                    style={{
                        textShadowColor: colors.primary,
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 6
                    }}
                />
            </Animated.View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    mainContentContainer: { paddingVertical: SPACING.md },

    mainCard: {
        borderRadius: 28,
        borderWidth: 1,
        padding: 16,
        paddingBottom: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
    },
    cardHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        position: "relative",
        height: 42,
    },
    workspaceNameHeader: {
        fontSize: 15,
        fontFamily: FONTS.bold,
        letterSpacing: 0.3,
    },
    bellBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
    },
    blackBadge: {
        position: "absolute",
        top: -3,
        right: -3,
        minWidth: 17,
        height: 17,
        borderRadius: 9,
        borderWidth: 1.5,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 4,
    },
    blackBadgeText: {
        color: "#2b1c04",
        fontSize: 9,
        fontFamily: FONTS.bold,
    },
    welcomeText: {
        fontSize: 15,
        fontFamily: FONTS.medium,
        letterSpacing: 0.1,
    },
    profileNameText: {
        fontSize: 26,
        fontFamily: FONTS.extrabold,
        letterSpacing: -0.4,
        marginTop: 1,
    },
    dayText: {
        fontSize: 32,
        fontFamily: FONTS.extrabold,
        letterSpacing: -0.8,
    },
    dateText: {
        fontSize: 14,
        fontFamily: FONTS.medium,
        letterSpacing: 0.2,
        marginTop: 2,
    },
    circularCheckShadow: {
        borderRadius: 62,
        // Coloured glow rather than a neutral drop shadow, so the brand hue
        // reads even on a white card.
        shadowColor: "#e0972a",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.55,
        shadowRadius: 18,
        elevation: 12,
    },
    circularCheckButton: {
        width: 124,
        height: 124,
        borderRadius: 62,
        backgroundColor: "#fbb54a",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    circleSheenTop: {
        position: "absolute",
        top: -28,
        left: -18,
        width: 122,
        height: 88,
        borderRadius: 61,
        backgroundColor: "rgba(255,255,255,0.32)",
        transform: [{ rotate: "-18deg" }],
    },
    circleSheenBottom: {
        position: "absolute",
        bottom: -24,
        right: -13,
        width: 96,
        height: 60,
        borderRadius: 48,
        backgroundColor: "rgba(255,255,255,0.14)",
        transform: [{ rotate: "-14deg" }],
    },
    circleRim: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 62,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.45)",
    },
    circularButtonText: {
        // Dark ink on the amber face — white would fail contrast on #fbb54a.
        color: "#2b1c04",
        fontSize: 18,
        fontFamily: FONTS.extrabold,
        letterSpacing: 0.2,
    },
    locationContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    locationText: {
        fontSize: 12.5,
        fontFamily: FONTS.medium,
        letterSpacing: 0.1,
        maxWidth: "85%",
    },

    gridContainer: {
        height: 196,
        gap: 12,
    },
    gridRow: {
        flexDirection: "row",
        gap: 12,
        flex: 1,
    },
    gridCard: {
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        padding: 13,
        justifyContent: "space-between",
        position: "relative",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    gridCardHeader: {
        alignItems: "flex-start",
    },
    gridCardValue: {
        fontSize: 20,
        fontFamily: FONTS.extrabold,
        letterSpacing: -0.3,
    },
    gridCardTitle: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        letterSpacing: 0.1,
    },
    arrowCircle: {
        position: "absolute",
        bottom: 13,
        right: 13,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },

    sheetTitle: { fontSize: 17, fontFamily: FONTS.bold },
    sheetContent: { paddingHorizontal: SPACING.lg },

    wsItem: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md, borderBottomWidth: 1 },
    wsAvatarSmall: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    avatarTextSmall: { color: "#fff", fontFamily: FONTS.bold, fontSize: 16 },
    wsNameSmall: { flex: 1, marginLeft: SPACING.md, fontSize: 16, fontFamily: FONTS.medium },

    floatingAI: {
        position: "absolute",
        right: 20,
        bottom: 80,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
    },
});
