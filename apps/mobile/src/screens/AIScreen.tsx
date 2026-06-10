import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
    Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
    sendTravisMessage,
    confirmTravisAction,
    extractText,
    extractCards,
    extractConfirmation,
    extractNavigation,
    type EntityRef,
    type ConfirmationPreview,
    type TravisHistoryMessage,
} from "../services/ai";
import { useResponsive } from "../hooks/useResponsive";
import { SPACING } from "../constants/theme";

// ---------------------------------------------------------------------------
// Message model
// ---------------------------------------------------------------------------
type AssistantMsg = {
    id: string;
    role: "assistant";
    text: string;
    cards?: EntityRef[];
    toolLabels?: string[];
    confirmation?: ConfirmationPreview;
    confirmationState?: "pending" | "processing" | "confirmed" | "cancelled" | "expired";
    navigation?: { route: string; entity?: EntityRef };
    isError?: boolean;
    clientRequestId?: string;
};
type UserMsg = { id: string; role: "user"; text: string };
type Msg = AssistantMsg | UserMsg;

const GREETING_ID = "greeting";

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Map a backend entity/route to a React Navigation action.
const entityIcon: Record<EntityRef["type"], keyof typeof Ionicons.glyphMap> = {
    task: "checkbox-outline",
    subtask: "git-branch-outline",
    project: "folder-outline",
    member: "person-outline",
    leave: "calendar-outline",
    indent: "cart-outline",
    daily_report: "document-text-outline",
    attendance: "time-outline",
};

// ---------------------------------------------------------------------------
// Minimal markdown (bold + bullets), reused from the prior screen.
// ---------------------------------------------------------------------------
function renderMarkdown(text: string, textColor: string) {
    return text.split("\n").map((line, lineIdx, arr) => {
        const isBullet = /^(\s*[-*•])\s/.test(line);
        const cleanLine = isBullet ? line.replace(/^(\s*[-*•])\s/, "") : line;
        const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
        const nodes = parts.map((part, i) =>
            part.startsWith("**") && part.endsWith("**") ? (
                <Text key={i} style={{ fontWeight: "700", color: textColor }}>
                    {part.slice(2, -2)}
                </Text>
            ) : (
                <Text key={i} style={{ color: textColor }}>
                    {part}
                </Text>
            )
        );
        return (
            <Text key={lineIdx} style={[styles.messageText, { color: textColor }]}>
                {isBullet ? "• " : ""}
                {nodes}
                {lineIdx < arr.length - 1 && line.length > 0 ? "\n" : ""}
            </Text>
        );
    });
}

