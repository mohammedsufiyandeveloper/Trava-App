import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
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
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useResponsive } from "../hooks/useResponsive";

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

        // Stop typing indicator
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        sendTypingIndicator(conversationId, false);

        try {
            // Send the message — Pusher will deliver it to everyone including the sender
            // This avoids any duplicate/race-condition issues from optimistic updates
            await sendDirectMessage(conversationId, content);
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: DirectMessage }) => {
        const isMe = item.userId === currentUser?.id;

        return (
            <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
                <View style={[
                    styles.messageBubble,
                    isMe ? [styles.myBubble, { backgroundColor: colors.primary }] : [styles.otherBubble, { backgroundColor: colors.surfaceHighlight }]
                ]}>
                    <Text style={[styles.messageText, { color: isMe ? "#fff" : colors.text }]}>
                        {item.content}
                    </Text>
                    <Text style={[styles.messageTime, { color: isMe ? "rgba(255,255,255,0.7)" : colors.textDim }]}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
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
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.headerInfo}>
                            <Text style={[styles.headerName, { color: colors.text }]}>{otherUserName}</Text>
                            <Text style={[styles.headerStatus, { color: colors.textDim, textTransform: 'lowercase' }]}>
                                {otherUserRole || "active"}
                            </Text>
                        </View>
                        <View style={{ width: 40 }} />
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
                                        <Text style={[styles.typingText, { color: colors.textDim }]}>
                                            {otherTypingName} is typing...
                                        </Text>
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

                    <View style={[styles.inputArea, { 
                        borderTopColor: colors.border, 
                        backgroundColor: colors.surface,
                        paddingBottom: isKeyboardVisible ? 12 : (Platform.OS === "ios" ? 30 : 12)
                    }]}>
                        <TextInput
                            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                            placeholder="Type a message..."
                            placeholderTextColor={colors.textDim}
                            value={inputText}
                            onChangeText={handleTextChange}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, { backgroundColor: colors.primary }, (!inputText.trim() || sending) && { opacity: 0.5 }]}
                            onPress={handleSend}
                            disabled={!inputText.trim() || sending}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="send" size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
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
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    headerInfo: { alignItems: "center" },
    headerName: { fontSize: 16, fontWeight: "700" },
    headerStatus: { fontSize: 10, fontWeight: "600", marginTop: 2 },

    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    listContent: { padding: 16, gap: 12, paddingTop: 20 },

    messageRow: { flexDirection: "row", width: "100%", marginBottom: 4 },
    myMessageRow: { justifyContent: "flex-end" },
    otherMessageRow: { justifyContent: "flex-start" },

    messageBubble: {
        maxWidth: "80%",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    myBubble: { borderBottomRightRadius: 4 },
    otherBubble: { borderBottomLeftRadius: 4 },

    messageText: { fontSize: 15, lineHeight: 20 },
    messageTime: { fontSize: 10, marginTop: 4, alignSelf: "flex-end" },

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
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 8,
    },
    typingContainer: {
        paddingHorizontal: 16,
        paddingVertical: 4,
        marginBottom: 8,
    },
    typingText: {
        fontSize: 12,
        fontStyle: 'italic',
    },
});
