import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Image,
    Linking,
    Modal,
    Platform,
    Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import BlurView from "../components/BlurView";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { format, addDays } from "date-fns";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";
import { useWorkspace } from "../context/WorkspaceContext";
import {
    getTodayAttendance,
    getTeamAttendance,
    submitCheckIn,
    submitCheckOut,
    getCachedSession,
    getMemberAttendanceStats,
    getWorkspaceAttendanceLogs,
} from "../services/api";
import { useResponsive } from "../hooks/useResponsive";
import StatusChip, { StatusKind } from "../components/StatusChip";
import ConfirmationSheet from "../components/ConfirmationSheet";
import AppCard from "../components/AppCard";
import PressableScale from "../components/PressableScale";

type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" | "LATE" | "OUT";

interface AttendanceRecord {
    id: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    checkInLatitude: number | null;
    checkInLongitude: number | null;
    checkOutLatitude: number | null;
    checkOutLongitude: number | null;
    status: AttendanceStatus;
    notes: string | null;
    checkInAddress?: string | null;
    checkOutAddress?: string | null;
}

function formatTime(ts: string | null): string {
    if (!ts) return "—";
    return format(new Date(ts), "hh:mm a");
}

function calcDuration(checkIn: string | null, checkOut: string | null): string {
    if (!checkIn || !checkOut) return "—";
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    if (diff < 0) return "—";
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
}

