import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { getTags, deleteTag } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";
import CreateTagModal from "../components/CreateTagModal";

export default function ManageTagsScreen({ navigation }: any) {
    const { activeWorkspace } = useWorkspace();
    const { colors, isDark } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const [tags, setTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingTag, setEditingTag] = useState<any>(null);

    const fetchTags = useCallback(async () => {
        if (!activeWorkspace) return;
        try {
            const data = await getTags(activeWorkspace.id);
            setTags(data);
        } catch (error) {
            console.error("Error fetching tags:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeWorkspace]);

    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTags();
    };

    const handleCreate = () => {
        setEditingTag(null);
        setModalVisible(true);
    };

    const handleEdit = (tag: any) => {
        setEditingTag(tag);
        setModalVisible(true);
    };

    const handleDelete = (tag: any) => {
        Alert.alert(
            "Delete Tag",
            `Are you sure you want to delete "${tag.name}"? This action cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteTag(activeWorkspace!.id, tag.id);
                            fetchTags();
                        } catch (error: any) {
                            Alert.alert("Error", error.message || "Failed to delete tag");
                        }
                    }
                }
            ]
        );
    };

    const renderTagItem = ({ item }: { item: any }) => (
        <View style={[styles.tagPill, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.tagInfo}>
                <Text style={[styles.tagName, { color: colors.text }]}>{item.name.toUpperCase()}</Text>
                {item._count?.tasks > 0 && (
                    <Text style={[styles.tagCount, { color: colors.textDim }]}>({item._count.tasks})</Text>
                )}
            </View>
            <View style={styles.tagActions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionIcon}>
                    <Ionicons name="pencil" size={14} color={colors.textDim} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionIcon}>
                    <Ionicons name="close" size={16} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
            <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Task Tags</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textDim }]}>Manage tags for your workspace</Text>
                </View>
                <TouchableOpacity onPress={handleCreate} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            ) : (
                <FlatList
                    data={tags}
                    renderItem={renderTagItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={[styles.list, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}
                    numColumns={1}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="pricetag-outline" size={48} color={colors.textDim} />
                            <Text style={[styles.emptyText, { color: colors.textDim }]}>No tags found in this workspace.</Text>
                        </View>
                    }
                />
            )}

            <CreateTagModal 
                visible={modalVisible}
                onClose={() => {
                    setModalVisible(false);
                    fetchTags();
                }}
                editingTag={editingTag}
            />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 4 },
    headerTitleContainer: { flex: 1, marginLeft: 12 },
    headerTitle: { fontSize: 18, fontWeight: "700" },
    headerSubtitle: { fontSize: 12, marginTop: 1 },
    addBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    list: { padding: SPACING.lg, paddingBottom: SPACING.bottomTabBar },
    tagPill: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 10,
        justifyContent: "space-between",
    },
    tagInfo: { flexDirection: "row", alignItems: "center" },
    tagName: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5 },
    tagCount: { fontSize: 12, marginLeft: 6 },
    tagActions: { flexDirection: "row", alignItems: "center" },
    actionIcon: { padding: 6, marginLeft: 4 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyContainer: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 12, fontSize: 14 },
});
