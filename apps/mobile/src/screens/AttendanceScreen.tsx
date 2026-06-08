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
import { BlurView } from "expo-blur";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { format, addDays } from "date-fns";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
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

    // Register Data
    const [teamRegister, setTeamRegister] = useState<any[]>([]);

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
        setActionLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Permission Denied", "Location permission is required to check in.");
                return;
            }
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
            Alert.alert("Checked In! 🎉", `Recorded at ${formatTime(result?.checkIn)}`);
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to check in");
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckOut = async () => {
        Alert.alert("Check Out", "Are you sure you want to check out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Check Out",
                style: "destructive",
                onPress: async () => {
                    setActionLoading(true);
                    try {
                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status !== "granted") {
                            Alert.alert("Permission Denied", "Location permission is required.");
                            return;
                        }
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
                        Alert.alert("Checked Out!", `Duration: ${calcDuration(result?.checkIn, result?.checkOut)}`);
                    } catch (e: any) {
                        Alert.alert("Error", e.message || "Failed to check out");
                    } finally {
                        setActionLoading(false);
                    }
                },
            },
        ]);
    };

    const isCheckedIn = !!myAttendance?.checkIn;
    const isCheckedOut = !!myAttendance?.checkOut;

    const statusConfig: Record<AttendanceStatus | "NOT_CHECKED_IN" | "OUT", { label: string; color: string; bg: string }> = {
        PRESENT: { label: "Present", color: "#10b981", bg: "#10b98115" },
        ABSENT: { label: "Absent", color: "#ef4444", bg: "#ef444415" },
        LATE: { label: "Late", color: "#f59e0b", bg: "#f59e0b15" },
        OUT: { label: "Logged Out", color: "#6b7280", bg: "#6b728015" },
        HALF_DAY: { label: "Half Day", color: "#f59e0b", bg: "#f59e0b15" },
        ON_LEAVE: { label: "On Leave", color: "#3b82f6", bg: "#3b82f615" },
        NOT_CHECKED_IN: { label: "No check-in", color: "#6b7280", bg: "#6b728015" },
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
                                    <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
                                        <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                                        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                                    </View>
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

                {/* Action Button - Only show if current date is TODAY */}
                {isToday ? (
                    <View style={styles.actionContainer}>
                        {(!isCheckedIn || isCheckedOut) && (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                                onPress={handleCheckIn}
                                disabled={actionLoading}
                                activeOpacity={0.85}
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
                                style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
                                onPress={handleCheckOut}
                                disabled={actionLoading}
                                activeOpacity={0.85}
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

                {teamRegister.map((row, index) => {
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
                                        <Text style={{ color: colors.textDim, fontWeight: "600" }}>{memberName.charAt(0)}</Text>
                                    </View>
                                )}

                                <View style={styles.registerDetails}>
                                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text style={[styles.registerName, { color: colors.text }]} numberOfLines={1}>{memberName}</Text>
                                            <Text style={[styles.registerEmail, { color: colors.textDim }]} numberOfLines={1}>{row.member.user.email}</Text>
                                        </View>
                                        <View style={[styles.miniStatus, { backgroundColor: sInfo.bg }]}>
                                            <Text style={[styles.miniStatusText, { color: sInfo.color }]}>{sInfo.label}</Text>
                                        </View>
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
                })}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
            {/* Header with Date Navigator */}
            <View style={[styles.header, { paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                <View>
                    <Text style={[styles.heading, { color: colors.text }]}>Attendance</Text>
                    <Text style={[styles.subheading, { color: colors.textMuted }]}>
                        {format(currentDate, "EEEE, dd-MM-yyyy")}
                    </Text>
                </View>

                <TouchableOpacity 
                    style={[styles.leaveBtn, { borderColor: colors.border }]}
                    onPress={() => (navigation as any).navigate("Leave")}
                >
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                    <Text style={[styles.leaveBtnText, { color: colors.primary }]}>Leaves</Text>
                </TouchableOpacity>

                {/* Date Navigator */}
                <View style={styles.dateNav}>
                    <TouchableOpacity onPress={() => handleDateChange(-1)} style={styles.dateNavBtn}>
                        <Ionicons name="chevron-back" size={20} color={colors.text} />
                    </TouchableOpacity>

                    <View style={[styles.dateBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                        <Text style={[styles.dateText, { color: colors.text }]}>
                            {format(currentDate, "dd-MM-yyyy")}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={() => handleDateChange(1)} style={styles.dateNavBtn} disabled={isToday}>
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
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Team (Today)</Text>
                    <View style={styles.badgeCount}>
                        <Text style={styles.badgeCountText}>{teamRegister.length}</Text>
                    </View>
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

                                                        <View style={[styles.logStatus, { backgroundColor: sInfo.bg }]}>
                                                            <Text style={[styles.logStatusText, { color: sInfo.color }]}>{sInfo.label}</Text>
                                                        </View>
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
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
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
                                                <Text style={{ color: colors.textDim, fontWeight: "600" }}>{(u.surname?.[0] || u.name.charAt(0)).toUpperCase()}</Text>
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
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setStatsModalVisible(false)}>
                            <Ionicons name="close" size={24} color={colors.textDim} />
                        </TouchableOpacity>

                        {selectedStatsMember && (
                            <View style={styles.statsModalHeader}>
                                {selectedStatsMember.user.image ? (
                                    <Image source={{ uri: selectedStatsMember.user.image }} style={styles.statsModalAvatar} />
                                ) : (
                                    <View style={[styles.statsModalAvatarFallback, { backgroundColor: colors.border }]}>
                                        <Text style={{ color: colors.textDim, fontWeight: "600", fontSize: 24 }}>
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
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    heading: { fontSize: 24, fontWeight: "700" },
    subheading: { fontSize: 13, marginTop: 2 },
    leaveBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
    leaveBtnText: { fontSize: 13, fontWeight: "700" },

    dateNav: { flexDirection: "row", alignItems: "center", gap: 4 },
    dateNavBtn: { padding: 4 },
    dateBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    dateText: { fontSize: 12, fontWeight: "600" },

    segmentContainer: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
    segmentTrack: { flexDirection: "row", padding: 4, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
    segmentBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: BORDER_RADIUS.sm - 2 },
    segmentText: { fontSize: 13, fontWeight: "600" },

    scroll: { paddingHorizontal: SPACING.lg },
    tabContent: { paddingTop: SPACING.sm },

    // Status UI
    card: { borderRadius: BORDER_RADIUS.xl, borderWidth: 1, marginBottom: SPACING.md, overflow: "hidden" },
    glassCardInner: { padding: 0 },
    cardHeader: { flexDirection: "row", alignItems: "center", padding: SPACING.md, paddingBottom: SPACING.sm },
    iconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    cardTitle: { fontSize: 17, fontWeight: "700" },
    statusPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    statusText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
    notChecked: { fontSize: 13, marginTop: 3 },

    timeRow: { flexDirection: "row", borderTopWidth: 1, paddingVertical: SPACING.md },
    timeBlock: { flex: 1, alignItems: "center" },
    timeDivider: { width: 1, height: "100%" },
    timeLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 },
    timeValue: { fontSize: 16, fontWeight: "700" },

    locationCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
    locationText: { fontSize: 12, flex: 1 },

    actionContainer: { marginBottom: SPACING.md },
    actionBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", height: 52, borderRadius: BORDER_RADIUS.lg },
    actionBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

    tipCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
    tipText: { fontSize: 12, lineHeight: 18, flex: 1 },

    // Register UI
    empty: { marginTop: 60, alignItems: "center" },
    emptyLabel: { marginTop: 10, fontSize: 14, fontWeight: "500" },

    registerItem: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.sm },
    registerMain: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    avatarFallback: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
    registerDetails: { flex: 1 },
    registerName: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
    miniStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    miniStatusText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },

    registerTimes: { flexDirection: "row", gap: 12, marginTop: 8 },
    registerTimeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    registerTimeText: { fontSize: 12, fontWeight: "600" },

    registerEmail: { fontSize: 11, marginTop: 2 },
    registerMapRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
    mapBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
    mapBtnText: { fontSize: 11, fontWeight: "700" },

    statRow: { flexDirection: "row", gap: 8, marginBottom: SPACING.lg },
    statBox: { flex: 1, padding: 10, borderRadius: BORDER_RADIUS.md, borderWidth: 1, alignItems: "center", gap: 4 },
    statBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    statValue: { fontSize: 15, fontWeight: "800" },
    statLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase" },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 15, borderBottomWidth: 1, marginBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: "700" },
    modalList: { marginTop: 5 },
    modalItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
    modalAvatar: { width: 40, height: 40, borderRadius: 20 },
    modalAvatarFallback: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
    modalName: { fontSize: 15, fontWeight: "600" },
    modalEmail: { fontSize: 12, marginTop: 1 },
    emptyModalText: { textAlign: "center", marginTop: 40, fontSize: 14 },

    statsModalCard: { width: "85%", alignSelf: "center", marginBottom: "auto", marginTop: "auto", borderRadius: 24, padding: 24, position: "relative" },
    closeBtn: { position: "absolute", top: 16, right: 16, zIndex: 10, padding: 6 },
    statsModalHeader: { alignItems: "center", width: "100%" },
    statsModalAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
    statsModalAvatarFallback: { width: 80, height: 80, borderRadius: 40, marginBottom: 12, justifyContent: "center", alignItems: "center" },
    statsModalName: { fontSize: 20, fontWeight: "700", textAlign: "center" },
    statsModalEmail: { fontSize: 13, marginTop: 4, textAlign: "center" },
    statsRow: { flexDirection: "row", gap: 12, marginTop: 24, width: "100%" },
    bigStatCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    bigStatValue: { fontSize: 32, fontWeight: "800" },
    bigStatLabel: { fontSize: 10, fontWeight: "700", marginTop: 4, letterSpacing: 0.5 },

    // Unified Dashboard Header Styles
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md },
    sectionTitle: { fontSize: 18, fontWeight: "700" },
    badgeCount: { backgroundColor: "#6b728020", paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12 },
    badgeCountText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },

    // Logs List Styles
    logsList: { gap: 0 },
    logRow: { paddingVertical: 14, borderBottomWidth: 1 },
    logMain: { flexDirection: "row", alignItems: "center" },
    logAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#ccc" },
    logTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    logName: { fontSize: 15, fontWeight: "600", flex: 1 },
    logDate: { fontSize: 12, fontWeight: "500" },
    logMetaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    logTimeCol: { flex: 1, gap: 2 },
    logTimeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    logTimeText: { fontSize: 11, fontWeight: "700" },
    logLocBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#3b82f615", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    logLocText: { fontSize: 10, fontWeight: "700" },
    logStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    logStatusText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
});
