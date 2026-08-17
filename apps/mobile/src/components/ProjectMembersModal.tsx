import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    ActivityIndicator,
    ScrollView,
    Dimensions,
    Image,
    Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
    getProjectMembers,
    getWorkspaceMembers,
    addProjectMembers,
    updateProjectMember,
    removeProjectMember
} from "../services/api";
import PressableScale from "./PressableScale";
import ConfirmationSheet from "./ConfirmationSheet";
import EmptyState from "./EmptyState";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PROJECT_ROLES = ["PROJECT_MANAGER", "LEAD", "MEMBER", "VIEWER"];

interface ProjectMembersModalProps {
    visible: boolean;
    onClose: () => void;
    projectId: string;
    projectName: string;
}

export default function ProjectMembersModal({ visible, onClose, projectId, projectName }: ProjectMembersModalProps) {
    const { colors } = useTheme();
    const { activeWorkspace } = useWorkspace();
    
    const [projectMembers, setProjectMembers] = useState<any[]>([]);
    const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showAddMember, setShowAddMember] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);

    useEffect(() => {
        if (visible && projectId) {
            loadAllData();
        }
    }, [visible, projectId]);

    const loadAllData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [pMembers, wMembers] = await Promise.all([
                getProjectMembers(projectId),
                activeWorkspace ? getWorkspaceMembers(activeWorkspace.id) : []
            ]);
            setProjectMembers(pMembers);
            setWorkspaceMembers(wMembers);
        } catch (err) {
            setError("Failed to load members data");
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async (userId: string) => {
        setActionLoading(userId);
        try {
            const res = await addProjectMembers(projectId, [userId]);
            if (res.success) {
                await loadAllData();
                setShowAddMember(false);
            } else {
                Alert.alert("Error", res.error || "Failed to add member");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "An error occurred");
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdateRole = async (userId: string, currentRole: string) => {
        // Simple role toggling or dropdown logic
        const nextRoleMap: Record<string, string> = {
            "PROJECT_MANAGER": "LEAD",
            "LEAD": "MEMBER",
            "MEMBER": "VIEWER",
            "VIEWER": "PROJECT_MANAGER"
        };
        const nextRole = nextRoleMap[currentRole] || "MEMBER";

        setActionLoading(userId);
        try {
            const res = await updateProjectMember(projectId, userId, nextRole);
            if (res.success) {
                await loadAllData();
            } else {
                Alert.alert("Error", res.error || "Failed to update role");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "An error occurred");
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveMember = (userId: string, name: string) => {
        setRemoveTarget({ userId, name });
    };

    const confirmRemoveMember = async () => {
        if (!removeTarget) return;
        const { userId } = removeTarget;
        setActionLoading(userId);
        try {
            const res = await removeProjectMember(projectId, userId);
            if (res.success) {
                await loadAllData();
                setRemoveTarget(null);
            } else {
                Alert.alert("Error", res.error || "Failed to remove member");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message || "An error occurred");
        } finally {
            setActionLoading(null);
        }
    };

    const filteredWorkspaceMembers = workspaceMembers.filter(wm => {
        const isAlreadyInProject = projectMembers.some(pm => pm.userId === wm.userId);
        const matchesSearch = wm.user.surname?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             wm.user.name?.toLowerCase().includes(searchQuery.toLowerCase());
        return !isAlreadyInProject && matchesSearch;
    });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.sheet, { backgroundColor: colors.surfaceSolid }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={[styles.handle, { backgroundColor: colors.border }]} />
                        <View style={styles.titleRow}>
                            <View style={styles.titleLeft}>
                                <View style={[styles.iconBox, { backgroundColor: colors.primary + "25" }]}>
                                    <Ionicons name="people-outline" size={18} color={colors.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.title, { color: colors.text }]}>Project Team</Text>
                                    <Text style={[styles.subtitle, { color: colors.textDim }]} numberOfLines={1}>{projectName}</Text>
                                </View>
                            </View>
                            <PressableScale
                                onPress={onClose}
                                style={styles.closeBtn}
                                accessibilityLabel="Close"
                                accessibilityRole="button"
                                hitSlop={8}
                            >
                                <Ionicons name="close" size={22} color={colors.textDim} />
                            </PressableScale>
                        </View>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <View style={styles.content}>
                            {/* Current Members Section */}
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, { color: colors.textDim }]}>
                                    {projectMembers.length} Members
                                </Text>
                                <PressableScale
                                    style={[styles.addBtn, { backgroundColor: colors.primary }]}
                                    onPress={() => setShowAddMember(true)}
                                    haptic="selection"
                                    accessibilityRole="button"
                                    accessibilityLabel="Add member"
                                >
                                    <Ionicons name="add" size={18} color="#fff" />
                                    <Text style={styles.addBtnText}>Add</Text>
                                </PressableScale>
                            </View>

                            <ScrollView style={styles.memberList}>
                                {projectMembers.map((member) => (
                                    <View key={member.userId} style={[styles.memberCard, { borderBottomColor: colors.border }]}>
                                        <View style={styles.memberInfo}>
                                            <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                                                {member.image ? (
                                                    <Image source={{ uri: member.image }} style={styles.avatarImg} />
                                                ) : (
                                                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                                                        {(member.surname?.[0] || member.name.charAt(0)).toUpperCase()}
                                                    </Text>
                                                )}
                                            </View>
                                            <View style={styles.userDetails}>
                                                <Text style={[styles.memberName, { color: colors.text }]}>{member.surname || member.name}</Text>
                                                <PressableScale
                                                    style={[styles.roleBadge, { backgroundColor: colors.background }]}
                                                    onPress={() => handleUpdateRole(member.userId, member.role)}
                                                    disabled={actionLoading === member.userId}
                                                    haptic="selection"
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Role: ${(member.role ?? "MEMBER").replace("_", " ")}. Tap to change`}
                                                >
                                                    <Text style={[styles.roleText, { color: colors.textDim }]}>
                                                        {(member.role ?? "MEMBER").replace("_", " ")}
                                                    </Text>
                                                    <Ionicons name="chevron-forward" size={12} color={colors.textDim} style={{ marginLeft: 4 }} />
                                                </PressableScale>
                                            </View>
                                        </View>

                                        <PressableScale
                                            onPress={() => handleRemoveMember(member.userId, member.surname || member.name)}
                                            disabled={actionLoading === member.userId}
                                            style={styles.removeBtn}
                                            haptic="warning"
                                            accessibilityRole="button"
                                            accessibilityLabel={`Remove ${member.surname || member.name} from project`}
                                        >
                                            {actionLoading === member.userId ? (
                                                <ActivityIndicator size="small" color={colors.error} />
                                            ) : (
                                                <Ionicons name="trash-outline" size={20} color={colors.error} />
                                            )}
                                        </PressableScale>
                                    </View>
                                ))}
                                {projectMembers.length === 0 && (
                                    <EmptyState icon="people-outline" title="No members yet" message="Add workspace members to this project to get started." />
                                )}
                                <View style={{ height: 40 }} />
                            </ScrollView>
                        </View>
                    )}
                </View>

                <ConfirmationSheet
                    visible={!!removeTarget}
                    title="Remove member"
                    description={removeTarget ? `Are you sure you want to remove ${removeTarget.name} from this project?` : undefined}
                    tone="destructive"
                    confirmLabel="Remove"
                    cancelLabel="Cancel"
                    loading={!!removeTarget && actionLoading === removeTarget.userId}
                    onConfirm={confirmRemoveMember}
                    onClose={() => { if (!actionLoading) setRemoveTarget(null); }}
                />

                {/* Add Member Sub-Modal */}
                <Modal visible={showAddMember} transparent animationType="fade">
                    <View style={styles.subOverlay}>
                        <View style={[styles.subContainer, { backgroundColor: colors.surfaceSolid }]}>
                            <View style={styles.subHeader}>
                                <Text style={[styles.subTitle, { color: colors.text }]}>Add Workspace Member</Text>
                                <PressableScale
                                    onPress={() => setShowAddMember(false)}
                                    style={styles.subCloseBtn}
                                    accessibilityLabel="Close"
                                    accessibilityRole="button"
                                    hitSlop={8}
                                >
                                    <Ionicons name="close" size={24} color={colors.textDim} />
                                </PressableScale>
                            </View>

                            <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <Ionicons name="search" size={18} color={colors.textDim} />
                                <TextInput
                                    style={[styles.searchInput, { color: colors.text }]}
                                    placeholder="Search workspace members..."
                                    placeholderTextColor={colors.textDim}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    accessibilityLabel="Search workspace members"
                                />
                            </View>

                            <ScrollView style={styles.subList}>
                                {filteredWorkspaceMembers.map((wm) => (
                                    <PressableScale
                                        key={wm.userId}
                                        style={[styles.subCard, { borderBottomColor: colors.border }]}
                                        onPress={() => handleAddMember(wm.userId)}
                                        disabled={!!actionLoading}
                                        haptic="selection"
                                        accessibilityRole="button"
                                        accessibilityLabel={`Add ${wm.user.surname || wm.user.name}`}
                                    >
                                        <View style={styles.subInfo}>
                                            <View style={[styles.subAvatar, { backgroundColor: colors.primary + "15" }]}>
                                                <Text style={[styles.subAvatarText, { color: colors.primary }]}>
                                                    {(wm.user.surname?.[0] || wm.user.name.charAt(0)).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View>
                                                <Text style={[styles.subName, { color: colors.text }]}>{wm.user.surname || wm.user.name}</Text>
                                                <Text style={[styles.subEmail, { color: colors.textDim }]}>{wm.user.email}</Text>
                                            </View>
                                        </View>
                                        {actionLoading === wm.userId ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                                        )}
                                    </PressableScale>
                                ))}
                                {filteredWorkspaceMembers.length === 0 && (
                                    <Text style={[styles.emptyText, { color: colors.textDim, marginTop: 40 }]}>
                                        No available members found.
                                    </Text>
                                )}
                                <View style={{ height: 20 }} />
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "flex-end",
    },
    sheet: {
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        height: "80%",
    },
    header: {
        alignItems: "center",
        paddingTop: 12,
        paddingBottom: 8,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        paddingHorizontal: SPACING.lg,
    },
    titleLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: 18,
        fontFamily: FONTS.bold,
    },
    subtitle: {
        fontSize: 12,
        marginTop: -2,
    },
    closeBtn: { minWidth: TOUCH_TARGET.min, minHeight: TOUCH_TARGET.min, alignItems: "flex-end", justifyContent: "center" },
    subCloseBtn: { minWidth: TOUCH_TARGET.min, minHeight: TOUCH_TARGET.min, alignItems: "flex-end", justifyContent: "center" },
    content: { 
        flex: 1,
        paddingHorizontal: SPACING.lg,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 20,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 13,
        fontFamily: FONTS.bold,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    addBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 14,
        minHeight: TOUCH_TARGET.min - 8,
        borderRadius: 16,
        gap: 4,
    },
    addBtnText: {
        color: "#fff",
        fontSize: 13,
        fontFamily: FONTS.bold,
    },
    memberList: { flex: 1 },
    memberCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    memberInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    avatarImg: {
        width: "100%",
        height: "100%",
    },
    avatarText: {
        fontSize: 16,
        fontFamily: FONTS.bold,
    },
    userDetails: { gap: 2 },
    memberName: {
        fontSize: 15,
        fontFamily: FONTS.semibold,
    },
    roleBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: "flex-start",
    },
    roleText: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        textTransform: "uppercase",
    },
    removeBtn: {
        minWidth: TOUCH_TARGET.min,
        minHeight: TOUCH_TARGET.min,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyText: {
        textAlign: "center",
        marginTop: 40,
        fontSize: 14,
    },
    
    // Sub-Modal Styles
    subOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        padding: SPACING.xl,
    },
    subContainer: {
        borderRadius: BORDER_RADIUS.lg,
        maxHeight: "80%",
        padding: SPACING.lg,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    subHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    subTitle: {
        fontSize: 17,
        fontFamily: FONTS.bold,
    },
    searchBox: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        height: 44,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        marginBottom: 16,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
    },
    subList: { flexGrow: 0 },
    subCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    subInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    subAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    subAvatarText: {
        fontSize: 14,
        fontFamily: FONTS.bold,
    },
    subName: {
        fontSize: 14,
        fontFamily: FONTS.semibold,
    },
    subEmail: {
        fontSize: 11,
    },
});
