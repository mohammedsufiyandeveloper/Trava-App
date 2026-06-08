import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Dimensions, FlatList, ActivityIndicator, Modal, TouchableWithoutFeedback, Platform, TouchableOpacity, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { getWorkspaceMembers, getTeamAttendance } from "../services/api";
import { WorkspaceMember } from "../types";

const { width } = Dimensions.get("window");

interface Props {
    target: "projects" | "teams" | "attendance" | null;
    position: { x: number, y: number, w: number, h: number } | null;
    onClose: () => void;
}

export default function WidgetPreviewModal({ target, position, onClose }: Props) {
    const { colors, isDark } = useTheme();
    const { projects, activeWorkspace } = useWorkspace();
    const navigation = useNavigation<any>();
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [teamData, setTeamData] = useState<any[]>([]);
    const [attendanceStats, setAttendanceStats] = useState<{ total: number, present: number, absent: number, late: number } | null>(null);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState<'present' | 'absent' | 'late' | null>(null);

    useEffect(() => {
        if (target === "teams" && activeWorkspace) {
            setLoadingMembers(true);
            getWorkspaceMembers(activeWorkspace.id)
                .then(setMembers)
                .catch(console.error)
                .finally(() => setLoadingMembers(false));
        }
        if (target === "attendance" && activeWorkspace) {
            setLoadingAttendance(true);
            setSelectedFilter(null);
            const todayString = new Date().toISOString().split('T')[0];
            getTeamAttendance(activeWorkspace.id, todayString)
                .then((data: any[]) => {
                    setTeamData(data);
                    const stats = {
                        total: data.length,
                        present: data.filter((r: any) => !!r.attendance?.checkIn).length,
                        absent: data.filter((r: any) => !r.attendance?.checkIn).length,
                        late: data.filter((r: any) => {
                            if (!r.attendance?.checkIn) return false;
                            const inTime = new Date(r.attendance.checkIn);
                            const istIn = new Date(inTime.getTime() + (5.5 * 60 * 60 * 1000));
                            return (istIn.getUTCHours() > 9) || (istIn.getUTCHours() === 9 && istIn.getUTCMinutes() > 40);
                        }).length,
                    };
                    setAttendanceStats(stats);
                })
                .catch(console.error)
                .finally(() => setLoadingAttendance(false));
        }
    }, [target, activeWorkspace]);

    if (!target) return null;

    const renderProjectsPreview = () => {
        return (
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                    <Ionicons name="briefcase" size={20} color={colors.primary} />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Projects</Text>
                </View>
                <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                    {projects.length > 0 ? (
                        projects.map((p, i) => (
                            <TouchableOpacity 
                                key={p.id} 
                                style={[styles.listItem, i < projects.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                                onPress={() => {
                                    onClose();
                                    navigation.navigate("Projects", { screen: "ProjectDetail", params: { projectId: p.id, projectName: p.name, projectColor: p.color } });
                                }}
                            >
                                <View style={[styles.avatarSmall, { backgroundColor: p.color || colors.primary }]}>
                                    <Ionicons name="folder" size={14} color="#fff" />
                                </View>
                                <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.centerPad}>
                            <Text style={{ color: colors.textDim }}>No projects found.</Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        );
    };

    const renderTeamsPreview = () => {
        return (
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                    <Ionicons name="chatbubbles" size={20} color="#10b981" />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Team Members</Text>
                </View>
                <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                    {loadingMembers ? (
                        <View style={styles.centerPad}>
                            <ActivityIndicator color={colors.primary} />
                        </View>
                    ) : members.length > 0 ? (
                        members.map((m, i) => (
                            <TouchableOpacity 
                                key={m.id} 
                                style={[styles.listItem, i < members.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                                onPress={() => {
                                    onClose();
                                    navigation.navigate("DirectChat", {
                                        otherUserId: m.userId,
                                        otherUserName: m.user.surname || m.user.name,
                                        otherUserRole: m.workspaceRole
                                    });
                                }}
                            >
                                <View style={[styles.avatarSmall, { backgroundColor: "#10b981" }]}>
                                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
                                        {m.user.surname?.[0]?.toUpperCase() || m.user.name?.[0]?.toUpperCase()}
                                    </Text>
                                </View>
                                <View style={{ marginLeft: 8, flex: 1 }}>
                                    <Text style={[styles.listName, { color: colors.text, marginLeft: 0 }]} numberOfLines={1}>{m.user.surname || m.user.name}</Text>
                                    <Text style={{ color: colors.textDim, fontSize: 11 }}>{m.workspaceRole}</Text>
                                </View>
                                <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.centerPad}>
                            <Text style={{ color: colors.textDim }}>No members found.</Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        );
    };

    const getFilteredMembers = (filter: 'present' | 'absent' | 'late') => {
        const filtered = teamData.filter((r: any) => {
            if (filter === 'present') return !!r.attendance?.checkIn;
            if (filter === 'absent') return !r.attendance?.checkIn;
            if (filter === 'late') {
                if (!r.attendance?.checkIn) return false;
                const inTime = new Date(r.attendance.checkIn);
                const istIn = new Date(inTime.getTime() + (5.5 * 60 * 60 * 1000));
                return (istIn.getUTCHours() > 9) || (istIn.getUTCHours() === 9 && istIn.getUTCMinutes() > 40);
            }
            return false;
        });

        if (filter === 'present' || filter === 'late') {
            filtered.sort((a: any, b: any) => {
                const timeA = a.attendance?.checkIn ? new Date(a.attendance.checkIn).getTime() : 0;
                const timeB = b.attendance?.checkIn ? new Date(b.attendance.checkIn).getTime() : 0;
                return timeB - timeA;
            });
        }

        return filtered;
    };

    const filterConfig = {
        present: { label: 'Present', color: '#10b981', icon: 'checkmark-circle' as const },
        absent:  { label: 'Absent',  color: '#ef4444', icon: 'close-circle' as const },
        late:    { label: 'Late',    color: '#f59e0b', icon: 'time' as const },
    };

    const renderAttendancePreview = () => {
        // Drill-down: show member list for the selected filter
        if (selectedFilter) {
            const config = filterConfig[selectedFilter];
            const filtered = getFilteredMembers(selectedFilter);
            return (
                <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.cardHeader, { borderBottomColor: colors.border }]}
                        onPress={() => setSelectedFilter(null)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={18} color={colors.textDim} />
                        <Ionicons name={config.icon} size={18} color={config.color} style={{ marginLeft: 4 }} />
                        <Text style={[styles.cardTitle, { color: colors.text }]}>{config.label} ({filtered.length})</Text>
                    </TouchableOpacity>
                    <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                        {filtered.length > 0 ? filtered.map((r: any, i: number) => {
                            const name = r.member?.user?.surname || r.member?.user?.name || 'Unknown';
                            const initial = name.charAt(0).toUpperCase();
                            const checkInTime = r.attendance?.checkIn
                                ? new Date(r.attendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : null;
                            return (
                                <View
                                    key={r.member?.id || i}
                                    style={[styles.listItem, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                                >
                                    <View style={[styles.avatarSmall, { backgroundColor: config.color + '30' }]}>
                                        <Text style={{ color: config.color, fontWeight: '700', fontSize: 12 }}>{initial}</Text>
                                    </View>
                                    <View style={{ marginLeft: 8, flex: 1 }}>
                                        <Text style={[styles.listName, { color: colors.text, marginLeft: 0 }]} numberOfLines={1}>{name}</Text>
                                        <Text style={{ color: colors.textDim, fontSize: 11 }}>
                                            {checkInTime ? `Checked in at ${checkInTime}` : 'Not checked in'}
                                        </Text>
                                    </View>
                                    <Ionicons name={config.icon} size={16} color={config.color} />
                                </View>
                            );
                        }) : (
                            <View style={styles.centerPad}>
                                <Text style={{ color: colors.textDim }}>No members in this category.</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            );
        }

        // Default stats view
        return (
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                    <Ionicons name="people" size={20} color="#10b981" />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Team Attendance</Text>
                    <Text style={[{ fontSize: 11, color: colors.textDim, marginLeft: 'auto', fontWeight: '500' }]}>
                        Today
                    </Text>
                </View>
                {loadingAttendance ? (
                    <View style={styles.centerPad}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : attendanceStats ? (
                    <View>
                        <View style={styles.statRow}>
                            <TouchableOpacity style={[styles.statBubble, { backgroundColor: '#10b98118' }]} onPress={() => setSelectedFilter('present')} activeOpacity={0.7}>
                                <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                                <Text style={[styles.statNum, { color: '#10b981' }]}>{attendanceStats.present}</Text>
                                <Text style={[styles.statLabel, { color: colors.textDim }]}>Present</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.statBubble, { backgroundColor: '#ef444418' }]} onPress={() => setSelectedFilter('absent')} activeOpacity={0.7}>
                                <Ionicons name="close-circle" size={22} color="#ef4444" />
                                <Text style={[styles.statNum, { color: '#ef4444' }]}>{attendanceStats.absent}</Text>
                                <Text style={[styles.statLabel, { color: colors.textDim }]}>Absent</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.statBubble, { backgroundColor: '#f59e0b18' }]} onPress={() => setSelectedFilter('late')} activeOpacity={0.7}>
                                <Ionicons name="time" size={22} color="#f59e0b" />
                                <Text style={[styles.statNum, { color: '#f59e0b' }]}>{attendanceStats.late}</Text>
                                <Text style={[styles.statLabel, { color: colors.textDim }]}>Late</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                            <Text style={{ color: colors.textDim, fontSize: 12 }}>Total members</Text>
                            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{attendanceStats.total}</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.centerPad}>
                        <Text style={{ color: colors.textDim }}>No data available</Text>
                    </View>
                )}
            </View>
        );
    };

    let topPos = 0;
    let leftPos = 0;
    const contentWidth = 280; // slightly smaller so it fits nicely
    
    if (position) {
        // Place below the widget
        topPos = position.y + position.h + 8;
        // Try to align left edge with widget, but keep within screen bounds
        leftPos = Math.max(16, Math.min(position.x, width - contentWidth - 16));
    }

    return (
        <Modal
            visible={target !== null && position !== null}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    {/* Optional: subtle blur overlay, or completely transparent if preferred. User said "just open", so a light backdrop is good. */}
                    <BlurView intensity={isDark ? 15 : 20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                </View>
            </TouchableWithoutFeedback>
            
            <View 
                style={[
                    styles.content,
                    { 
                        width: contentWidth,
                        position: 'absolute',
                        top: topPos,
                        left: leftPos 
                    }
                ]}
            >
                {target === "projects" && renderProjectsPreview()}
                {target === "teams" && renderTeamsPreview()}
                {target === "attendance" && renderAttendancePreview()}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
    content: {
        zIndex: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    previewCard: {
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
        padding: SPACING.md,
        overflow: "hidden",
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: SPACING.md,
        marginBottom: SPACING.sm,
        borderBottomWidth: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "700",
        marginLeft: SPACING.sm,
    },
    listItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: SPACING.sm,
    },
    avatarSmall: {
        width: 28,
        height: 28,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    listName: {
        fontSize: 14,
        fontWeight: "600",
        marginLeft: SPACING.sm,
        flex: 1,
    },
    centerPad: {
        paddingVertical: SPACING.lg,
        alignItems: "center",
    },
    moreText: {
        textAlign: "center",
        fontSize: 12,
        marginTop: SPACING.md,
        fontWeight: "500",
    },
    statRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 8,
        paddingVertical: SPACING.md,
    },
    statBubble: {
        flex: 1,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 12,
        gap: 4,
    },
    statNum: {
        fontSize: 22,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: "600",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: SPACING.sm,
        marginTop: 4,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});
