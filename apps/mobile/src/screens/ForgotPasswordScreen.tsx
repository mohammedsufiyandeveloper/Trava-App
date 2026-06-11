import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { BORDER_RADIUS, SPACING } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { requestPasswordResetOtp, resetPasswordWithOtp } from "../services/api";
import { RootStackParamList } from "../types";
import { useResponsive } from "../hooks/useResponsive";

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

    const sendCode = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail || !normalizedEmail.includes("@")) {
            Alert.alert("Invalid Email", "Enter the email address used for your Trava account.");
            return;
        }

        setLoading(true);
        try {
            await requestPasswordResetOtp(normalizedEmail);
            setEmail(normalizedEmail);
            setCodeSent(true);
            Alert.alert("Code Sent", "Check your email for the password reset code.");
        } catch (error: any) {
            Alert.alert("Could Not Send Code", error.message || "Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async () => {
        if (otp.trim().length < 4) {
            Alert.alert("Invalid Code", "Enter the complete code from your email.");
            return;
        }
        if (password.length < 8) {
            Alert.alert("Weak Password", "Your new password must contain at least 8 characters.");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Passwords Do Not Match", "Re-enter the same password in both fields.");
            return;
        }

        setLoading(true);
        try {
            await resetPasswordWithOtp(email, otp.trim(), password);
            Alert.alert("Password Updated", "You can now sign in with your new password.", [
                { text: "Sign In", onPress: () => navigation.replace("SignIn") },
            ]);
        } catch (error: any) {
            Alert.alert("Reset Failed", error.message || "The code may be invalid or expired.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar
                barStyle={isDark ? "light-content" : "dark-content"}
                backgroundColor={colors.background}
            />
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
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Back to sign in"
                            onPress={() => navigation.goBack()}
                            style={[styles.backButton, { borderColor: colors.border }]}
                        >
                            <Ionicons name="arrow-back" size={18} color={colors.text} />
                            <Text style={[styles.backText, { color: colors.text }]}>Sign In</Text>
                        </TouchableOpacity>

                        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={[styles.icon, { backgroundColor: `${colors.primary}18` }]}>
                                <Ionicons name="key-outline" size={26} color={colors.primary} />
                            </View>
                            <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
                            <Text style={[styles.description, { color: colors.textDim }]}>
                                {codeSent
                                    ? `Enter the code sent to ${email} and choose a new password.`
                                    : "Enter your account email and we will send you a secure reset code."}
                            </Text>

                            <Text style={[styles.label, { color: colors.textMuted }]}>Email Address</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={email}
                                onChangeText={setEmail}
                                editable={!codeSent && !loading}
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
                                        onChangeText={setOtp}
                                        keyboardType="number-pad"
                                        autoComplete="one-time-code"
                                        maxLength={8}
                                        placeholder="Enter code"
                                        placeholderTextColor={colors.textDim}
                                    />

                                    <Text style={[styles.label, { color: colors.textMuted }]}>New Password</Text>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                        autoCapitalize="none"
                                        placeholder="At least 8 characters"
                                        placeholderTextColor={colors.textDim}
                                    />

                                    <Text style={[styles.label, { color: colors.textMuted }]}>Confirm Password</Text>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                        autoCapitalize="none"
                                        placeholder="Repeat new password"
                                        placeholderTextColor={colors.textDim}
                                    />
                                </>
                            )}

                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: colors.primary }, loading && styles.disabled]}
                                onPress={codeSent ? resetPassword : sendCode}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.primaryText}>
                                        {codeSent ? "Update Password" : "Send Reset Code"}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {codeSent && (
                                <View style={styles.actions}>
                                    <TouchableOpacity onPress={sendCode} disabled={loading}>
                                        <Text style={[styles.actionText, { color: colors.primary }]}>Resend code</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setCodeSent(false);
                                            setOtp("");
                                            setPassword("");
                                            setConfirmPassword("");
                                        }}
                                        disabled={loading}
                                    >
                                        <Text style={[styles.actionText, { color: colors.textDim }]}>Change email</Text>
                                    </TouchableOpacity>
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
        paddingVertical: 8,
        marginBottom: SPACING.lg,
    },
    backText: { fontSize: 14, fontWeight: "600" },
    card: { width: "100%", borderWidth: 1, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg },
    icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 18 },
    title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
    description: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
    label: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 15,
        marginBottom: 18,
    },
    primaryButton: { minHeight: 48, borderRadius: BORDER_RADIUS.md, alignItems: "center", justifyContent: "center", marginTop: 4 },
    primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    disabled: { opacity: 0.55 },
    actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
    actionText: { fontSize: 13, fontWeight: "600" },
});
