import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
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
import { SPACING, BORDER_RADIUS, TOUCH_TARGET, FONTS } from "../constants/theme";
import { useResponsive } from "../hooks/useResponsive";
import PressableScale from "../components/PressableScale";
import AppButton from "../components/AppButton";

type Props = NativeStackScreenProps<RootStackParamList, "ChangePassword">;

export default function ChangePasswordScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleChangePassword = async () => {
        if (loading) return;
        setError(null);
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError("Please fill in all fields.");
            return;
        }

        if (newPassword.length < 8) {
            setError("New password must be at least 8 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            Alert.alert("Success", "Password changed successfully", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        } catch (err: any) {
            setError(err.message || "Failed to change password.");
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
                <PressableScale haptic="light" onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </PressableScale>
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
                        {error && (
                            <View
                                accessibilityRole="alert"
                                style={[styles.errorBanner, { backgroundColor: isDark ? "rgba(248,113,113,0.12)" : "rgba(220,38,38,0.08)", borderColor: colors.validationError }]}
                            >
                                <Ionicons name="alert-circle" size={16} color={colors.validationError} />
                                <Text style={[styles.errorBannerText, { color: colors.validationError }]}>{error}</Text>
                            </View>
                        )}

                        {/* Current Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textDim }]}>CURRENT PASSWORD</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={currentPassword}
                                    onChangeText={(t) => { setCurrentPassword(t); setError(null); }}
                                    secureTextEntry={!showCurrent}
                                    placeholder="Enter current password"
                                    placeholderTextColor={colors.textDim + "80"}
                                    autoComplete="password"
                                    textContentType="password"
                                    accessibilityLabel="Current password"
                                />
                                <PressableScale haptic="selection" onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeBtn} accessibilityRole="button" accessibilityLabel={showCurrent ? "Hide password" : "Show password"}>
                                    <Ionicons name={showCurrent ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textDim} />
                                </PressableScale>
                            </View>
                        </View>

                        {/* New Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textDim }]}>NEW PASSWORD</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={newPassword}
                                    onChangeText={(t) => { setNewPassword(t); setError(null); }}
                                    secureTextEntry={!showNew}
                                    placeholder="Min 8 characters"
                                    placeholderTextColor={colors.textDim + "80"}
                                    autoComplete="password-new"
                                    textContentType="newPassword"
                                    accessibilityLabel="New password"
                                />
                                <PressableScale haptic="selection" onPress={() => setShowNew(!showNew)} style={styles.eyeBtn} accessibilityRole="button" accessibilityLabel={showNew ? "Hide password" : "Show password"}>
                                    <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textDim} />
                                </PressableScale>
                            </View>
                        </View>

                        {/* Confirm Password */}
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textDim }]}>CONFIRM NEW PASSWORD</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={confirmPassword}
                                    onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
                                    secureTextEntry={!showConfirm}
                                    placeholder="Repeat new password"
                                    placeholderTextColor={colors.textDim + "80"}
                                    autoComplete="password-new"
                                    textContentType="newPassword"
                                    accessibilityLabel="Confirm new password"
                                />
                                <PressableScale haptic="selection" onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn} accessibilityRole="button" accessibilityLabel={showConfirm ? "Hide password" : "Show password"}>
                                    <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textDim} />
                                </PressableScale>
                            </View>
                        </View>

                        <AppButton
                            label="Update Password"
                            onPress={handleChangePassword}
                            loading={loading}
                            fullWidth
                            size="lg"
                            haptic="medium"
                            style={styles.saveBtn}
                        />
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
    backBtn: { width: TOUCH_TARGET.min, height: TOUCH_TARGET.min, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 18, fontFamily: FONTS.bold },
    scrollContent: { padding: 24 },
    infoBox: { alignItems: "center", marginBottom: 32 },
    infoTitle: { fontSize: 20, fontFamily: FONTS.bold, marginTop: 16, marginBottom: 8 },
    infoText: { fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
    form: { gap: 20 },
    errorBanner: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.sm,
    },
    errorBannerText: { flex: 1, fontSize: 13, fontFamily: FONTS.semibold, lineHeight: 18 },
    inputGroup: { gap: 8 },
    label: { fontSize: 11, fontFamily: FONTS.bold, letterSpacing: 1, marginLeft: 4 },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        height: 52,
        paddingHorizontal: 16,
    },
    input: { flex: 1, fontSize: 16, height: "100%" },
    eyeBtn: { minWidth: TOUCH_TARGET.min, minHeight: TOUCH_TARGET.min, alignItems: "center", justifyContent: "center" },
    saveBtn: {
        marginTop: 12,
    },
});