export default function AIScreen() {
    const navigation = useNavigation<any>();
    const { colors, isDark } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const role = (activeWorkspace as any)?.workspaceRole as string | undefined;
    const isPrivileged = role === "OWNER" || role === "ADMIN" || role === "MANAGER";

    const suggestions = useMemo(() => {
        const base = [
            "What should I focus on today?",
            "Show overdue tasks.",
            "What are my deadlines this week?",
            "Create a task for tomorrow.",
            "Draft my daily report.",
        ];
        if (isPrivileged) {
            base.push("Who has too much work?", "Show pending leave requests.", "Summarize pending indents.");
        }
        return base;
    }, [isPrivileged]);

    const [messages, setMessages] = useState<Msg[]>([
        { id: GREETING_ID, role: "assistant", text: "Hi, I'm **Travis**. Ask me about your workspace, or tell me what to create — I'll show a preview before anything changes." },
    ]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | undefined>(undefined);

    const flatListRef = useRef<FlatList>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastUserMessageRef = useRef<string>("");
    const inFlightRef = useRef(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const workspaceId = activeWorkspace?.id;

    useEffect(() => {
        const show = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            () => setKeyboardVisible(true)
        );
        const hide = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
            () => setKeyboardVisible(false)
        );
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    // Cancel any in-flight request when leaving the screen.
    useEffect(() => () => abortRef.current?.abort(), []);

    // Conversations and visible history must never carry across workspaces.
    useEffect(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        inFlightRef.current = false;
        setLoading(false);
        setConversationId(undefined);
        setMessages([
            {
                id: GREETING_ID,
                role: "assistant",
                text: "Hi, I'm **Travis**. Ask me about your workspace, or tell me what to create — I'll show a preview before anything changes.",
            },
        ]);
    }, [workspaceId]);

    const buildHistory = useCallback((): TravisHistoryMessage[] => {
        return messages
            .filter((m) => m.id !== GREETING_ID)
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.text }));
    }, [messages]);

    const openEntity = useCallback(
        (entity?: EntityRef, route?: string) => {
            const type = entity?.type;
            const id = entity?.id ?? route?.split("/")[1];
            try {
                switch (type) {
                    case "task":
                    case "subtask":
                        navigation.navigate("TaskDetail", { taskId: id, taskName: entity?.label });
                        break;
                    case "project":
                        navigation.navigate("ProjectDetail", { projectId: id, projectName: entity?.label });
                        break;
                    case "indent":
                        navigation.navigate("IndentDetail", { indentId: id });
                        break;
                    case "leave":
                        navigation.navigate("Leave");
                        break;
                    case "member":
                        navigation.navigate("TeamList");
                        break;
                    case "attendance":
                        navigation.navigate("Attendance");
                        break;
                    default:
                        break;
                }
            } catch {
                /* route may not exist on every build */
            }
        },
        [navigation]
    );

    const handleSend = useCallback(
        async (text?: string) => {
            const messageText = (text ?? inputText).trim();
            if (!messageText || inFlightRef.current || !activeWorkspace) return;

            inFlightRef.current = true;
            lastUserMessageRef.current = messageText;
            const clientRequestId = makeId();

            const userMsg: UserMsg = { id: makeId(), role: "user", text: messageText };
            const history = buildHistory();
            setMessages((prev) => [userMsg, ...prev]);
            setInputText("");
            setLoading(true);

            const controller = new AbortController();
            abortRef.current = controller;

            const res = await sendTravisMessage(
                {
                    workspaceId: activeWorkspace.id,
                    message: messageText,
                    history,
                    conversationId,
                    currentScreen: "AI",
                    clientRequestId,
                },
                controller.signal
            );
            if (controller.signal.aborted) return;

            if (res.conversationId) setConversationId(res.conversationId);

            const toolLabels = res.events
                .filter((e) => e.type === "tool_started")
                .map((e) => (e as any).label as string);

            const assistantMsg: AssistantMsg = {
                id: makeId(),
                role: "assistant",
                text: extractText(res.events) || "I'm not sure how to help with that.",
                cards: extractCards(res.events),
                toolLabels: toolLabels.length ? Array.from(new Set(toolLabels)) : undefined,
                confirmation: extractConfirmation(res.events),
                confirmationState: extractConfirmation(res.events) ? "pending" : undefined,
                navigation: extractNavigation(res.events),
                isError: !res.success,
                clientRequestId,
            };
            setMessages((prev) => [assistantMsg, ...prev]);
            setLoading(false);
            inFlightRef.current = false;
            if (abortRef.current === controller) abortRef.current = null;
        },
        [inputText, activeWorkspace, conversationId, buildHistory]
    );

    const handleStop = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        inFlightRef.current = false;
        setLoading(false);
    }, []);

    const handleRetry = useCallback(() => {
        if (lastUserMessageRef.current) handleSend(lastUserMessageRef.current);
    }, [handleSend]);

    const resolveConfirmation = useCallback(
        (msgId: string, state: AssistantMsg["confirmationState"]) => {
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === msgId && m.role === "assistant" ? { ...m, confirmationState: state } : m
                )
            );
        },
        []
    );

    const handleConfirm = useCallback(
        async (msg: AssistantMsg) => {
            if (!msg.confirmation || inFlightRef.current) return;
            // Expiry guard.
            if (Date.now() > msg.confirmation.expiresAt) {
                resolveConfirmation(msg.id, "expired");
                return;
            }
            inFlightRef.current = true;
            setLoading(true);
            resolveConfirmation(msg.id, "processing");

            const controller = new AbortController();
            abortRef.current = controller;
            const res = await confirmTravisAction(
                msg.confirmation.token,
                msg.clientRequestId,
                controller.signal
            );
            if (controller.signal.aborted) {
                resolveConfirmation(msg.id, "pending");
                return;
            }

            const resultMsg: AssistantMsg = {
                id: makeId(),
                role: "assistant",
                text: extractText(res.events) || "Done.",
                cards: extractCards(res.events),
                navigation: extractNavigation(res.events),
                isError: !res.success,
            };
            setMessages((prev) => [resultMsg, ...prev]);
            resolveConfirmation(msg.id, res.success ? "confirmed" : "pending");
            setLoading(false);
            inFlightRef.current = false;
            if (abortRef.current === controller) abortRef.current = null;
        },
        [resolveConfirmation]
    );

    const handleEdit = useCallback(
        (msg: AssistantMsg) => {
            resolveConfirmation(msg.id, "cancelled");
            setInputText(msg.confirmation?.summary ?? "");
        },
        [resolveConfirmation]
    );

    // -----------------------------------------------------------------------
    // Renderers
    // -----------------------------------------------------------------------
    const renderCard = (card: EntityRef, key: string) => (
        <TouchableOpacity
            key={key}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => openEntity(card, card.route)}
            activeOpacity={0.7}
        >
            <View style={[styles.cardIcon, { backgroundColor: colors.primary + "1A" }]}>
                <Ionicons name={entityIcon[card.type] ?? "ellipse-outline"} size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {card.label}
                </Text>
                {!!card.sublabel && (
                    <Text style={[styles.cardSub, { color: colors.textDim }]} numberOfLines={1}>
                        {card.sublabel}
                    </Text>
                )}
            </View>
            {!!card.status && (
                <Text style={[styles.cardStatus, { color: colors.textDim, borderColor: colors.border }]}>
                    {card.status.replace(/_/g, " ")}
                </Text>
            )}
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
        </TouchableOpacity>
    );

    const renderConfirmation = (msg: AssistantMsg) => {
        const c = msg.confirmation!;
        const state = msg.confirmationState ?? "pending";
        const accent = c.destructive ? colors.error : colors.primary;
        return (
            <View style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: accent }]}>
                <View style={styles.confirmHeader}>
                    <Ionicons
                        name={c.destructive ? "warning-outline" : "create-outline"}
                        size={18}
                        color={accent}
                    />
                    <Text style={[styles.confirmTitle, { color: colors.text }]}>{c.title}</Text>
                </View>
                {c.destructive && (
                    <Text style={[styles.confirmWarn, { color: colors.error }]}>
                        This is a destructive action{c.affectedEntity ? ` on “${c.affectedEntity.label}”` : ""}.
                    </Text>
                )}
                {c.fields.map((f, i) => (
                    <View key={i} style={styles.confirmRow}>
                        <Text style={[styles.confirmLabel, { color: colors.textDim }]}>{f.label}</Text>
                        <Text style={[styles.confirmValue, { color: colors.text }]}>{f.value}</Text>
                    </View>
                ))}

                {state === "pending" ? (
                    <View style={styles.confirmActions}>
                        <TouchableOpacity
                            style={[styles.confirmBtn, { backgroundColor: accent }]}
                            onPress={() => handleConfirm(msg)}
                            disabled={loading}
                        >
                            <Text style={styles.confirmBtnText}>Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.confirmBtnOutline, { borderColor: colors.border }]}
                            onPress={() => handleEdit(msg)}
                            disabled={loading}
                        >
                            <Text style={[styles.confirmBtnOutlineText, { color: colors.text }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.confirmBtnOutline, { borderColor: colors.border }]}
                            onPress={() => resolveConfirmation(msg.id, "cancelled")}
                            disabled={loading}
                        >
                            <Text style={[styles.confirmBtnOutlineText, { color: colors.textDim }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Text style={[styles.confirmResolved, { color: colors.textDim }]}>
                        {state === "confirmed"
                            ? "✓ Confirmed"
                            : state === "processing"
                            ? "Processing…"
                            : state === "expired"
                            ? "This confirmation expired — please ask again."
                            : "Cancelled"}
                    </Text>
                )}
            </View>
        );
    };

    const renderMessage = ({ item }: { item: Msg }) => {
        if (item.role === "user") {
            return (
                <View style={[styles.messageRow, styles.userRow]}>
                    <View style={[styles.bubble, styles.userBubble, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.messageText, { color: "#fff" }]}>{item.text}</Text>
                    </View>
                </View>
            );
        }
        const textColor = item.isError ? colors.error : colors.text;
        return (
            <View style={[styles.messageRow, styles.aiRow]}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                    <Ionicons name="sparkles" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    {!!item.toolLabels?.length && (
                        <Text style={[styles.toolLabels, { color: colors.textDim }]}>
                            {item.toolLabels.join(" · ")}
                        </Text>
                    )}
                    <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.surfaceHighlight }]}>
                        {renderMarkdown(item.text, textColor)}
                    </View>
                    {item.cards?.map((card, i) => renderCard(card, `${item.id}-c${i}`))}
                    {item.confirmation && renderConfirmation(item)}
                    {item.navigation && !item.confirmation && (
                        <TouchableOpacity
                            style={[styles.openBtn, { borderColor: colors.primary }]}
                            onPress={() => openEntity(item.navigation!.entity, item.navigation!.route)}
                        >
                            <Ionicons name="open-outline" size={15} color={colors.primary} />
                            <Text style={[styles.openBtnText, { color: colors.primary }]}>
                                Open {item.navigation.entity?.label ?? "item"}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {item.isError && (
                        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                            <Ionicons name="refresh" size={14} color={colors.primary} />
                            <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const noWorkspace = !activeWorkspace;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
                <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: "100%", alignSelf: "center" }}>
                    {/* Header */}
                    <View
                        style={[
                            styles.header,
                            { borderBottomColor: colors.border, paddingHorizontal: value(20, SPACING.xl, SPACING.xxl) },
                        ]}
                    >
                        <View style={styles.headerLeft}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                <Ionicons name="chevron-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <View style={styles.headerTitle}>
                                <Ionicons name="sparkles" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                                <Text style={[styles.headerText, { color: colors.text }]}>Travis</Text>
                            </View>
                        </View>
                        {activeWorkspace && (
                            <Text style={[styles.workspaceName, { color: colors.textDim }]}>{activeWorkspace.name}</Text>
                        )}
                    </View>

                    {noWorkspace ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="cloud-offline-outline" size={40} color={colors.textDim} />
                            <Text style={[styles.emptyText, { color: colors.textDim }]}>
                                Select a workspace to chat with Travis.
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            inverted
                            keyboardShouldPersistTaps="handled"
                            ListHeaderComponent={
                                loading ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color={colors.primary} />
                                        <Text style={[styles.loadingText, { color: colors.textDim }]}>
                                            Travis is thinking…
                                        </Text>
                                        <TouchableOpacity onPress={handleStop} style={styles.stopBtn}>
                                            <Ionicons name="stop-circle" size={18} color={colors.error} />
                                            <Text style={[styles.stopText, { color: colors.error }]}>Stop</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : null
                            }
                            ListFooterComponent={
                                messages.length === 1 ? (
                                    <View style={styles.suggestionsContainer}>
                                        <Text style={[styles.suggestionsTitle, { color: colors.textDim }]}>Try asking:</Text>
                                        <View style={styles.suggestionsGrid}>
                                            {suggestions.map((s, i) => (
                                                <TouchableOpacity
                                                    key={i}
                                                    style={[
                                                        styles.suggestionChip,
                                                        { backgroundColor: colors.surfaceHighlight, borderColor: colors.border },
                                                    ]}
                                                    onPress={() => handleSend(s)}
                                                    disabled={loading}
                                                >
                                                    <Text style={[styles.suggestionText, { color: colors.text }]}>{s}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                ) : null
                            }
                        />
                    )}

                    {/* Input */}
                    <View
                        style={[
                            styles.inputContainer,
                            {
                                borderTopColor: colors.border,
                                backgroundColor: colors.surface,
                                paddingBottom: isKeyboardVisible ? 12 : Platform.OS === "ios" ? 30 : 12,
                            },
                        ]}
                    >
                        <TextInput
                            style={[
                                styles.input,
                                { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, maxHeight: 100 },
                            ]}
                            placeholder="Ask Travis anything…"
                            placeholderTextColor={colors.textDim}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            editable={!loading && !noWorkspace}
                            onSubmitEditing={() => handleSend()}
                        />
                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                { backgroundColor: loading ? colors.error : colors.primary },
                                (!inputText.trim() && !loading) || noWorkspace ? { opacity: 0.5 } : null,
                            ]}
                            onPress={() => (loading ? handleStop() : handleSend())}
                            disabled={(!inputText.trim() && !loading) || noWorkspace}
                        >
                            <Ionicons name={loading ? "stop" : "arrow-up"} size={24} color="#fff" />
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
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerTitle: { flexDirection: "row", alignItems: "center" },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    backButton: { marginRight: 12, paddingVertical: 4 },
    headerText: { fontSize: 18, fontWeight: "700" },
    workspaceName: { fontSize: 12, fontWeight: "500" },

    listContent: { padding: 16, paddingBottom: 24 },
    messageRow: { flexDirection: "row", marginBottom: 16, alignItems: "flex-start" },
    aiRow: { justifyContent: "flex-start" },
    userRow: { justifyContent: "flex-end" },

    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
        marginTop: 2,
    },

    bubble: { maxWidth: "100%", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18 },
    aiBubble: { borderTopLeftRadius: 4, alignSelf: "flex-start" },
    userBubble: { borderBottomRightRadius: 4, maxWidth: "80%" },
    messageText: { fontSize: 15, lineHeight: 22 },
    toolLabels: { fontSize: 11, fontStyle: "italic", marginBottom: 4, marginLeft: 4 },

    // Entity cards
    card: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 8,
    },
    cardIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    cardTitle: { fontSize: 14, fontWeight: "600" },
    cardSub: { fontSize: 12, marginTop: 1 },
    cardStatus: { fontSize: 10, fontWeight: "600", borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 },

    // Confirmation card
    confirmCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginTop: 10 },
    confirmHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    confirmTitle: { fontSize: 15, fontWeight: "700" },
    confirmWarn: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
    confirmRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, gap: 12 },
    confirmLabel: { fontSize: 13, flexShrink: 0 },
    confirmValue: { fontSize: 13, fontWeight: "500", flex: 1, textAlign: "right" },
    confirmActions: { flexDirection: "row", gap: 8, marginTop: 12 },
    confirmBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
    confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    confirmBtnOutline: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, alignItems: "center" },
    confirmBtnOutlineText: { fontWeight: "600", fontSize: 14 },
    confirmResolved: { fontSize: 13, fontWeight: "600", marginTop: 10 },

    openBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8, alignSelf: "flex-start" },
    openBtnText: { fontSize: 13, fontWeight: "600" },
    retryBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    retryText: { fontSize: 13, fontWeight: "600" },

    suggestionsContainer: { marginBottom: 24, marginTop: 10 },
    suggestionsTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12, marginLeft: 4 },
    suggestionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    suggestionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
    suggestionText: { fontSize: 13, fontWeight: "500" },

    loadingContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 10, gap: 8 },
    loadingText: { fontSize: 12, fontStyle: "italic" },
    stopBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
    stopText: { fontSize: 12, fontWeight: "600" },

    emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
    emptyText: { fontSize: 14, textAlign: "center" },

    inputContainer: { flexDirection: "row", alignItems: "flex-end", padding: 12, borderTopWidth: 1 },
    input: { flex: 1, minHeight: 45, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16 },
    sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginLeft: 10 },
});
