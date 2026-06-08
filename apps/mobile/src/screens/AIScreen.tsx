import React, { useState, useRef, useEffect } from "react";
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
    Animated,
    Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { sendAIChatMessage, AIChatMessage } from "../services/ai";
import { useResponsive } from "../hooks/useResponsive";
import { SPACING } from "../constants/theme";

const SUGGESTIONS = [
    "What are my pending tasks?",
    "Show me projects in this workspace",
    "Who is present today?",
    "Help me manage my projects",
];

export default function AIScreen() {
    const navigation = useNavigation();
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "model"; text: string }>>([
        {
            id: "1",
            role: "model",
            text: "Hello! I'm Trava AI. How can I help you today?",
        },
    ]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

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

    const handleSend = async (text?: string) => {
        const messageText = text || inputText.trim();
        if (!messageText || loading || !activeWorkspace) return;

        const userMsg = { id: Date.now().toString(), role: "user" as const, text: messageText };
        setMessages((prev) => [userMsg, ...prev]);
        setInputText("");
        setLoading(true);

        try {
            // Prepare history for Gemini - filter out the initial greeting (id: "1")
            // because Gemini history must start with a "user" message
            const history: AIChatMessage[] = [...messages]
                .reverse()
                .filter(m => m.id !== "1")
                .map((m) => ({
                    role: m.role,
                    parts: [{ text: m.text }],
                }));

            const response = await sendAIChatMessage(activeWorkspace.id, messageText, history);

            if (response.success && response.data) {
                setMessages((prev) => [
                    { id: (Date.now() + 1).toString(), role: "model", text: response.data!.message },
                    ...prev,
                ]);
            } else {
                setMessages((prev) => [
                    { id: (Date.now() + 1).toString(), role: "model", text: "Sorry, I encountered an error: " + (response.error || "Unknown error") },
                    ...prev,
                ]);
            }
        } catch (error) {
            setMessages((prev) => [
                { id: (Date.now() + 1).toString(), role: "model", text: "I'm having trouble connecting to the server." },
                ...prev,
            ]);
        } finally {
            setLoading(false);
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isAI = item.role === "model";
        return (
            <View style={[styles.messageRow, isAI ? styles.aiRow : styles.userRow]}>
                {isAI && (
                    <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                        <Ionicons name="sparkles" size={16} color={colors.primary} />
                    </View>
                )}
                <View
                    style={[
                        styles.bubble,
                        isAI
                            ? [styles.aiBubble, { backgroundColor: colors.surfaceHighlight }]
                            : [styles.userBubble, { backgroundColor: colors.primary }],
                    ]}
                >
                    <Text style={[styles.messageText, { color: isAI ? colors.text : "#fff" }]}>
                        {item.text}
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
                    <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(20, SPACING.xl, SPACING.xxl) }]}>
                        <View style={styles.headerLeft}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={styles.backButton}
                            >
                                <Ionicons name="chevron-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <View style={styles.headerTitle}>
                                <Ionicons name="sparkles" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                                <Text style={[styles.headerText, { color: colors.text }]}>Trava AI</Text>
                            </View>
                        </View>
                        {activeWorkspace && (
                            <Text style={[styles.workspaceName, { color: colors.textDim }]}>{activeWorkspace.name}</Text>
                        )}
                    </View>

                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        inverted
                        ListFooterComponent={
                            messages.length === 1 ? (
                                <View style={styles.suggestionsContainer}>
                                    <Text style={[styles.suggestionsTitle, { color: colors.textDim }]}>Try asking:</Text>
                                    <View style={styles.suggestionsGrid}>
                                        {SUGGESTIONS.map((s, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={[styles.suggestionChip, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}
                                                onPress={() => handleSend(s)}
                                            >
                                                <Text style={[styles.suggestionText, { color: colors.text }]}>{s}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            ) : null
                        }
                    />

                    {loading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textDim }]}>Trava AI is thinking...</Text>
                        </View>
                    )}

                    <View style={[styles.inputContainer, { 
                        borderTopColor: colors.border, 
                        backgroundColor: colors.surface,
                        paddingBottom: isKeyboardVisible ? 12 : (Platform.OS === "ios" ? 30 : 12)
                    }]}>
                        <TextInput
                            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, maxHeight: 100 }]}
                            placeholder="Ask me anything..."
                            placeholderTextColor={colors.textDim}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, { backgroundColor: colors.primary }, (!inputText.trim() || loading) && { opacity: 0.5 }]}
                            onPress={() => handleSend()}
                            disabled={!inputText.trim() || loading}
                        >
                            <Ionicons name="arrow-up" size={24} color="#fff" />
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
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: { flexDirection: "row", alignItems: "center" },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    backButton: { marginRight: 12, paddingVertical: 4 },
    headerText: { fontSize: 18, fontWeight: "700" },
    workspaceName: { fontSize: 12, fontWeight: "500" },

    listContent: { padding: 16, paddingBottom: 24 },
    messageRow: { flexDirection: "row", marginBottom: 16, alignItems: "flex-end" },
    aiRow: { justifyContent: "flex-start" },
    userRow: { justifyContent: "flex-end" },

    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
        marginBottom: 4,
    },

    bubble: {
        maxWidth: "80%",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
    },
    aiBubble: { borderBottomLeftRadius: 4 },
    userBubble: { borderBottomRightRadius: 4 },

    messageText: { fontSize: 15, lineHeight: 22 },

    suggestionsContainer: { marginBottom: 24, marginTop: 10 },
    suggestionsTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12, marginLeft: 4 },
    suggestionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    suggestionChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    suggestionText: { fontSize: 13, fontWeight: "500" },

    loadingContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingBottom: 10,
        gap: 8,
    },
    loadingText: { fontSize: 12, fontStyle: "italic" },

    inputContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        padding: 12,
        paddingBottom: Platform.OS === "ios" ? 30 : 12,
        borderTopWidth: 1,
    },
    input: {
        flex: 1,
        minHeight: 45,
        borderRadius: 22,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 16,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 10,
    },
});
