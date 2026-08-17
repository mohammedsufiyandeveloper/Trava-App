import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    StatusBar,
    Image,
    TextInput,
    Modal,
    Platform,
    DeviceEventEmitter
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, WorkspaceMember, User } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useNotifications } from "../context/NotificationContext";
import { getWorkspaceMembers, getCachedSession, getConversations } from "../services/api";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET, FONTS } from "../constants/theme";
import { format, isToday } from "date-fns";
import { useResponsive } from "../hooks/useResponsive";
import PressableScale from "../components/PressableScale";
import StatusChip from "../components/StatusChip";
import EmptyState from "../components/EmptyState";

type Props = NativeStackScreenProps<RootStackParamList, "TeamList">;

export default function TeamListScreen({ navigation }: Props) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { notifications } = useNotifications();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [conversations, setConversations] = useState<any[]>([]);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const [showMembersModal, setShowMembersModal] = useState(false);

    const filteredMembers = useMemo(() => {
        let result = [...members];

        // Sort: "You" first, then alphabetical by full name
        result.sort((a, b) => {
            const isMeA = a.userId === currentUser?.id || a.user.id === currentUser?.id;
            const isMeB = b.userId === currentUser?.id || b.user.id === currentUser?.id;

            if (isMeA) return -1;
            if (isMeB) return 1;

            const fullNameA = (a.user.surname || a.user.name).toLowerCase();
            const fullNameB = (b.user.surname || b.user.name).toLowerCase();
            return fullNameA.localeCompare(fullNameB);
        });

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(m => {
                const fullName = (m.user.surname || m.user.name).toLowerCase();
                const email = m.user.email?.toLowerCase() || "";
                return fullName.includes(query) || email.includes(query);
            });
        }

        return result;
    }, [members, searchQuery, currentUser?.id]);

    const fetchChats = async () => {
        if (!activeWorkspace) return;
        setLoadingChats(true);
        try {
            const [chatData, session] = await Promise.all([
                getConversations(activeWorkspace.id),
                getCachedSession()
            ]);
            setConversations(chatData.filter((c: any) => c.messages && c.messages.length > 0));
            if (session?.user) {
                setCurrentUser(session.user);
            }
        } catch (error) {
            console.error("Failed to fetch chats:", error);
        } finally {
            setLoadingChats(false);
        }
    };

    const fetchMembers = async () => {
        if (!activeWorkspace) return;
        setLoadingMembers(true);
        try {
            const memberData = await getWorkspaceMembers(activeWorkspace.id);
            setMembers(memberData);
        } catch (error) {
            console.error("Failed to fetch members:", error);
        } finally {
            setLoadingMembers(false);
        }
    };

    useEffect(() => {
        fetchChats();
        fetchMembers();
    }, [activeWorkspace?.id]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchChats();
        });
        return unsubscribe;
    }, [navigation, activeWorkspace?.id]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("remote_update", () => {
            fetchChats();
        });
        return () => sub.remove();
    }, [activeWorkspace?.id]);

    const renderChat = ({ item }: { item: any }) => {
        const otherParticipant = item.participants?.find((p: any) => p.id !== currentUser?.id) || item.participants?.[0];
        if (!otherParticipant) return null;
        const participantName: string = otherParticipant.surname || otherParticipant.name || "Unknown";
        const participantInitial: string = participantName.charAt(0).toUpperCase();

        const hasUnread = notifications.some(n =>
            n.data?.type === "direct_message" &&
            n.data?.senderId === otherParticipant.id &&
            !n.isRead
        );

        const lastMessage = item.messages?.[0];
        const otherRole = members.find(m => m.userId === otherParticipant.id)?.workspaceRole;

        return (
            <PressableScale
                haptic="selection"
                style={[styles.chatCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}
                onPress={() => {
                    navigation.navigate("DirectChat", {
                        otherUserId: otherParticipant.id,
                        otherUserName: otherParticipant.surname || otherParticipant.name,
                        otherUserRole: otherRole || "Member"
                    });
                }}
                accessibilityLabel={`Open conversation with ${participantName}`}
            >
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    {otherParticipant.image ? (
                        <Image source={{ uri: otherParticipant.image }} style={styles.avatarImage} />
                    ) : (
                        <Text style={styles.avatarText}>
                            {participantInitial}
                        </Text>
                    )}
                </View>

                <View style={styles.chatInfo}>
                    <View style={styles.chatHeader}>
                        <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                            {participantName}
                        </Text>
                        {lastMessage && (
                            <Text style={[styles.chatTime, { color: colors.textDim }]}>
                                {isToday(new Date(lastMessage.createdAt))
                                    ? format(new Date(lastMessage.createdAt), 'h:mm a')
                                    : format(new Date(lastMessage.createdAt), 'MMM d')}
                            </Text>
                        )}
                    </View>
                    <View style={styles.chatSubRow}>
                        {otherRole && (
                            <StatusChip
                                label={otherRole}
                                kind={otherRole.toLowerCase() === "owner" || otherRole.toLowerCase() === "admin" ? "info" : "neutral"}
                                size="sm"
                                style={styles.roleChip}
                            />
                        )}
                        {lastMessage && (
                            <Text style={[styles.lastMessage, { color: hasUnread ? colors.primary : colors.textDim, fontFamily: hasUnread ? FONTS.semibold : FONTS.regular }]} numberOfLines={1}>
                                {lastMessage.sender?.name ? `${lastMessage.sender.name}: ` : ""}{lastMessage.content}
                            </Text>
                        )}
                    </View>
                </View>

                {hasUnread && (
                    <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                )}
            </PressableScale>
        );
    };

    const renderMember = ({ item }: { item: WorkspaceMember }) => {
        const isMe = item.userId === currentUser?.id || item.user.id === currentUser?.id;

        const memberDisplayName = item.user.surname || item.user.name;

        return (
            <PressableScale
                haptic={isMe ? null : "selection"}
                style={[styles.memberCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}
                onPress={() => {
                    if (isMe) return;
                    setShowMembersModal(false);
                    navigation.navigate("DirectChat", {
                        otherUserId: item.userId,
                        otherUserName: memberDisplayName,
                        otherUserRole: item.workspaceRole
                    });
                }}
                disabled={isMe}
                accessibilityLabel={isMe ? `${memberDisplayName} (you)` : `Start a chat with ${memberDisplayName}`}
            >
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    {item.user.image ? (
                        <Image source={{ uri: item.user.image }} style={styles.avatarImage} />
                    ) : (
                        <Text style={styles.avatarText}>
                            {(item.user.surname?.[0] || item.user.name.charAt(0)).toUpperCase()}
                        </Text>
                    )}
                </View>

                <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>
                        {memberDisplayName} {isMe ? "(You)" : ""}
                    </Text>
                    <StatusChip
                        label={item.workspaceRole}
                        kind={item.workspaceRole.toLowerCase() === "owner" || item.workspaceRole.toLowerCase() === "admin" ? "info" : "neutral"}
                        size="sm"
                        style={{ marginTop: 4 }}
                    />
                </View>

                {!isMe && (
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
                )}
            </PressableScale>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
            <View style={[styles.header, { paddingHorizontal: value(16, SPACING.xl, SPACING.xxl) }]}>
                <PressableScale
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </PressableScale>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
                <View style={{ width: TOUCH_TARGET.min }} />
            </View>

            {loadingChats ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={conversations}
                    renderItem={renderChat}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { paddingHorizontal: value(16, SPACING.xl, SPACING.xxl) }]}
                    ListEmptyComponent={
                        <EmptyState
                            icon="chatbubbles-outline"
                            title="No recent chats"
                            message="Start a conversation with a team member using the button below."
                        />
                    }
                />
            )}

            <PressableScale
                style={[
                    styles.fab,
                    {
                        backgroundColor: colors.primary,
                        bottom: 20,
                    }
                ]}
                haptic="light"
                onPress={() => setShowMembersModal(true)}
                accessibilityLabel="Start a new chat"
                accessibilityHint="Opens the team member list to start a conversation"
            >
                <Ionicons name="people" size={20} color="#fff" />
                <Text style={styles.fabLabel}>New chat</Text>
            </PressableScale>

            <Modal
                visible={showMembersModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowMembersModal(false)}
            >
                <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]} edges={["top"]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Team Members</Text>
                        <PressableScale
                            onPress={() => setShowMembersModal(false)}
                            style={styles.closeBtn}
                            accessibilityLabel="Close"
                        >
                            <Ionicons name="close" size={24} color={colors.text} />
                        </PressableScale>
                    </View>

                    <View style={styles.searchContainer}>
                        <View style={[styles.searchBox, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
                            <Ionicons name="search" size={18} color={colors.textDim} />
                            <TextInput
                                style={[styles.searchInput, { color: colors.text }]}
                                placeholder="Search team members..."
                                placeholderTextColor={colors.textDim}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                                autoCorrect={false}
                                clearButtonMode="while-editing"
                                accessibilityLabel="Search team members"
                            />
                        </View>
                    </View>

                    {loadingMembers ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredMembers}
                            renderItem={renderMember}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <EmptyState
                                    icon="people-outline"
                                    title="No members found"
                                    message="Try a different search term."
                                />
                            }
                        />
                    )}
                </SafeAreaView>
            </Modal>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontFamily: FONTS.bold },

    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    centerEmpty: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 80 },
    listContent: { padding: 16, paddingTop: 8, paddingBottom: 100, gap: 12 },

    searchContainer: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    searchBox: {
        flexDirection: "row",
        alignItems: "center",
        height: 48,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        paddingHorizontal: 12,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        height: "100%",
    },

    chatCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarImage: { width: 48, height: 48, borderRadius: 24 },
    avatarText: { color: "#fff", fontSize: 18, fontFamily: FONTS.bold },

    chatInfo: { flex: 1, marginLeft: 12, justifyContent: "center" },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    chatName: { fontSize: 16, fontFamily: FONTS.bold, flex: 1 },
    chatTime: { fontSize: 11, fontFamily: FONTS.regular },
    chatSubRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 },
    roleChip: { marginTop: 0 },
    lastMessage: { fontSize: 13, flexShrink: 1 },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginLeft: 8,
    },

    memberCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
    },
    memberInfo: { flex: 1, marginLeft: 12 },
    memberName: { fontSize: 15, fontFamily: FONTS.semibold, marginBottom: 2 },

    fab: {
        position: "absolute",
        right: 20,
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 20,
        borderRadius: BORDER_RADIUS.full,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.2)",
    },
    fabLabel: { color: "#fff", fontSize: 15, fontFamily: FONTS.bold },

    modalContainer: { flex: 1 },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.1)',
        marginBottom: 8,
    },
    modalTitle: { fontSize: 18, fontFamily: FONTS.bold },
    closeBtn: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, alignItems: "flex-end", justifyContent: "center" },
});

