import React, { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { BORDER_RADIUS, SPACING, TOUCH_TARGET, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { requestPasswordResetOtp, resetPasswordWithOtp } from "../services/api";
import { RootStackParamList } from "../types";
import { useResponsive } from "../hooks/useResponsive";
import { isValidEmail } from "../utils/validation";
import AmbientBackground from "../components/AmbientBackground";
import AppButton from "../components/AppButton";
import PressableScale from "../components/PressableScale";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation, route }: Props) {
    const { colors, isDark } = useTheme();
    const { FORM_MAX_WIDTH, value } = useResponsive();
    const [email, setEmail] = useState(route.params?.email ?? "");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [codeSent, setCodeSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendCode = async () => {
        if (loading) return;
        setError(null);
        const normalizedEmail = email.trim().toLowerCase();
        if (!isValidEmail(normalizedEmail)) {
            setError("Enter the email address used for your Trava account.");
            return;
        }

        setLoading(true);
        try {
            await requestPasswordResetOtp(normalizedEmail);
            setEmail(normalizedEmail);
            setCodeSent(true);
        } catch (error: any) {
            setError(error.message || "Could not send the reset code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async () => {
        if (loading) return;
        setError(null);
        if (otp.trim().length < 4) {
            setError("Enter the complete code from your email.");
            return;
        }
        if (password.length < 8) {
            setError("Your new password must contain at least 8 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match. Re-enter the same password in both fields.");
            return;
        }

        setLoading(true);
        try {
            await resetPasswordWithOtp(email, otp.trim(), password);
            Alert.alert("Password Updated", "You can now sign in with your new password.", [
                { text: "Sign In", onPress: () => navigation.replace("SignIn") },
            ]);
        } catch (error: any) {
            setError(error.message || "The code may be invalid or expired.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar
                barStyle={isDark ? "light-content" : "dark-content"}
                translucent
                backgroundColor="transparent"
            />
            <AmbientBackground />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scroll,
                        { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) },
                    ]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.content, { maxWidth: FORM_MAX_WIDTH }]}>
                        <PressableScale
                            haptic="light"
                            accessibilityRole="button"
                            accessibilityLabel="Back to sign in"
                            onPress={() => navigation.goBack()}
                            style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.surfaceSolid }]}
                        >
                            <Ionicons name="arrow-back" size={18} color={colors.text} />
                            <Text style={[styles.backText, { color: colors.text }]}>Sign In</Text>
                        </PressableScale>

                        <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
                            <View style={[styles.icon, { backgroundColor: `${colors.primary}18` }]}>
                                <Ionicons name="key-outline" size={26} color={colors.primary} />
                            </View>
                            <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
                            <Text style={[styles.description, { color: colors.textDim }]}>
                                {codeSent
                                    ? `Enter the code sent to ${email} and choose a new password.`
                                    : "Enter your account email and we will send you a secure reset code."}
                            </Text>

                            {error && (
                                <View
                                    accessibilityRole="alert"
                                    style={[styles.errorBanner, { backgroundColor: isDark ? "rgba(248,113,113,0.12)" : "rgba(220,38,38,0.08)", borderColor: colors.validationError }]}
                                >
                                    <Ionicons name="alert-circle" size={16} color={colors.validationError} />
                                    <Text style={[styles.errorBannerText, { color: colors.validationError }]}>{error}</Text>
                                </View>
                            )}

                            <Text style={[styles.label, { color: colors.textMuted }]}>Email Address</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={email}
                                onChangeText={(t) => { setEmail(t); setError(null); }}
                                editable={!codeSent && !loading}
                                accessibilityLabel="Email address"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                placeholder="your@email.com"
                                placeholderTextColor={colors.textDim}
                            />

                            {codeSent && (
                                <>
                                    <Text style={[styles.label, { color: colors.textMuted }]}>Reset Code</Text>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                        value={otp}
                                        onChangeText={(t) => { setOtp(t); setError(null); }}
                                        keyboardType="number-pad"
                                        autoComplete="one-time-code"
                                        maxLength={8}
                                        placeholder="Enter code"
                                        placeholderTextColor={colors.textDim}
                                        accessibilityLabel="Reset code"
                                    />

                                    <Text style={[styles.label, { color: colors.textMuted }]}>New Password</Text>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                        value={password}
                                        onChangeText={(t) => { setPassword(t); setError(null); }}
                                        secureTextEntry
                                        autoCapitalize="none"
                                        placeholder="At least 8 characters"
                                        placeholderTextColor={colors.textDim}
                                        accessibilityLabel="New password"
                                    />

                                    <Text style={[styles.label, { color: colors.textMuted }]}>Confirm Password</Text>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                        value={confirmPassword}
                                        onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
                                        secureTextEntry
                                        autoCapitalize="none"
                                        placeholder="Repeat new password"
                                        placeholderTextColor={colors.textDim}
                                        accessibilityLabel="Confirm new password"
                                    />
                                </>
                            )}

                            <AppButton
                                label={codeSent ? "Update Password" : "Send Reset Code"}
                                onPress={codeSent ? resetPassword : sendCode}
                                loading={loading}
                                fullWidth
                                size="lg"
                                haptic="medium"
                                style={styles.primaryButton}
                            />

                            {codeSent && (
                                <View style={styles.actions}>
                                    <PressableScale haptic="light" onPress={sendCode} disabled={loading} accessibilityRole="button" accessibilityLabel="Resend code">
                                        <Text style={[styles.actionText, { color: colors.primary }]}>Resend code</Text>
                                    </PressableScale>
                                    <PressableScale
                                        haptic="light"
                                        accessibilityRole="button"
                                        accessibilityLabel="Change email"
                                        onPress={() => {
                                            setCodeSent(false);
                                            setOtp("");
                                            setPassword("");
                                            setConfirmPassword("");
                                            setError(null);
                                        }}
                                        disabled={loading}
                                    >
                                        <Text style={[styles.actionText, { color: colors.textDim }]}>Change email</Text>
                                    </PressableScale>
                                </View>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: SPACING.xl },
    content: { width: "100%" },
    backButton: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: 12,
        minHeight: TOUCH_TARGET.min,
        marginBottom: SPACING.lg,
    },
    errorBanner: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.sm,
        marginBottom: 16,
    },
    errorBannerText: { flex: 1, fontSize: 13, fontFamily: FONTS.semibold, lineHeight: 18 },
    backText: { fontSize: 14, fontFamily: FONTS.semibold },
    card: { width: "100%", borderWidth: 1, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg },
    icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    title: { fontSize: 24, fontFamily: FONTS.bold, marginBottom: 8 },
    description: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
    label: { fontSize: 13, fontFamily: FONTS.semibold, marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 15,
        marginBottom: 18,
    },
    primaryButton: { marginTop: 4 },
    actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
    actionText: { fontSize: 13, fontFamily: FONTS.semibold },
});
