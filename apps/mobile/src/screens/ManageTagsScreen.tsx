import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";
import { useWorkspace } from "../context/WorkspaceContext";
import { getTags, deleteTag } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";
import CreateTagModal from "../components/CreateTagModal";
import AppCard from "../components/AppCard";
import PressableScale from "../components/PressableScale";
import ConfirmationSheet from "../components/ConfirmationSheet";
import { useToast } from "../context/ToastContext";

// Deterministic decorative swatch color per tag name so tags stay easy to
// scan visually even though the backend has no color field for tags.
const SWATCH_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#84cc16"];
function swatchColorFor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return SWATCH_COLORS[hash % SWATCH_COLORS.length];
}

export default function ManageTagsScreen({ navigation }: any) {
    const { activeWorkspace } = useWorkspace();
    const { colors, isDark } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const [tags, setTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingTag, setEditingTag] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const toast = useToast();

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
        haptics.light();
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
        setDeleteTarget(tag);
    };

    const confirmDelete = async () => {
        if (!deleteTarget || !activeWorkspace) return;
        setDeleting(true);
        try {
            await deleteTag(activeWorkspace.id, deleteTarget.id);
            toast.success("Tag deleted");
            setDeleteTarget(null);
            fetchTags();
        } catch (error: any) {
            toast.error(error.message || "Failed to delete tag");
        } finally {
            setDeleting(false);
        }
    };

    const renderTagItem = ({ item }: { item: any }) => (
        <AppCard style={styles.tagCard} padded={false}>
            <View style={styles.tagRow}>
                <View style={[styles.swatch, { backgroundColor: swatchColorFor(item.name) }]} />
                <View style={styles.tagInfo}>
                    <Text style={[styles.tagName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item._count?.tasks > 0 && (
                        <Text style={[styles.tagCount, { color: colors.textDim }]}>
                            {item._count.tasks} task{item._count.tasks === 1 ? "" : "s"}
                        </Text>
                    )}
                </View>
                <View style={styles.tagActions}>
                    <PressableScale
                        onPress={() => handleEdit(item)}
                        style={styles.actionIcon}
                        haptic="selection"
                        accessibilityLabel={`Edit tag ${item.name}`}
                        accessibilityRole="button"
                    >
                        <Ionicons name="pencil-outline" size={18} color={colors.textDim} />
                    </PressableScale>
                    <PressableScale
                        onPress={() => handleDelete(item)}
                        style={styles.actionIcon}
                        haptic="light"
                        accessibilityLabel={`Delete tag ${item.name}`}
                        accessibilityRole="button"
                    >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </PressableScale>
                </View>
            </View>
        </AppCard>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
            <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(SPACING.md, SPACING.xl, SPACING.xxl) }]}>
                <PressableScale
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    haptic="light"
                    accessibilityLabel="Go back"
                    accessibilityRole="button"
                >
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </PressableScale>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Task Tags</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textDim }]}>Manage tags for your workspace</Text>
                </View>
                <PressableScale
                    onPress={handleCreate}
                    style={[styles.addBtn, { backgroundColor: colors.primary }]}
                    haptic="selection"
                    accessibilityLabel="Create new tag"
                    accessibilityRole="button"
                >
                    <Ionicons name="add" size={24} color="#fff" />
                </PressableScale>
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

            <ConfirmationSheet
                visible={!!deleteTarget}
                title="Delete tag?"
                description={deleteTarget ? `“${deleteTarget.name}” will be removed from all tasks it's applied to. This action cannot be undone.` : undefined}
                tone="destructive"
                confirmLabel="Delete"
                loading={deleting}
                onConfirm={confirmDelete}
                onClose={() => setDeleteTarget(null)}
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
    backBtn: { width: 44, height: 44, justifyContent: "center" },
    headerTitleContainer: { flex: 1, marginLeft: 4 },
    headerTitle: { fontSize: 18, fontFamily: FONTS.bold },
    headerSubtitle: { fontSize: 12, marginTop: 1 },
    addBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
    },
    list: { padding: SPACING.lg, paddingBottom: SPACING.bottomTabBar },
    tagCard: {
        marginBottom: 10,
    },
    tagRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 4,
        gap: 12,
    },
    swatch: { width: 12, height: 12, borderRadius: 6 },
    tagInfo: { flex: 1 },
    tagName: { fontSize: 15, fontFamily: FONTS.semibold },
    tagCount: { fontSize: 12, marginTop: 2 },
    tagActions: { flexDirection: "row", alignItems: "center" },
    actionIcon: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyContainer: { alignItems: "center", marginTop: 100 },
    emptyText: { marginTop: 12, fontSize: 14 },
});
