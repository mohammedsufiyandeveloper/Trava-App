import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StatusBar,
    Image,
    Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, DirectMessage, User } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useNotifications } from "../context/NotificationContext";
import { PusherClient } from "../services/PusherClient";
import {
    getOrCreateConversation,
    getDirectMessagesPage,
    sendDirectMessage,
    getCachedSession,
    sendTypingIndicator
} from "../services/api";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET } from "../constants/theme";
import { useResponsive } from "../hooks/useResponsive";
import { isToday, isYesterday, isSameDay, format as formatDate } from "date-fns";
import GlassSurface from "../components/GlassSurface";
import PressableScale from "../components/PressableScale";

type Props = NativeStackScreenProps<RootStackParamList, "DirectChat">;

export default function DirectChatScreen({ route, navigation }: Props) {
    const { conversationId: initialId, otherUserId, otherUserName, otherUserRole } = route.params;
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { notifications, markAsRead } = useNotifications();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [conversationId, setConversationId] = useState<string | null>(initialId || null);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [inputText, setInputText] = useState("");
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const [otherTypingName, setOtherTypingName] = useState("");
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTypingSentRef = useRef<number>(0);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [hasOlderMessages, setHasOlderMessages] = useState(false);
    const [nextMessageCursor, setNextMessageCursor] = useState<string | null>(null);
    const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
    // Visual-only: surfaces a "failed to send, tap to retry" affordance. Does not
    // change the underlying send call, dedup, or realtime delivery mechanism.
    const [failedMessage, setFailedMessage] = useState<string | null>(null);

    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        const showSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => {
            setKeyboardVisible(true);
        });
        const hideSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
            setKeyboardVisible(false);
        });
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const initChat = async () => {
        if (!activeWorkspace) return;
        setLoading(true);

        try {
            const session = await getCachedSession();
            if (session?.user) {
                setCurrentUser(session.user);
            }

            let convId = conversationId;
            if (!convId) {
                const conv = await getOrCreateConversation(activeWorkspace.id, otherUserId);
                if (conv) {
                    convId = conv.id;
                    setConversationId(convId);
                }
            }

            if (convId) {
                const page = await getDirectMessagesPage(convId);
                setMessages(page.messages);
                setHasOlderMessages(page.hasMore);
                setNextMessageCursor(page.nextCursor);
            }
        } catch (error) {
            console.error("Failed to init chat:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        initChat();
    }, [conversationId, activeWorkspace?.id]);

    const loadOlderMessages = async () => {
        if (
            !conversationId ||
            !hasOlderMessages ||
            !nextMessageCursor ||
            loadingOlderMessages
        ) {
            return;
        }

        setLoadingOlderMessages(true);
        try {
            const page = await getDirectMessagesPage(
                conversationId,
                nextMessageCursor
            );
            setMessages((current) => {
                const existingIds = new Set(current.map((message) => message.id));
                return [
                    ...current,
                    ...page.messages.filter((message) => !existingIds.has(message.id)),
                ];
            });
            setHasOlderMessages(page.hasMore);
            setNextMessageCursor(page.nextCursor);
        } finally {
            setLoadingOlderMessages(false);
        }
    };

    // Set up Pusher real-time subscription
    useEffect(() => {
        if (!conversationId) return;

        const pusherKey = process.env.EXPO_PUBLIC_PUSHER_KEY;
        const pusherCluster = process.env.EXPO_PUBLIC_PUSHER_CLUSTER;

        console.log(`[DirectChat] Initializing Pusher with Key: ${pusherKey?.slice(0, 5)}...`);

        if (!pusherKey || !pusherCluster) {
            console.error("[PUSHER] ERROR: Missing EXPO_PUBLIC_PUSHER_KEY or EXPO_PUBLIC_PUSHER_CLUSTER. Real-time will not work!");
            return;
        }

        const pusher = new PusherClient(pusherKey, {
            cluster: pusherCluster,
        });

        const channel = pusher.subscribe(conversationId);

        channel.bind("new-message", (newMessage: DirectMessage) => {
            setMessages((prev) => {
                // Guard against any duplicates
                if (prev.some((m) => m.id === newMessage.id)) {
                    return prev;
                }
                return [newMessage, ...prev];
            });
        });

        channel.bind("typing", (data: { userId: string; userName: string; isTyping: boolean }) => {
            if (data.userId !== currentUser?.id) {
                setIsOtherTyping(data.isTyping);
                setOtherTypingName(data.userName);
            }
        });

        return () => {
            channel.unbind_all();
            pusher.unsubscribe(conversationId);
            pusher.disconnect();
        };
    }, [conversationId]);

    // Mark messages as read when viewing this chat
    useEffect(() => {
        const unreadFromThisUser = notifications.filter(n =>
            n.data?.type === "direct_message" &&
            (n.data?.senderId === otherUserId || n.data?.conversationId === conversationId) &&
            !n.isRead
        );

        unreadFromThisUser.forEach(n => markAsRead(n.id));
    }, [notifications, otherUserId, conversationId]);

    const handleTextChange = (text: string) => {
        setInputText(text);

        if (!conversationId) return;

        // Send typing indicator (throttled to once every 2 seconds)
        const now = Date.now();
        if (now - lastTypingSentRef.current > 2000) {
            sendTypingIndicator(conversationId, true);
            lastTypingSentRef.current = now;
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to stop typing after 3 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            if (conversationId) {
                sendTypingIndicator(conversationId, false);
            }
        }, 3000);
    };

    const handleSend = async () => {
        if (!inputText.trim() || !conversationId || sending) return;

        const content = inputText.trim();
        setInputText("");
        setSending(true);
        setFailedMessage(null);

        // Stop typing indicator
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        sendTypingIndicator(conversationId, false);

        try {
            // Send the message — Pusher will deliver it to everyone including the sender
            // This avoids any duplicate/race-condition issues from optimistic updates
            await sendDirectMessage(conversationId, content);
        } catch (error) {
            console.error("Failed to send message:", error);
            setFailedMessage(content);
        } finally {
            setSending(false);
        }
    };

    const handleRetrySend = () => {
        if (!failedMessage) return;
        setInputText(failedMessage);
        setFailedMessage(null);
    };

    const formatDaySeparator = (date: Date) => {
        if (isToday(date)) return "Today";
        if (isYesterday(date)) return "Yesterday";
        return formatDate(date, "MMMM d, yyyy");
    };

    // `messages` is newest-first (index 0 = newest) to match the inverted FlatList.
    const renderMessage = ({ item, index }: { item: DirectMessage; index: number }) => {
        const isMe = item.userId === currentUser?.id;
        const olderNeighbor = messages[index + 1]; // rendered above (chronologically earlier)
        const newerNeighbor = messages[index - 1]; // rendered below (chronologically later)

        const isFirstOfGroup = !olderNeighbor || olderNeighbor.userId !== item.userId;
        const isLastOfGroup = !newerNeighbor || newerNeighbor.userId !== item.userId;
        const showDaySeparator = !olderNeighbor || !isSameDay(new Date(olderNeighbor.createdAt), new Date(item.createdAt));

        return (
            <View>
                {showDaySeparator && (
                    <View style={styles.daySeparatorRow}>
                        <Text style={[styles.daySeparatorText, { color: colors.textDim, backgroundColor: colors.surfaceSolid }]}>
                            {formatDaySeparator(new Date(item.createdAt))}
                        </Text>
                    </View>
                )}
                <View
                    style={[
                        styles.messageRow,
                        isMe ? styles.myMessageRow : styles.otherMessageRow,
                        { marginBottom: isFirstOfGroup ? 10 : 2 },
                    ]}
                >
                    <View
                        style={[
                            styles.messageBubble,
                            isMe
                                ? [
                                    styles.myBubble,
                                    { backgroundColor: colors.primary },
                                    !isLastOfGroup && styles.myBubbleGrouped,
                                    !isFirstOfGroup && styles.myBubbleGroupedTop,
                                ]
                                : [
                                    styles.otherBubble,
                                    { backgroundColor: colors.surfaceSolidRaised },
                                    !isLastOfGroup && styles.otherBubbleGrouped,
                                    !isFirstOfGroup && styles.otherBubbleGroupedTop,
                                ],
                        ]}
                    >
                        <Text style={[styles.messageText, { color: isMe ? colors.textInverse : colors.text }]}>
                            {item.content}
                        </Text>
                        {isLastOfGroup && (
                            <Text style={[styles.messageTime, { color: isMe ? "rgba(26,26,26,0.6)" : colors.textDim }]}>
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

                <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                    <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(16, SPACING.xl, SPACING.xxl) }]}>
                        <PressableScale onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
                            <Ionicons name="chevron-back" size={24} color={colors.text} />
                        </PressableScale>
                        <View style={styles.headerInfo}>
                            <Text style={[styles.headerName, { color: colors.text }]}>{otherUserName}</Text>
                            {otherUserRole ? (
                                <Text style={[styles.headerStatus, { color: colors.textDim, textTransform: 'lowercase' }]}>
                                    {otherUserRole}
                                </Text>
                            ) : null}
                        </View>
                        <View style={{ width: TOUCH_TARGET.min }} />
                    </View>

                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            inverted
                            onEndReached={loadOlderMessages}
                            onEndReachedThreshold={0.3}
                            ListFooterComponent={
                                loadingOlderMessages ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={colors.primary}
                                        style={{ paddingVertical: 12 }}
                                    />
                                ) : null
                            }
                            ListHeaderComponent={
                                isOtherTyping ? (
                                    <View style={styles.typingContainer}>
                                        <View style={[styles.typingBubble, { backgroundColor: colors.surfaceSolidRaised }]}>
                                            <Text style={[styles.typingText, { color: colors.textDim }]}>
                                                {otherTypingName} is typing…
                                            </Text>
                                        </View>
                                    </View>
                                ) : null
                            }
                            ListEmptyComponent={
                                <View style={styles.center}>
                                    <Text style={{ color: colors.textDim }}>No messages yet. Send a greeting!</Text>
                                </View>
                            }
                        />
                    )}

                    {failedMessage && (
                        <PressableScale
                            onPress={handleRetrySend}
                            style={[styles.retryBanner, { backgroundColor: colors.error + "20", borderColor: colors.error }]}
                            haptic="warning"
                            accessibilityLabel="Message failed to send. Tap to retry."
                        >
                            <Ionicons name="alert-circle" size={16} color={colors.error} />
                            <Text style={[styles.retryText, { color: colors.error }]}>Message failed to send. Tap to retry.</Text>
                        </PressableScale>
                    )}

                    <GlassSurface
                        level="elevated"
                        allowBlur
                        style={[styles.inputArea, {
                            borderRadius: 0,
                            borderLeftWidth: 0,
                            borderRightWidth: 0,
                            borderBottomWidth: 0,
                            borderTopColor: colors.glassBorder,
                            paddingBottom: isKeyboardVisible ? 12 : (Platform.OS === "ios" ? 30 : 12),
                        }]}
                    >
                        <TextInput
                            style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}
                            placeholder="Type a message..."
                            placeholderTextColor={colors.textDim}
                            value={inputText}
                            onChangeText={handleTextChange}
                            multiline
                            accessibilityLabel="Message input"
                        />
                        <PressableScale
                            style={[styles.sendBtn, { backgroundColor: colors.primary }, (!inputText.trim() || sending) && { opacity: 0.5 }]}
                            onPress={handleSend}
                            disabled={!inputText.trim() || sending}
                            accessibilityLabel="Send message"
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color={colors.textInverse} />
                            ) : (
                                <Ionicons name="send" size={20} color={colors.textInverse} />
                            )}
                        </PressableScale>
                    </GlassSurface>
                </View>
            </KeyboardAvoidingView>
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
        borderBottomWidth: 1,
    },
    backBtn: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, justifyContent: "center" },
    headerInfo: { alignItems: "center" },
    headerName: { fontSize: 16, fontWeight: "700" },
    headerStatus: { fontSize: 10, fontWeight: "600", marginTop: 2 },

    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    listContent: { padding: 16, paddingTop: 20 },

    daySeparatorRow: { alignItems: "center", marginVertical: 10 },
    daySeparatorText: {
        fontSize: 11,
        fontWeight: "700",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
    },

    messageRow: { flexDirection: "row", width: "100%" },
    myMessageRow: { justifyContent: "flex-end" },
    otherMessageRow: { justifyContent: "flex-start" },

    messageBubble: {
        maxWidth: "80%",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
    },
    myBubble: { borderBottomRightRadius: 4 },
    myBubbleGrouped: { borderBottomRightRadius: 18 },
    myBubbleGroupedTop: { borderTopRightRadius: 4 },
    otherBubble: { borderBottomLeftRadius: 4 },
    otherBubbleGrouped: { borderBottomLeftRadius: 18 },
    otherBubbleGroupedTop: { borderTopLeftRadius: 4 },

    messageText: { fontSize: 15, lineHeight: 20 },
    messageTime: { fontSize: 10, marginTop: 4, alignSelf: "flex-end" },

    retryBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
    },
    retryText: { fontSize: 12, fontWeight: "600", flexShrink: 1 },

    inputArea: {
        flexDirection: "row",
        alignItems: "flex-end",
        padding: 12,
        paddingBottom: 12,
        borderTopWidth: 1,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        borderRadius: 20,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 15,
    },
    sendBtn: {
        width: TOUCH_TARGET.min,
        height: TOUCH_TARGET.min,
        borderRadius: TOUCH_TARGET.min / 2,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 8,
    },
    typingContainer: {
        paddingHorizontal: 16,
        paddingVertical: 4,
        marginBottom: 8,
    },
    typingBubble: {
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
        borderBottomLeftRadius: 4,
    },
    typingText: {
        fontSize: 12,
        fontStyle: 'italic',
    },
});
