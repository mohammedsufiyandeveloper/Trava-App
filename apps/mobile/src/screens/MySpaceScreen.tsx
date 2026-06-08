import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { getMySpaceTodos, createMySpaceTodo, toggleMySpaceTodo, deleteMySpaceTodo, syncMySpaceTodos } from "../services/api";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useResponsive } from "../hooks/useResponsive";

export default function MySpaceScreen({ navigation }: any) {
    const { colors } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [todos, setTodos] = useState<any[]>([]);
    const [newTodoText, setNewTodoText] = useState("");
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    
    // Double-click to edit state
    const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    const [lastTap, setLastTap] = useState<{ id: string; time: number } | null>(null);

    // Handle double click (tap timing check)
    const handleTodoPress = (todo: any) => {
        const now = Date.now();
        if (lastTap && lastTap.id === todo.id && (now - lastTap.time) < 300) {
            // Double click detected
            setEditingTodoId(todo.id);
            setEditingText(todo.text);
            setLastTap(null); // Reset
        } else {
            setLastTap({ id: todo.id, time: now });
        }
    };

    // Save edited todo text
    const handleSaveEdit = async (todoId: string) => {
        if (!editingText.trim() || !activeWorkspace) {
            setEditingTodoId(null);
            return;
        }

        const trimmed = editingText.trim();
        const currentTodo = todos.find((t) => t.id === todoId);
        if (!currentTodo || currentTodo.text === trimmed) {
            setEditingTodoId(null);
            return;
        }

        // Optimistically update locally
        const updatedList = todos.map((t) => t.id === todoId ? { ...t, text: trimmed } : t);
        setTodos(updatedList);
        setEditingTodoId(null);

        setSyncing(true);
        try {
            const serverTodos = await syncMySpaceTodos(activeWorkspace.id, updatedList);
            setTodos(serverTodos);
        } catch (error) {
            console.error("[MySpaceScreen] Error saving todo edit:", error);
            loadTodos();
        } finally {
            setSyncing(false);
        }
    };

    // Load personal todos from database
    const loadTodos = useCallback(async () => {
        if (!activeWorkspace) return;
        setLoading(true);
        try {
            const fetchedTodos = await getMySpaceTodos(activeWorkspace.id);
            setTodos(fetchedTodos);
        } catch (error) {
            console.error("[MySpaceScreen] Error loading todos:", error);
        } finally {
            setLoading(false);
        }
    }, [activeWorkspace]);

    useEffect(() => {
        loadTodos();
    }, [loadTodos]);

    // Handle adding a todo
    const handleAddTodo = async () => {
        if (!newTodoText.trim() || !activeWorkspace) return;

        const text = newTodoText.trim();
        setNewTodoText("");
        setSyncing(true);
        try {
            const serverTodos = await createMySpaceTodo(activeWorkspace.id, text);
            setTodos(serverTodos);
        } catch (error) {
            console.error("[MySpaceScreen] Error adding todo:", error);
        } finally {
            setSyncing(false);
        }
    };

    // Handle toggling todo status
    const handleToggleTodo = async (todoId: string) => {
        if (!activeWorkspace) return;

        const currentTodo = todos.find((t) => t.id === todoId);
        if (!currentTodo) return;

        setSyncing(true);
        try {
            const serverTodos = await toggleMySpaceTodo(activeWorkspace.id, todoId, !currentTodo.completed);
            setTodos(serverTodos);
        } catch (error) {
            console.error("[MySpaceScreen] Error toggling todo:", error);
        } finally {
            setSyncing(false);
        }
    };

    // Handle deleting a todo
    const handleDeleteTodo = async (todoId: string) => {
        if (!activeWorkspace) return;

        setSyncing(true);
        try {
            const serverTodos = await deleteMySpaceTodo(activeWorkspace.id, todoId);
            setTodos(serverTodos);
        } catch (error) {
            console.error("[MySpaceScreen] Error deleting todo:", error);
        } finally {
            setSyncing(false);
        }
    };

    const ongoingTodos = todos.filter((t) => !t.completed);
    const completedTodos = todos.filter((t) => t.completed);

    // Reorder todo list when dragging ends
    const handleDragEnd = ({ data }: { data: any[] }) => {
        const newTodosList = [...data, ...completedTodos];
        setTodos(newTodosList);
        saveOrder(newTodosList);
    };

    // Save reordered list to backend
    const saveOrder = async (currentList: any[]) => {
        if (!activeWorkspace) return;
        setSyncing(true);
        try {
            // Assign descending createdAt dates so that "orderBy: { createdAt: 'desc' }" preserves this order
            const baseTime = Date.now();
            const reorderedList = currentList.map((todo, idx) => ({
                ...todo,
                createdAt: new Date(baseTime - idx * 1000).toISOString()
            }));

            const serverTodos = await syncMySpaceTodos(activeWorkspace.id, reorderedList);
            setTodos(serverTodos);
        } catch (error) {
            console.error("[MySpaceScreen] Error saving todo order:", error);
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                </SafeAreaView>
            </GestureHandlerRootView>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
            {/* Header */}
            <View style={[styles.header, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                <View style={[styles.headerContent, { maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }]}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerSubtitle, { color: colors.textDim }]}>
                            Workspace &gt; {activeWorkspace?.name || "Tusker"}
                        </Text>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>My Space</Text>
                    </View>
                    {syncing ? (
                        <View style={{ width: 40, justifyContent: "center", alignItems: "center" }}>
                            <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                    ) : (
                        <View style={{ width: 40 }} />
                    )}
                </View>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
            >
                <DraggableFlatList
                    data={ongoingTodos}
                    onDragEnd={handleDragEnd}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <View style={[styles.todosContainer, { maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center', marginBottom: SPACING.md }]}>
                            {/* Input Field */}
                            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.todoInput, { color: colors.text }]}
                                    placeholder="Add a new task..."
                                    placeholderTextColor={colors.textDim}
                                    value={newTodoText}
                                    onChangeText={setNewTodoText}
                                    onSubmitEditing={handleAddTodo}
                                    returnKeyType="done"
                                />
                                <TouchableOpacity
                                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                                    onPress={handleAddTodo}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="add" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* Section Header */}
                            <Text style={[styles.sectionTitle, { color: colors.textDim }]}>
                                ONGOING ({ongoingTodos.length})
                            </Text>

                            {ongoingTodos.length === 0 && (
                                <View style={styles.emptyState}>
                                    <Ionicons name="checkmark-circle-outline" size={48} color={colors.textDim + "40"} />
                                    <Text style={[styles.emptyText, { color: colors.textDim }]}>
                                        No ongoing tasks. Add one above!
                                    </Text>
                                </View>
                            )}
                        </View>
                    }
                    renderItem={({ item, drag, isActive }) => {
                        return (
                            <ScaleDecorator>
                                <TouchableOpacity
                                    onPress={() => handleTodoPress(item)}
                                    onLongPress={drag}
                                    disabled={isActive}
                                    delayLongPress={300}
                                    style={[
                                        styles.todoItem, 
                                        { 
                                            backgroundColor: colors.surface, 
                                            borderColor: colors.border,
                                            maxWidth: MAX_CONTENT_WIDTH,
                                            width: '100%',
                                            alignSelf: 'center',
                                            marginBottom: SPACING.sm
                                        },
                                        isActive && { backgroundColor: colors.border, opacity: 0.9 }
                                    ]}
                                    activeOpacity={0.9}
                                >
                                    <TouchableOpacity
                                        style={styles.checkbox}
                                        onPress={() => handleToggleTodo(item.id)}
                                    >
                                        <View style={[styles.checkboxOutline, { borderColor: colors.textDim }]}>
                                            <View style={styles.checkboxInner} />
                                        </View>
                                    </TouchableOpacity>
                                    {editingTodoId === item.id ? (
                                        <TextInput
                                            style={[styles.todoText, { color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingVertical: 2 }]}
                                            value={editingText}
                                            onChangeText={setEditingText}
                                            onBlur={() => handleSaveEdit(item.id)}
                                            onSubmitEditing={() => handleSaveEdit(item.id)}
                                            autoFocus
                                            returnKeyType="done"
                                        />
                                    ) : (
                                        <Text style={[styles.todoText, { color: colors.text }]}>
                                            {item.text}
                                        </Text>
                                    )}
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => handleDeleteTodo(item.id)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            </ScaleDecorator>
                        );
                    }}
                    ListFooterComponent={
                        completedTodos.length > 0 ? (
                            <View style={[styles.todosContainer, { maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center', marginTop: SPACING.lg }]}>
                                <Text style={[styles.sectionTitle, { color: colors.textDim }]}>
                                    COMPLETED ({completedTodos.length})
                                </Text>
                                {completedTodos.map((todo) => (
                                    <TouchableOpacity
                                        key={todo.id}
                                        style={[styles.todoItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.6 }]}
                                        onPress={() => handleTodoPress(todo)}
                                        activeOpacity={0.9}
                                    >
                                        <TouchableOpacity
                                            style={styles.checkbox}
                                            onPress={() => handleToggleTodo(todo.id)}
                                        >
                                            <View style={[styles.checkboxChecked, { backgroundColor: colors.primary }]}>
                                                <Ionicons name="checkmark" size={14} color="#fff" />
                                            </View>
                                        </TouchableOpacity>
                                        {editingTodoId === todo.id ? (
                                            <TextInput
                                                style={[styles.todoText, styles.completedText, { color: colors.textDim, borderBottomWidth: 1, borderBottomColor: colors.primary, paddingVertical: 2 }]}
                                                value={editingText}
                                                onChangeText={setEditingText}
                                                onBlur={() => handleSaveEdit(todo.id)}
                                                onSubmitEditing={() => handleSaveEdit(todo.id)}
                                                autoFocus
                                                returnKeyType="done"
                                            />
                                        ) : (
                                            <Text style={[styles.todoText, styles.completedText, { color: colors.textDim }]}>
                                                {todo.text}
                                            </Text>
                                        )}
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => handleDeleteTodo(todo.id)}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null
                    }
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center"
    },
    header: {
        paddingVertical: SPACING.md
    },
    headerContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center"
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: "center"
    },
    headerSubtitle: {
        fontSize: 11,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: 2
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
        letterSpacing: 0.3
    },
    scrollContent: {
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.xl
    },
    todosContainer: {
        gap: SPACING.lg
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        paddingLeft: SPACING.md,
        paddingRight: SPACING.xs,
        height: 52
    },
    todoInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: "500"
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: BORDER_RADIUS.sm,
        justifyContent: "center",
        alignItems: "center"
    },
    sectionContainer: {
        gap: SPACING.sm
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.8,
        marginBottom: SPACING.xs
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: SPACING.xl,
        gap: SPACING.sm
    },
    emptyText: {
        fontSize: 14,
        fontWeight: "500"
    },
    todoItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACING.md,
        height: 54,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        gap: SPACING.md
    },
    checkbox: {
        justifyContent: "center",
        alignItems: "center"
    },
    checkboxOutline: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        justifyContent: "center",
        alignItems: "center"
    },
    checkboxInner: {
        width: 0,
        height: 0,
        borderRadius: 0
    },
    checkboxChecked: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center"
    },
    todoText: {
        flex: 1,
        fontSize: 15,
        fontWeight: "500"
    },
    completedText: {
        textDecorationLine: "line-through"
    },
    deleteButton: {
        width: 36,
        height: 36,
        justifyContent: "center",
        alignItems: "center"
    },
    reorderToggleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center"
    },
    reorderGrip: {
        justifyContent: "center",
        alignItems: "center",
        width: 24
    }
});
