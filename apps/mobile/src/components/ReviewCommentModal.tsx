import React, { useState } from "react";
import { 
    View, 
    Text, 
    StyleSheet, 
    Modal, 
    TouchableOpacity, 
    TextInput, 
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

interface ReviewCommentModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (comment: string, attachmentData?: any) => Promise<void>;
    taskName: string;
}

export default function ReviewCommentModal({ visible, onClose, onSubmit, taskName }: ReviewCommentModalProps) {
    const { colors, isDark } = useTheme();
    const [comment, setComment] = useState("");
    const [attachment, setAttachment] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ["image/*", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                if (asset.size && asset.size > 10 * 1024 * 1024) {
                    alert("File size must be less than 10MB");
                    return;
                }
                setAttachment(asset);
            }
        } catch (err) {
            console.error("Error picking document:", err);
        }
    };

    const handleRemoveAttachment = () => {
        setAttachment(null);
    };

    const handleSubmit = async () => {
        if (!comment.trim() && !attachment) {
            alert("Please provide a comment or attachment");
            return;
        }

        setIsSubmitting(true);
        try {
            let attachmentData = null;
            if (attachment) {
                const base64Data = await FileSystem.readAsStringAsync(attachment.uri, {
                    encoding: "base64" as any,
                });
                attachmentData = {
                    fileName: attachment.name,
                    fileType: attachment.mimeType || "application/octet-stream",
                    fileSize: attachment.size,
                    base64Data: base64Data,
                };
            }

            await onSubmit(comment.trim(), attachmentData);
            
            // Reset
            setComment("");
            setAttachment(null);
            onClose();
        } catch (error) {
            console.error("Error submitting review:", error);
            alert("Failed to submit review. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setComment("");
        setAttachment(null);
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleCancel}
        >
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.overlay}
            >
                <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>Add Review Comment</Text>
                        <TouchableOpacity onPress={handleCancel}>
                            <Ionicons name="close" size={24} color={colors.textDim} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.description, { color: colors.textDim }]}>
                            Moving <Text style={{ fontWeight: "600", color: colors.text }}>{taskName}</Text> to Review requires a comment or attachment.
                        </Text>

                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.text }]}>Comment</Text>
                            <TextInput
                                style={[styles.input, { 
                                    backgroundColor: isDark ? colors.surfaceHighlight : "#f8fafc",
                                    borderColor: colors.border,
                                    color: colors.text
                                }]}
                                placeholder="Add your review comment here..."
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={4}
                                value={comment}
                                onChangeText={setComment}
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.section}>
                            <Text style={[styles.label, { color: colors.text }]}>Attachment (Optional)</Text>
                            {attachment ? (
                                <View style={[styles.attachmentBox, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                                    <View style={styles.attachmentInfo}>
                                        <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                                        <View style={{ flex: 1, marginLeft: 8 }}>
                                            <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                                                {attachment.name}
                                            </Text>
                                            <Text style={[styles.attachmentSize, { color: colors.textDim }]}>
                                                {(attachment.size! / 1024).toFixed(1)} KB
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={handleRemoveAttachment} style={styles.removeBtn}>
                                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity 
                                    style={[styles.uploadBtn, { borderColor: colors.border, borderStyle: "dashed" }]}
                                    onPress={handlePickFile}
                                >
                                    <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                                    <Text style={[styles.uploadText, { color: colors.primary }]}>Upload File</Text>
                                </TouchableOpacity>
                            )}
                            <Text style={[styles.hint, { color: colors.textDim }]}>
                                Supported: Images, PDF, Word, Excel (Max 10MB)
                            </Text>
                        </View>
                    </ScrollView>

                    <View style={[styles.footer, { borderTopColor: colors.border }]}>
                        <TouchableOpacity 
                            style={[styles.cancelBtn, { borderColor: colors.border }]} 
                            onPress={handleCancel}
                            disabled={isSubmitting}
                        >
                            <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[
                                styles.submitBtn, 
                                { backgroundColor: (comment.trim() || attachment) ? colors.primary : colors.textMuted }
                            ]} 
                            onPress={handleSubmit}
                            disabled={isSubmitting || (!comment.trim() && !attachment)}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.submitBtnText}>To Review</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
        padding: SPACING.md,
    },
    modalContent: {
        width: "100%",
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        overflow: "hidden",
        maxHeight: "80%",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.05)",
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
    },
    scroll: {
        padding: SPACING.lg,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: SPACING.lg,
    },
    section: {
        marginBottom: SPACING.lg,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
    },
    input: {
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        padding: SPACING.md,
        fontSize: 14,
        minHeight: 100,
    },
    uploadBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 2,
        gap: 8,
    },
    uploadText: {
        fontSize: 14,
        fontWeight: "600",
    },
    attachmentBox: {
        flexDirection: "row",
        alignItems: "center",
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
    },
    attachmentInfo: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    attachmentName: {
        fontSize: 13,
        fontWeight: "500",
    },
    attachmentSize: {
        fontSize: 11,
        marginTop: 2,
    },
    removeBtn: {
        padding: 8,
    },
    hint: {
        fontSize: 11,
        marginTop: 6,
    },
    footer: {
        flexDirection: "row",
        padding: SPACING.lg,
        gap: SPACING.md,
        borderTopWidth: 1,
    },
    cancelBtn: {
        flex: 1,
        height: 48,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
    },
    cancelBtnText: {
        fontWeight: "600",
    },
    submitBtn: {
        flex: 1,
        height: 48,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: BORDER_RADIUS.md,
    },
    submitBtnText: {
        color: "#fff",
        fontWeight: "700",
    },
});