export default function AttendanceScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [user, setUser] = useState<any>(null);
    useEffect(() => {
        getCachedSession().then(s => setUser(s?.user));
    }, []);

    // Date
    const [currentDate, setCurrentDate] = useState<Date>(new Date());

    // Status Data
    const [myAttendance, setMyAttendance] = useState<AttendanceRecord | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [locationStage, setLocationStage] = useState<"idle" | "requesting" | "locating" | "denied">("idle");
    const [checkOutSheetVisible, setCheckOutSheetVisible] = useState(false);

    // Register Data
    const [teamRegister, setTeamRegister] = useState<any[]>([]);
    const [showOnlyMe, setShowOnlyMe] = useState(false);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState("");
    const [modalList, setModalList] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Historical Stats Modal
    const [statsModalVisible, setStatsModalVisible] = useState(false);
    const [selectedStatsMember, setSelectedStatsMember] = useState<any>(null);
    const [historicalStats, setHistoricalStats] = useState<{ daysWorked: number, daysLate: number } | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    const openMemberStats = async (memberData: any) => {
        setSelectedStatsMember(memberData);
        setStatsModalVisible(true);
        setHistoricalStats(null);
        setLoadingStats(true);
        try {
            const stats = await getMemberAttendanceStats(activeWorkspace!.id, memberData.id);
            if (stats) {
                setHistoricalStats(stats);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingStats(false);
        }
    };

    const clientDateString = format(currentDate, "yyyy-MM-dd");

    // --- NEW: Workspace Logs (History) ---
    const [workspaceLogs, setWorkspaceLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const loadData = useCallback(async () => {
        if (!activeWorkspace?.id) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            // Fetch everything in parallel for the unified dashboard
            const [myAtt, teamAtt] = await Promise.all([
                getTodayAttendance(activeWorkspace.id, clientDateString),
                getTeamAttendance(activeWorkspace.id, clientDateString)
            ]);

            const sortedTeamAtt = [...teamAtt].sort((a: any, b: any) => {
                const hasA = !!a.attendance?.checkIn;
                const hasB = !!b.attendance?.checkIn;
                if (hasA && !hasB) return -1;
                if (!hasA && hasB) return 1;
                if (hasA && hasB) {
                    return new Date(b.attendance.checkIn).getTime() - new Date(a.attendance.checkIn).getTime();
                }
                const nameA = a.member?.user?.surname || a.member?.user?.name || "";
                const nameB = b.member?.user?.surname || b.member?.user?.name || "";
                return nameA.localeCompare(nameB);
            });

            setMyAttendance(myAtt);
            setTeamRegister(sortedTeamAtt);

            // If admin, fetch history
            const myMember = sortedTeamAtt.find((r: any) => r.member.userId === user?.id);
            const myRole = myMember?.member.role;
            if (myRole === "OWNER" || myRole === "ADMIN") {
                setLoadingLogs(true);
                const logs = await getWorkspaceAttendanceLogs(activeWorkspace.id);
                setWorkspaceLogs(logs);
                setLoadingLogs(false);
            }
        } catch (err) {
            console.error("Failed to load attendance dashboard:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeWorkspace?.id, clientDateString, user?.id]);

    useEffect(() => {
        setLoading(true);
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        haptics.light();
        setRefreshing(true);
        loadData();
    };

    const handleDateChange = (days: number) => {
        setCurrentDate(prev => addDays(prev, days));
    };

    const openMap = (lat: number | null, lng: number | null) => {
        if (!lat || !lng) return;
        const scheme = Platform.select({ ios: "maps:0,0?q=", android: "geo:0,0?q=" });
        const latLng = `${lat},${lng}`;
        const label = "Attendance Location";
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`
        });
        if (url) Linking.openURL(url);
    };

    const isToday = format(new Date(), "yyyy-MM-dd") === clientDateString;

    // --- CHECK IN / OUT ---
    const handleCheckIn = async () => {
        if (actionLoading) return;
        setActionLoading(true);
        setLocationStage("requesting");
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                setLocationStage("denied");
                haptics.error();
                return;
            }
            setLocationStage("locating");
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;

            let addr = "";
            try {
                const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
                if (geo && geo.length > 0) {
                    const p = geo[0];
                    addr = [p.name || p.streetNumber, p.street, p.city || p.subregion, p.region].filter(Boolean).join(", ");
                }
            } catch (e) {
                console.warn("Reverse geocode failed", e);
            }

            const result = await submitCheckIn(
                activeWorkspace!.id,
                lat,
                lng,
                addr,
                clientDateString
            );
            setMyAttendance(result);
            setLocationStage("idle");
            haptics.success();
            Alert.alert("Checked In", `Recorded at ${formatTime(result?.checkIn)}`);
        } catch (e: any) {
            haptics.error();
            Alert.alert("Error", e.message || "Failed to check in");
        } finally {
            setActionLoading(false);
            setLocationStage((s) => (s === "denied" ? s : "idle"));
        }
    };

    const requestCheckOut = () => {
        haptics.warning();
        setCheckOutSheetVisible(true);
    };

    const handleCheckOut = async () => {
        setActionLoading(true);
        setLocationStage("requesting");
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                setLocationStage("denied");
                setCheckOutSheetVisible(false);
                haptics.error();
                return;
            }
            setLocationStage("locating");
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;

            let addr = "";
            try {
                const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
                if (geo && geo.length > 0) {
                    const p = geo[0];
                    addr = [p.name || p.streetNumber, p.street, p.city || p.subregion, p.region].filter(Boolean).join(", ");
                }
            } catch (e) {
                console.warn("Reverse geocode failed", e);
            }

            const result = await submitCheckOut(
                activeWorkspace!.id,
                lat,
                lng,
                addr,
                clientDateString
            );
            setMyAttendance(result);
            setLocationStage("idle");
            setCheckOutSheetVisible(false);
            haptics.success();
            Alert.alert("Checked Out", `Duration: ${calcDuration(result?.checkIn, result?.checkOut)}`);
        } catch (e: any) {
            haptics.error();
            Alert.alert("Error", e.message || "Failed to check out");
        } finally {
            setActionLoading(false);
            setLocationStage((s) => (s === "denied" ? s : "idle"));
        }
    };

    const openLocationSettings = () => {
        if (Platform.OS === "ios") {
            Linking.openURL("app-settings:");
        } else {
            Linking.openSettings();
        }
    };

    const isCheckedIn = !!myAttendance?.checkIn;
    const isCheckedOut = !!myAttendance?.checkOut;

    const statusConfig: Record<AttendanceStatus | "NOT_CHECKED_IN" | "OUT", { label: string; color: string; bg: string; kind: StatusKind }> = {
        PRESENT: { label: "Present", color: "#10b981", bg: "#10b98115", kind: "success" },
        ABSENT: { label: "Absent", color: "#ef4444", bg: "#ef444415", kind: "error" },
        LATE: { label: "Late", color: "#f59e0b", bg: "#f59e0b15", kind: "warning" },
        OUT: { label: "Logged Out", color: "#6b7280", bg: "#6b728015", kind: "neutral" },
        HALF_DAY: { label: "Half Day", color: "#f59e0b", bg: "#f59e0b15", kind: "warning" },
        ON_LEAVE: { label: "On Leave", color: "#3b82f6", bg: "#3b82f615", kind: "info" },
        NOT_CHECKED_IN: { label: "No check-in", color: "#6b7280", bg: "#6b728015", kind: "neutral" },
    };

    const renderMyStatus = () => {
        const status = myAttendance?.status ?? null;
        let statusInfo = status ? statusConfig[status as AttendanceStatus] : null;

        // Apply OUT override rule
        if (myAttendance?.checkOut) {
            const outTime = new Date(myAttendance.checkOut);
            const istOut = new Date(outTime.getTime() + (5.5 * 60 * 60 * 1000));
            if (istOut.getUTCHours() >= 19) {
                statusInfo = statusConfig["OUT"];
            }
        }

        return (
            <View style={styles.tabContent}>
                {/* Status Card */}
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <BlurView intensity={isDark ? 30 : 50} tint={isDark ? "dark" : "light"} style={styles.glassCardInner}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconWrap, { backgroundColor: isCheckedIn && !isCheckedOut ? "#10b98118" : "#3b82f618" }]}>
                                <Ionicons
                                    name={isCheckedIn && !isCheckedOut ? "timer" : "time-outline"}
                                    size={22}
                                    color={isCheckedIn && !isCheckedOut ? "#10b981" : "#3b82f6"}
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: SPACING.md }}>
                                <Text style={[styles.cardTitle, { color: colors.text }]}>Daily Check-In</Text>
                                {statusInfo ? (
                                    <StatusChip label={statusInfo.label} kind={statusInfo.kind} style={{ marginTop: 6 }} />
                                ) : (
                                    <Text style={[styles.notChecked, { color: colors.textDim }]}>Waiting for check-in</Text>
                                )}
                            </View>
                        </View>

                        {/* Time Row */}
                        <View style={[styles.timeRow, { borderTopColor: colors.border + "40" }]}>
                            <View style={styles.timeBlock}>
                                <Text style={[styles.timeLabel, { color: colors.textDim }]}>CHECK IN</Text>
                                <Text style={[styles.timeValue, { color: colors.text }]}>{formatTime(myAttendance?.checkIn ?? null)}</Text>
                            </View>
                            <View style={[styles.timeDivider, { backgroundColor: colors.border + "40" }]} />
                            <View style={styles.timeBlock}>
                                <Text style={[styles.timeLabel, { color: colors.textDim }]}>CHECK OUT</Text>
                                <Text style={[styles.timeValue, { color: colors.text }]}>{formatTime(myAttendance?.checkOut ?? null)}</Text>
                            </View>
                            <View style={[styles.timeDivider, { backgroundColor: colors.border + "40" }]} />
                            <View style={styles.timeBlock}>
                                <Text style={[styles.timeLabel, { color: colors.textDim }]}>DURATION</Text>
                                <Text style={[styles.timeValue, { color: colors.text }]}>
                                    {calcDuration(myAttendance?.checkIn ?? null, myAttendance?.checkOut ?? null)}
                                </Text>
                            </View>
                        </View>
                    </BlurView>
                </View>

                {/* Location Info */}
                {(myAttendance?.checkInLatitude || myAttendance?.checkInAddress) && (
                    <View style={[styles.locationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons name="location" size={16} color={colors.primary} />
                        <Text style={[styles.locationText, { color: colors.textDim }]}>
                            {myAttendance.checkInAddress || `Check-in: ${myAttendance.checkInLatitude?.toFixed(4)}, ${myAttendance.checkInLongitude?.toFixed(4)}`}
                        </Text>
                    </View>
                )}

                {myAttendance?.checkOutAddress && (
                    <View style={[styles.locationCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 8 }]}>
                        <Ionicons name="location" size={16} color="#ef4444" />
                        <Text style={[styles.locationText, { color: colors.textDim }]}>
                            Check-out: {myAttendance.checkOutAddress}
                        </Text>
                    </View>
                )}

                {/* Location acquisition progress */}
                {actionLoading && (locationStage === "requesting" || locationStage === "locating") && (
                    <View style={[styles.tipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.tipText, { color: colors.textDim }]}>
                            {locationStage === "requesting" ? "Requesting location permission…" : "Getting your current location…"}
                        </Text>
                    </View>
                )}

                {/* Location permission denied explanation */}
                {locationStage === "denied" && (
                    <View style={[styles.tipCard, { backgroundColor: "#ef444412", borderColor: "#ef444440" }]}>
                        <Ionicons name="location-outline" size={18} color="#ef4444" />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.tipText, { color: colors.text, fontFamily: FONTS.bold }]}>
                                Location access is off
                            </Text>
                            <Text style={[styles.tipText, { color: colors.textDim, marginTop: 2 }]}>
                                Trava needs your location to record attendance. Enable location access for this app in your device settings, then try again.
                            </Text>
                            <PressableScale
                                onPress={openLocationSettings}
                                accessibilityLabel="Open device settings to enable location access"
                                haptic="light"
                                style={styles.enableLocationBtn}
                            >
                                <Text style={{ color: "#ef4444", fontFamily: FONTS.bold, fontSize: 12 }}>Open Settings</Text>
                            </PressableScale>
                        </View>
                    </View>
                )}

                {/* Action Button - Only show if current date is TODAY */}
                {isToday ? (
                    <View style={styles.actionContainer}>
                        {(!isCheckedIn || isCheckedOut) && (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.primary }, actionLoading && { opacity: 0.6 }]}
                                onPress={handleCheckIn}
                                disabled={actionLoading}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel="Check in now"
                                accessibilityState={{ disabled: actionLoading, busy: actionLoading }}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="log-in-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.actionBtnText}>Check In Now</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}

                        {isCheckedIn && !isCheckedOut && (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: "#ef4444" }, actionLoading && { opacity: 0.6 }]}
                                onPress={requestCheckOut}
                                disabled={actionLoading}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel="Check out"
                                accessibilityState={{ disabled: actionLoading, busy: actionLoading }}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="log-out-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.actionBtnText}>Check Out</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={[styles.tipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons name="calendar-outline" size={18} color={colors.textDim} />
                        <Text style={[styles.tipText, { color: colors.textDim }]}>
                            You are viewing a past date. Check-in actions are disabled.
                        </Text>
                    </View>
                )}

                {/* Info Tip for Today */}
                {isToday && (
                    <View style={[styles.tipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons name="information-circle-outline" size={18} color={colors.textDim} />
                        <Text style={[styles.tipText, { color: colors.textDim }]}>
                            {isCheckedOut
                                ? "Your attendance has been recorded for today."
                                : isCheckedIn
                                    ? "Remember to check out when you're done for the day."
                                    : "Location access is required to record your attendance."}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    const renderTeamRegister = () => {
        if (loading) {
            return (
                <View style={[styles.center, { marginTop: 40 }]}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            );
        }

        if (teamRegister.length === 0) {
            return (
                <View style={styles.empty}>
                    <Ionicons name="people-outline" size={48} color={colors.textDim} />
                    <Text style={[styles.emptyLabel, { color: colors.textDim }]}>No members found.</Text>
                </View>
            );
        }

        const myRole = teamRegister.find((r: any) => r.member.userId === user?.id)?.member.role;
        const isAdmin = myRole === "OWNER" || myRole === "ADMIN";

        const lateMembers = teamRegister.filter((r: any) => {
            if (!r.attendance?.checkIn) return false;
            const inTime = new Date(r.attendance.checkIn);
            const istIn = new Date(inTime.getTime() + (5.5 * 60 * 60 * 1000));
            const hours = istIn.getUTCHours();
            const minutes = istIn.getUTCMinutes();
            return (hours > 9) || (hours === 9 && minutes > 40);
        });

        const missingMembers = teamRegister.filter((r: any) => !r.attendance?.checkIn);

        const stats = [
            { label: "Total", value: teamRegister.length, color: colors.primary, bg: colors.primary + "15", list: teamRegister.map((r: any) => r.member.user) },
            { label: "In", value: teamRegister.filter((r: any) => !!r.attendance?.checkIn).length, color: "#10b981", bg: "#10b98115", list: teamRegister.filter((r: any) => !!r.attendance?.checkIn).map((r: any) => r.member.user) },
            { label: "Late", value: lateMembers.length, color: "#f97316", bg: "#f9731615", list: lateMembers.map((r: any) => r.member.user) },
            { label: "Missing", value: missingMembers.length, color: "#ef4444", bg: "#ef444415", list: missingMembers.map((r: any) => r.member.user) },
        ];

        return (
            <View style={styles.tabContent}>
                {isAdmin && (
                    <View style={styles.statRow}>
                        {stats.map((s: any, i: number) => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                onPress={() => {
                                    setModalTitle(s.label);
                                    setModalList(s.list);
                                    setModalVisible(true);
                                }}
                            >
                                <View style={[styles.statBadge, { backgroundColor: s.bg }]}>
                                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                                </View>
                                <Text style={[styles.statLabel, { color: colors.textDim }]}>{s.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {(() => {
                    const visibleMembers = showOnlyMe 
                        ? teamRegister.filter((row: any) => row.member.userId === user?.id)
                        : teamRegister;

                    if (visibleMembers.length === 0) {
                        return (
                            <View style={[styles.empty, { marginTop: 24, paddingVertical: 32 }]}>
                                <Ionicons name="people-outline" size={36} color={colors.textDim} />
                                <Text style={[styles.emptyLabel, { color: colors.textDim, marginTop: 8 }]}>No members found.</Text>
                            </View>
                        );
                    }

                    return visibleMembers.map((row, index) => {
                        const memberName = row.member.user.surname || row.member.user.name || "Unknown User";
                        const att = row.attendance;

                        let actualStatus = (att ? att.status : "NOT_CHECKED_IN") as AttendanceStatus | "NOT_CHECKED_IN";
                        if (att?.checkIn) {
                            const inTime = new Date(att.checkIn);
                            const istIn = new Date(inTime.getTime() + (5.5 * 60 * 60 * 1000));
                            const hours = istIn.getUTCHours();
                            const minutes = istIn.getUTCMinutes();
                            if ((hours > 9) || (hours === 9 && minutes > 40)) {
                                actualStatus = "LATE";
                            }
                        }
                        if (att?.checkOut) {
                            const outTime = new Date(att.checkOut);
                            const istOut = new Date(outTime.getTime() + (5.5 * 60 * 60 * 1000));
                            if (istOut.getUTCHours() >= 19) {
                                actualStatus = "OUT";
                            }
                        }

                        let sInfo = statusConfig[actualStatus];

                        return (
                            <TouchableOpacity
                                key={row.member.id}
                                style={[styles.registerItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                                onPress={() => openMemberStats(row.member)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.registerMain}>
                                    {row.member.user.image ? (
                                        <Image source={{ uri: row.member.user.image }} style={styles.avatar} />
                                    ) : (
                                        <View style={[styles.avatarFallback, { backgroundColor: colors.border }]}>
                                            <Text style={{ color: colors.textDim, fontFamily: FONTS.semibold }}>{memberName.charAt(0)}</Text>
                                        </View>
                                    )}

                                    <View style={styles.registerDetails}>
                                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <View style={{ flex: 1, marginRight: 8 }}>
                                                <Text style={[styles.registerName, { color: colors.text }]} numberOfLines={1}>{memberName}</Text>
                                                <Text style={[styles.registerEmail, { color: colors.textDim }]} numberOfLines={1}>{row.member.user.email}</Text>
                                            </View>
                                            <StatusChip label={sInfo.label} kind={sInfo.kind} size="sm" />
                                        </View>

                                        <View style={styles.registerTimes}>
                                            <View style={styles.registerTimeRow}>
                                                <Ionicons name="arrow-down-circle-outline" size={14} color="#10b981" />
                                                <Text style={[styles.registerTimeText, { color: colors.text }]}>{formatTime(att?.checkIn)}</Text>
                                            </View>
                                            <View style={styles.registerTimeRow}>
                                                <Ionicons name="arrow-up-circle-outline" size={14} color="#ef4444" />
                                                <Text style={[styles.registerTimeText, { color: colors.text }]}>{formatTime(att?.checkOut)}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.registerMapRow}>
                                            <TouchableOpacity
                                                style={[styles.mapBtn, { opacity: att?.checkInLatitude ? 1 : 0.3 }]}
                                                onPress={() => openMap(att?.checkInLatitude, att?.checkInLongitude)}
                                                disabled={!att?.checkInLatitude}
                                            >
                                                <Ionicons name="location-outline" size={14} color="#10b981" />
                                                <Text style={[styles.mapBtnText, { color: "#10b981" }]}>In Map</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.mapBtn, { opacity: att?.checkOutLatitude ? 1 : 0.3 }]}
                                                onPress={() => openMap(att?.checkOutLatitude, att?.checkOutLongitude)}
                                                disabled={!att?.checkOutLatitude}
                                            >
                                                <Ionicons name="location-outline" size={14} color="#ef4444" />
                                                <Text style={[styles.mapBtnText, { color: "#ef4444" }]}>Out Map</Text>
                                            </TouchableOpacity>

                                            <View style={{ flex: 1 }} />

                                            <View style={styles.registerTimeRow}>
                                                <Ionicons name="time-outline" size={14} color={colors.textDim} />
                                                <Text style={[styles.registerTimeText, { color: colors.textDim }]}>{calcDuration(att?.checkIn, att?.checkOut)}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    });
                })()}
            </View>
        );
    };
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                {/* Header Section */}
                <View style={[styles.headerContainer, { paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                    {/* Row 1: Back + Title and Leaves Button */}
                    <View style={styles.headerTopRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
                            {navigation.canGoBack() && (
                                <TouchableOpacity
                                    onPress={() => navigation.goBack()}
                                    style={{ marginRight: 12, paddingVertical: 4, paddingRight: 4 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Go back"
                                >
                                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                                </TouchableOpacity>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.heading, { color: colors.text }]} numberOfLines={1}>Attendance</Text>
                                <Text style={[styles.subheading, { color: colors.textMuted }]} numberOfLines={1}>
                                    {format(currentDate, "EEEE, dd-MM-yyyy")}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.leaveBtn, { borderColor: colors.border }]}
                            onPress={() => (navigation as any).navigate("Leave")}
                        >
                            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                            <Text style={[styles.leaveBtnText, { color: colors.primary }]}>Leaves</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Row 2: Date Navigator */}
                    <View style={styles.headerBottomRow}>
                        <TouchableOpacity
                            onPress={() => handleDateChange(-1)}
                            style={[styles.dateNavBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            accessibilityRole="button"
                            accessibilityLabel="Previous day"
                        >
                            <Ionicons name="chevron-back" size={20} color={colors.text} />
                        </TouchableOpacity>

                        <View style={[styles.dateBadge, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, marginHorizontal: SPACING.sm }]}>
                            <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                            <Text style={[styles.dateText, { color: colors.text, fontFamily: FONTS.bold }]}>
                                {format(currentDate, "EEEE, dd MMM yyyy")}
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => handleDateChange(1)}
                            style={[styles.dateNavBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                            disabled={isToday}
                            accessibilityRole="button"
                            accessibilityLabel="Next day"
                            accessibilityState={{ disabled: isToday }}
                        >
                            <Ionicons name="chevron-forward" size={20} color={isToday ? colors.border : colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scroll, { paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                >
                    {/* 1. My Status (Action Center) */}
                    {renderMyStatus()}

                    {/* 2. Team Register (Today) - Only for Admins/Managers */}
                    <View style={[styles.sectionHeader, { marginTop: SPACING.md }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Team (Today)</Text>
                            <View style={styles.badgeCount}>
                                <Text style={styles.badgeCountText}>{teamRegister.length}</Text>
                            </View>
                        </View>

                        <TouchableOpacity 
                            onPress={() => {
                                haptics.light();
                                setShowOnlyMe(prev => !prev);
                            }}
                            style={[
                                { 
                                    paddingHorizontal: 12, 
                                    paddingVertical: 5, 
                                    borderRadius: 12, 
                                    borderWidth: 1, 
                                    flexDirection: "row", 
                                    alignItems: "center" 
                                }, 
                                showOnlyMe 
                                    ? { backgroundColor: colors.primary, borderColor: colors.primary } 
                                    : { backgroundColor: "transparent", borderColor: colors.border }
                            ]}
                        >
                            <Ionicons 
                                name={showOnlyMe ? "person" : "person-outline"} 
                                size={12} 
                                color={showOnlyMe ? "#fff" : colors.textDim} 
                                style={{ marginRight: 4 }} 
                            />
                            <Text 
                                style={{ 
                                    fontSize: 12, 
                                    fontFamily: FONTS.semibold, 
                                    color: showOnlyMe ? "#fff" : colors.textDim 
                                }}
                            >
                                Me
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {renderTeamRegister()}

                    {/* 3. Workspace Logs (History) - Only for Admins/Managers */}
                    {(workspaceLogs.length > 0 || loadingLogs) && (
                        <>
                            <View style={[styles.sectionHeader, { marginTop: SPACING.xl }]}>
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Workspace Logs</Text>
                                <View style={[styles.badgeCount, { backgroundColor: colors.primary + "20" }]}>
                                    <Text style={[styles.badgeCountText, { color: colors.primary }]}>History</Text>
                                </View>
                            </View>

                            {loadingLogs ? (
                                <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                            ) : (
                                <View style={styles.logsList}>
                                    {workspaceLogs.map((log: any) => {
                                        const u = log.workspaceMember?.user;
                                        const name = u?.surname || u?.name || "User";
                                        const sInfo = statusConfig[log.status as AttendanceStatus] || statusConfig.PRESENT;

                                        return (
                                            <View key={log.id} style={[styles.logRow, { borderBottomColor: colors.border + "40" }]}>
                                                <View style={styles.logMain}>
                                                    <Image source={{ uri: u?.image || undefined }} style={styles.logAvatar} />
                                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                                        <View style={styles.logTopRow}>
                                                            <Text style={[styles.logName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                                                            <Text style={[styles.logDate, { color: colors.textDim }]}>{format(new Date(log.date), "dd MMM")}</Text>
                                                        </View>
                                                        <View style={styles.logMetaRow}>
                                                            <View style={styles.logTimeCol}>
                                                                <View style={styles.logTimeRow}>
                                                                    <Ionicons name="enter-outline" size={10} color="#10b981" />
                                                                    <Text style={[styles.logTimeText, { color: colors.text }]}>{formatTime(log.checkIn)}</Text>
                                                                </View>
                                                                <View style={styles.logTimeRow}>
                                                                    <Ionicons name="exit-outline" size={10} color="#ef4444" />
                                                                    <Text style={[styles.logTimeText, { color: colors.text }]}>{formatTime(log.checkOut)}</Text>
                                                                </View>
                                                            </View>

                                                            {log.checkInLatitude && (
                                                                <TouchableOpacity onPress={() => openMap(log.checkInLatitude, log.checkInLongitude)} style={styles.logLocBtn}>
                                                                    <Ionicons name="location" size={12} color={colors.primary} />
                                                                    <Text style={[styles.logLocText, { color: colors.primary }]}>Map</Text>
                                                                </TouchableOpacity>
                                                            )}

                                                            <StatusChip label={sInfo.label} kind={sInfo.kind} size="sm" />
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </>
                    )}

                    <View style={{ height: 20 }} />
                </ScrollView>

                {/* Member Modal */}
                <Modal
                    visible={modalVisible}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setModalVisible(false)}
                >
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setModalVisible(false)}
                    >
                        <Pressable style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 20 }]}>
                            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>{modalTitle}</Text>
                                <TouchableOpacity
                                    onPress={() => setModalVisible(false)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Close"
                                    hitSlop={8}
                                >
                                    <Ionicons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                                {modalList.length === 0 ? (
                                    <Text style={[styles.emptyModalText, { color: colors.textDim }]}>No members found.</Text>
                                ) : (
                                    modalList.map((u, i) => (
                                        <View key={u.id + i} style={[styles.modalItem, { borderBottomColor: colors.border }]}>
                                            {u.image ? (
                                                <Image source={{ uri: u.image }} style={styles.modalAvatar} />
                                            ) : (
                                                <View style={[styles.modalAvatarFallback, { backgroundColor: colors.border }]}>
                                                    <Text style={{ color: colors.textDim, fontFamily: FONTS.semibold }}>{(u.surname?.[0] || u.name.charAt(0)).toUpperCase()}</Text>
                                                </View>
                                            )}
                                            <View>
                                                <Text style={[styles.modalName, { color: colors.text }]}>{u.surname || u.name}</Text>
                                                <Text style={[styles.modalEmail, { color: colors.textDim }]}>{u.email}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* Historical Stats Modal */}
                <Modal
                    visible={statsModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setStatsModalVisible(false)}
                >
                    <Pressable style={styles.modalOverlay} onPress={() => setStatsModalVisible(false)}>
                        <Pressable style={[styles.statsModalCard, { backgroundColor: colors.surface }]}>
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={() => setStatsModalVisible(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                                hitSlop={8}
                            >
                                <Ionicons name="close" size={24} color={colors.textDim} />
                            </TouchableOpacity>

                            {selectedStatsMember && (
                                <View style={styles.statsModalHeader}>
                                    {selectedStatsMember.user.image ? (
                                        <Image source={{ uri: selectedStatsMember.user.image }} style={styles.statsModalAvatar} />
                                    ) : (
                                        <View style={[styles.statsModalAvatarFallback, { backgroundColor: colors.border }]}>
                                            <Text style={{ color: colors.textDim, fontFamily: FONTS.semibold, fontSize: 24 }}>
                                                {(selectedStatsMember.user.surname?.[0] || selectedStatsMember.user.name.charAt(0)).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={[styles.statsModalName, { color: colors.text }]}>
                                        {selectedStatsMember.user.surname || selectedStatsMember.user.name}
                                    </Text>
                                    <Text style={[styles.statsModalEmail, { color: colors.textDim }]}>
                                        {selectedStatsMember.user.email}
                                    </Text>

                                    {loadingStats ? (
                                        <View style={{ paddingVertical: 40 }}>
                                            <ActivityIndicator size="large" color={colors.primary} />
                                        </View>
                                    ) : historicalStats ? (
                                        <View style={styles.statsRow}>
                                            <View style={[styles.bigStatCard, { backgroundColor: "#10b98115", borderColor: "#10b98130" }]}>
                                                <Text style={[styles.bigStatValue, { color: "#10b981" }]}>{historicalStats.daysWorked}</Text>
                                                <Text style={[styles.bigStatLabel, { color: "#059669" }]}>DAYS WORKED</Text>
                                            </View>
                                            <View style={[styles.bigStatCard, { backgroundColor: "#f9731615", borderColor: "#f9731630" }]}>
                                                <Text style={[styles.bigStatValue, { color: "#f97316" }]}>{historicalStats.daysLate}</Text>
                                                <Text style={[styles.bigStatLabel, { color: "#ea580c" }]}>DAYS LATE</Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <Text style={[styles.emptyModalText, { color: colors.textDim }]}>Could not load statistics.</Text>
                                    )}
                                </View>
                            )}
                        </Pressable>
                    </Pressable>
                </Modal>

                <ConfirmationSheet
                    visible={checkOutSheetVisible}
                    title="Check out for the day?"
                    description="This will end your shift for today. You can't check in again until tomorrow."
                    tone="warning"
                    confirmLabel="Check Out"
                    cancelLabel="Cancel"
                    loading={actionLoading}
                    onConfirm={handleCheckOut}
                    onClose={() => setCheckOutSheetVisible(false)}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    headerContainer: { paddingVertical: SPACING.md, gap: SPACING.sm },
    headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACING.xs },
    heading: { fontSize: 24, fontFamily: FONTS.bold },
    subheading: { fontSize: 13, marginTop: 2 },
    leaveBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
    leaveBtnText: { fontSize: 13, fontFamily: FONTS.bold },

    dateNav: { flexDirection: "row", alignItems: "center", gap: 4 },
    dateNavBtn: { width: 40, height: 40, borderRadius: BORDER_RADIUS.md, borderWidth: 1, justifyContent: "center", alignItems: "center" },
    dateBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 40, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    dateText: { fontSize: 13, fontFamily: FONTS.semibold },

    segmentContainer: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
    segmentTrack: { flexDirection: "row", padding: 4, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    segmentBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: BORDER_RADIUS.sm - 2 },
    segmentText: { fontSize: 13, fontFamily: FONTS.semibold },

    scroll: { paddingHorizontal: SPACING.lg },
    tabContent: { paddingTop: SPACING.sm },

    // Status UI
    card: { borderRadius: BORDER_RADIUS.xl, borderWidth: 1, marginBottom: SPACING.md, overflow: "hidden" },
    glassCardInner: { padding: 0 },
    cardHeader: { flexDirection: "row", alignItems: "center", padding: SPACING.md, paddingBottom: SPACING.sm },
    iconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    cardTitle: { fontSize: 17, fontFamily: FONTS.bold },
    statusPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    statusText: { fontSize: 11, fontFamily: FONTS.extrabold, textTransform: "uppercase", letterSpacing: 0.5 },
    notChecked: { fontSize: 13, marginTop: 3 },

    timeRow: { flexDirection: "row", borderTopWidth: 1, paddingVertical: SPACING.md },
    timeBlock: { flex: 1, alignItems: "center" },
    timeDivider: { width: 1, height: "100%" },
    timeLabel: { fontSize: 9, fontFamily: FONTS.bold, letterSpacing: 0.5, marginBottom: 6 },
    timeValue: { fontSize: 16, fontFamily: FONTS.bold },

    locationCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
    locationText: { fontSize: 12, flex: 1 },

    actionContainer: { marginBottom: SPACING.md },
    actionBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", height: 52, borderRadius: BORDER_RADIUS.lg },
    actionBtnText: { color: "#fff", fontSize: 17, fontFamily: FONTS.bold },

    tipCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
    tipText: { fontSize: 12, lineHeight: 18, flex: 1 },
    enableLocationBtn: { marginTop: 10, alignSelf: "flex-start", minHeight: TOUCH_TARGET.min, justifyContent: "center", paddingVertical: 4 },

    // Register UI
    empty: { marginTop: 60, alignItems: "center" },
    emptyLabel: { marginTop: 10, fontSize: 14, fontFamily: FONTS.medium },

    registerItem: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.sm },
    registerMain: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    avatarFallback: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
    registerDetails: { flex: 1 },
    registerName: { fontSize: 15, fontFamily: FONTS.semibold, flex: 1, marginRight: 8 },
    miniStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    miniStatusText: { fontSize: 9, fontFamily: FONTS.extrabold, textTransform: "uppercase" },

    registerTimes: { flexDirection: "row", gap: 12, marginTop: 8 },
    registerTimeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    registerTimeText: { fontSize: 12, fontFamily: FONTS.semibold },

    registerEmail: { fontSize: 11, marginTop: 2 },
    registerMapRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
    mapBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
    mapBtnText: { fontSize: 11, fontFamily: FONTS.bold },

    statRow: { flexDirection: "row", gap: 8, marginBottom: SPACING.lg },
    statBox: { flex: 1, padding: 10, borderRadius: BORDER_RADIUS.md, borderWidth: 1, alignItems: "center", gap: 4 },
    statBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    statValue: { fontSize: 15, fontFamily: FONTS.extrabold },
    statLabel: { fontSize: 10, fontFamily: FONTS.semibold, textTransform: "uppercase" },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 15, borderBottomWidth: 1, marginBottom: 10 },
    modalTitle: { fontSize: 18, fontFamily: FONTS.bold },
    modalList: { marginTop: 5 },
    modalItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
    modalAvatar: { width: 40, height: 40, borderRadius: 20 },
    modalAvatarFallback: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
    modalName: { fontSize: 15, fontFamily: FONTS.semibold },
    modalEmail: { fontSize: 12, marginTop: 1 },
    emptyModalText: { textAlign: "center", marginTop: 40, fontSize: 14 },

    statsModalCard: { width: "85%", alignSelf: "center", marginBottom: "auto", marginTop: "auto", borderRadius: 24, padding: 24, position: "relative" },
    closeBtn: { position: "absolute", top: 16, right: 16, zIndex: 10, padding: 6 },
    statsModalHeader: { alignItems: "center", width: "100%" },
    statsModalAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
    statsModalAvatarFallback: { width: 80, height: 80, borderRadius: 40, marginBottom: 12, justifyContent: "center", alignItems: "center" },
    statsModalName: { fontSize: 20, fontFamily: FONTS.bold, textAlign: "center" },
    statsModalEmail: { fontSize: 13, marginTop: 4, textAlign: "center" },
    statsRow: { flexDirection: "row", gap: 12, marginTop: 24, width: "100%" },
    bigStatCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    bigStatValue: { fontSize: 32, fontFamily: FONTS.extrabold },
    bigStatLabel: { fontSize: 10, fontFamily: FONTS.bold, marginTop: 4, letterSpacing: 0.5 },

    // Unified Dashboard Header Styles
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md },
    sectionTitle: { fontSize: 18, fontFamily: FONTS.bold },
    badgeCount: { backgroundColor: "#6b728020", paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12 },
    badgeCountText: { fontSize: 12, fontFamily: FONTS.bold, color: "#6b7280" },

    // Logs List Styles
    logsList: { gap: 0 },
    logRow: { paddingVertical: 14, borderBottomWidth: 1 },
    logMain: { flexDirection: "row", alignItems: "center" },
    logAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#ccc" },
    logTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    logName: { fontSize: 15, fontFamily: FONTS.semibold, flex: 1 },
    logDate: { fontSize: 12, fontFamily: FONTS.medium },
    logMetaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    logTimeCol: { flex: 1, gap: 2 },
    logTimeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    logTimeText: { fontSize: 11, fontFamily: FONTS.bold },
    logLocBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#3b82f615", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    logLocText: { fontSize: 10, fontFamily: FONTS.bold },
    logStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    logStatusText: { fontSize: 9, fontFamily: FONTS.extrabold, textTransform: "uppercase" },
});
