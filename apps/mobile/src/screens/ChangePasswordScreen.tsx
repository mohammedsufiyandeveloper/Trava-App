import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import { useTheme } from "../context/ThemeContext";
import { changePassword } from "../services/api";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useResponsive } from "../hooks/useResponsive";

type Props = NativeStackScreenProps<RootStackParamList, "ChangePassword">;

export default function ChangePasswordScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const [loading, setLoading] = useState(false);
    
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        if (newPassword.length < 8) {
            Alert.alert("Error", "New password must be at least 8 characters long");
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            Alert.alert("Success", "Password changed successfully", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to change password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(16, SPACING.xl, SPACING.xxl) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Change Password</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(24, SPACING.xl, SPACING.xxl) }]} keyboardShouldPersistTaps="handled">
                    <View style={styles.infoBox}>
                        <Ionicons name="shield-checkmark-outline" size={40} color={colors.primary} />
                        <Text style={[styles.infoTitle, { color: colors.text }]}>Secure your account</Text>
                        <Text style={[styles.infoText, { color: colors.textDim }]}>
                            Enter your current password and a new secure password to update your account security.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        {/* Current Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textDim }]}>CURRENT PASSWORD</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    secureTextEntry={!showCurrent}
                                    placeholder="Enter current password"
                                    placeholderTextColor={colors.textDim + "80"}
                                />
                                <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeBtn}>
                                    <Ionicons name={showCurrent ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textDim} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* New Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textDim }]}>NEW PASSWORD</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry={!showNew}
                                    placeholder="Min 8 characters"
                                    placeholderTextColor={colors.textDim + "80"}
                                />
                                <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                                    <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textDim} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Confirm Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textDim }]}>CONFIRM NEW PASSWORD</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showConfirm}
                                    placeholder="Repeat new password"
                                    placeholderTextColor={colors.textDim + "80"}
                                />
                                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                                    <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textDim} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                            onPress={handleChangePassword}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>Update Password</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        borderBottomWidth: 1,
    },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "700" },
    scrollContent: { padding: 24 },
    infoBox: { alignItems: "center", marginBottom: 32 },
    infoTitle: { fontSize: 20, fontWeight: "700", marginTop: 16, marginBottom: 8 },
    infoText: { fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
    form: { gap: 20 },
    inputGroup: { gap: 8 },
    label: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginLeft: 4 },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        height: 52,
        paddingHorizontal: 16,
    },
    input: { flex: 1, fontSize: 16, height: "100%" },
    eyeBtn: { padding: 4 },
    saveBtn: {
        height: 52,
        borderRadius: BORDER_RADIUS.lg,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 12,
    },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
