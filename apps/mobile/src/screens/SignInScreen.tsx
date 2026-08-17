import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { signIn } from "../services/api";
import { RootStackParamList } from "../types";
import { useResponsive } from "../hooks/useResponsive";
import AmbientBackground from "../components/AmbientBackground";
import AppButton from "../components/AppButton";
import PressableScale from "../components/PressableScale";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export default function SignInScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { FORM_MAX_WIDTH, value } = useResponsive();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    async function handleSignIn() {
        if (loading) return;
        setFormError(null);
        if (!email.trim() || !password) {
            setFieldError("Please enter your email and password.");
            return;
        }
        setFieldError(null);
        setLoading(true);
        try {
            await signIn(email.trim(), password);
            navigation.reset({
                index: 0,
                routes: [{ name: "Main" }],
            });
        } catch (err: any) {
            setFormError(err?.message || "We couldn't sign you in. Check your credentials and try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={styles.safe} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <AmbientBackground />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scroll,
                        { paddingHorizontal: value(SPACING.lg * 1.1, SPACING.xl, SPACING.xxl) }
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.contentWrapper, { maxWidth: FORM_MAX_WIDTH }]}>
                        {/* Logo/Branding */}
                        <View style={styles.logoRow}>
                            <Text style={[styles.logoText, { color: colors.primary }]}>TRAVA</Text>
                        </View>

                        {/* Login Card — solid surface: forms stay fully readable, no glass. */}
                        <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Welcome back!</Text>
                            <Text style={[styles.cardDesc, { color: colors.textDim }]}>Log in to manage your workspaces</Text>

                            {formError && (
                                <View
                                    accessibilityRole="alert"
                                    style={[styles.errorBanner, { backgroundColor: isDark ? "rgba(248,113,113,0.12)" : "rgba(220,38,38,0.08)", borderColor: colors.validationError }]}
                                >
                                    <Ionicons name="alert-circle" size={16} color={colors.validationError} />
                                    <Text style={[styles.errorBannerText, { color: colors.validationError }]}>{formError}</Text>
                                </View>
                            )}

                            {/* Email Input */}
                            <Text style={[styles.label, { color: colors.textMuted }]}>Email Address</Text>
                            <TextInput
                                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                                placeholder="your@email.com"
                                placeholderTextColor={colors.textDim}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="email"
                                textContentType="emailAddress"
                                value={email}
                                onChangeText={(t) => { setEmail(t); setFieldError(null); }}
                                accessibilityLabel="Email address"
                            />

                            {/* Password Input */}
                            <View style={styles.labelRow}>
                                <Text style={[styles.label, { color: colors.textMuted }]}>Password</Text>
                                <PressableScale
                                    haptic="light"
                                    accessibilityRole="button"
                                    accessibilityLabel="Reset password"
                                    onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() })}
                                    style={styles.forgotBtn}
                                >
                                    <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot?</Text>
                                </PressableScale>
                            </View>
                            <View style={[styles.passwordWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                                <TextInput
                                    style={[styles.passwordInput, { color: colors.text }]}
                                    placeholder="••••••••"
                                    placeholderTextColor={colors.textDim}
                                    secureTextEntry={!showPwd}
                                    autoComplete="password"
                                    textContentType="password"
                                    value={password}
                                    onChangeText={(t) => { setPassword(t); setFieldError(null); }}
                                    accessibilityLabel="Password"
                                />
                                <PressableScale
                                    haptic="selection"
                                    onPress={() => setShowPwd(v => !v)}
                                    style={styles.eyeBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel={showPwd ? "Hide password" : "Show password"}
                                >
                                    <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color={colors.iconMuted} />
                                </PressableScale>
                            </View>

                            {fieldError && (
                                <Text style={[styles.fieldErrorText, { color: colors.validationError }]}>{fieldError}</Text>
                            )}

                            {/* Submit Button */}
                            <AppButton
                                label="Sign In"
                                onPress={handleSignIn}
                                loading={loading}
                                fullWidth
                                size="lg"
                                haptic="medium"
                                style={styles.primaryBtn}
                            />

                            {/* Footer */}
                            <View style={styles.footerRow}>
                                <Text style={[styles.footerText, { color: colors.textDim }]}>New here? </Text>
                                <PressableScale haptic="light" onPress={() => navigation.navigate("SignUp")}>
                                    <Text style={[styles.footerLink, { color: colors.text }]}>Create Account</Text>
                                </PressableScale>
                            </View>
                        </View>

                        <Text style={[styles.terms, { color: colors.textDim }]}>
                            Securely logged in by Better Auth.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
    },
    scroll: {
        flexGrow: 1,
        paddingVertical: SPACING.xl,
        alignItems: "center",
        justifyContent: "center",
    },
    contentWrapper: {
        width: "100%",
        alignItems: "center",
    },
    logoRow: {
        marginBottom: 24,
        alignItems: "center"
    },
    logoText: {
        fontSize: 15,
        fontFamily: FONTS.extrabold,
        letterSpacing: 2
    },
    card: {
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        padding: SPACING.lg,
        width: "100%",
        marginBottom: 20
    },
    cardTitle: {
        fontSize: 22,
        fontFamily: FONTS.bold,
        marginBottom: 6
    },
    cardDesc: {
        fontSize: 14,
        marginBottom: 24
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
    errorBannerText: {
        flex: 1,
        fontSize: 13,
        fontFamily: FONTS.semibold,
        lineHeight: 18,
    },
    fieldErrorText: {
        fontSize: 13,
        fontFamily: FONTS.semibold,
        marginBottom: 16,
        marginTop: -12,
    },
    label: {
        fontSize: 13,
        marginBottom: 8,
        fontFamily: FONTS.semibold
    },
    labelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8
    },
    forgotBtn: {
        minHeight: TOUCH_TARGET.min,
        justifyContent: "center",
    },
    forgotText: {
        fontSize: 13,
        fontFamily: FONTS.semibold
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 15,
        marginBottom: 20
    },
    passwordWrapper: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 12
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 15
    },
    eyeBtn: {
        paddingHorizontal: 12,
        minWidth: TOUCH_TARGET.min,
        minHeight: TOUCH_TARGET.min,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryBtn: {
        marginTop: 8,
        marginBottom: 20
    },
    footerRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 8
    },
    footerText: {
        fontSize: 14
    },
    footerLink: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        textDecorationLine: "underline"
    },
    terms: {
        fontSize: 12,
        textAlign: "center",
        marginTop: 20
    },
});
