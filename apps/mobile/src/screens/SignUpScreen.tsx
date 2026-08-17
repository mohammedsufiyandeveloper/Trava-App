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
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SPACING, BORDER_RADIUS, TOUCH_TARGET, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { requestEmailOtp } from "../services/api";
import { RootStackParamList } from "../types";
import { useResponsive } from "../hooks/useResponsive";
import { isValidEmail } from "../utils/validation";
import AmbientBackground from "../components/AmbientBackground";
import AppButton from "../components/AppButton";
import PressableScale from "../components/PressableScale";

type Props = NativeStackScreenProps<RootStackParamList, "SignUp">;

export default function SignUpScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { FORM_MAX_WIDTH, value } = useResponsive();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    async function handleContinue() {
        if (loading) return;
        setFormError(null);
        if (!firstName.trim() || !lastName.trim() || !email.trim()) {
            setFieldError("Please fill in all fields.");
            return;
        }
        if (!isValidEmail(email)) {
            setFieldError("Please enter a valid email address (e.g. name@company.com).");
            return;
        }
        setFieldError(null);
        setLoading(true);
        try {
            await requestEmailOtp(email.trim());
            Alert.alert(
                "Verify your email",
                `We've sent a verification link to ${email}. Please check your inbox and verify your email, then return to Sign In.`,
                [{ text: "Okay, go to Login", onPress: () => navigation.replace("SignIn") }]
            );
        } catch (err: any) {
            setFormError(err?.message || "Could not start sign up process.");
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
                        {/* Back */}
                        <PressableScale
                            haptic="light"
                            style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surfaceSolid }]}
                            onPress={() => navigation.goBack()}
                            accessibilityRole="button"
                            accessibilityLabel="Go back"
                        >
                            <Ionicons name="arrow-back" size={18} color={colors.text} style={{ marginRight: 6 }} />
                            <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
                        </PressableScale>

                        {/* Branding */}
                        <View style={styles.logoRow}>
                            <Text style={[styles.logoText, { color: colors.primary }]}>TRAVA</Text>
                        </View>

                        {/* Sign Up Card — solid surface for form readability */}
                        <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Create Account</Text>
                            <Text style={[styles.cardDesc, { color: colors.textDim }]}>Sign up with your work email</Text>

                            {formError && (
                                <View
                                    accessibilityRole="alert"
                                    style={[styles.errorBanner, { backgroundColor: isDark ? "rgba(248,113,113,0.12)" : "rgba(220,38,38,0.08)", borderColor: colors.validationError }]}
                                >
                                    <Ionicons name="alert-circle" size={16} color={colors.validationError} />
                                    <Text style={[styles.errorBannerText, { color: colors.validationError }]}>{formError}</Text>
                                </View>
                            )}

                            {/* Name Input Row */}
                            <View style={styles.nameRow}>
                                <View style={styles.nameField}>
                                    <Text style={[styles.label, { color: colors.textMuted }]}>First Name</Text>
                                    <TextInput
                                        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                                        placeholder="John"
                                        placeholderTextColor={colors.textDim}
                                        autoCapitalize="words"
                                        value={firstName}
                                        onChangeText={(t) => { setFirstName(t); setFieldError(null); }}
                                        accessibilityLabel="First name"
                                    />
                                </View>
                                <View style={styles.nameField}>
                                    <Text style={[styles.label, { color: colors.textMuted }]}>Last Name</Text>
                                    <TextInput
                                        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                                        placeholder="Doe"
                                        placeholderTextColor={colors.textDim}
                                        autoCapitalize="words"
                                        value={lastName}
                                        onChangeText={(t) => { setLastName(t); setFieldError(null); }}
                                        accessibilityLabel="Last name"
                                    />
                                </View>
                            </View>

                            {/* Email Input */}
                            <Text style={[styles.label, { color: colors.textMuted }]}>Email Address</Text>
                            <TextInput
                                style={[styles.inputFull, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
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

                            {fieldError && (
                                <Text style={[styles.fieldErrorText, { color: colors.validationError }]}>{fieldError}</Text>
                            )}

                            {/* Submit Button */}
                            <AppButton
                                label="Continue to Email Verify"
                                onPress={handleContinue}
                                loading={loading}
                                fullWidth
                                size="lg"
                                haptic="medium"
                                style={styles.primaryBtn}
                            />

                            {/* Footer */}
                            <View style={styles.footerRow}>
                                <Text style={[styles.footerText, { color: colors.textDim }]}>Already have an account? </Text>
                                <PressableScale haptic="light" onPress={() => navigation.navigate("SignIn")}>
                                    <Text style={[styles.footerLink, { color: colors.text }]}>Log In</Text>
                                </PressableScale>
                            </View>
                        </View>

                        <Text style={[styles.terms, { color: colors.textDim }]}>
                            Professional task management on the go.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
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
    backBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, minHeight: TOUCH_TARGET.min, marginBottom: 32 },
    backText: { fontSize: 14, fontFamily: FONTS.medium },

    logoRow: { marginBottom: 24, alignItems: "center" },
    logoText: { fontSize: 15, fontFamily: FONTS.extrabold, letterSpacing: 2 },

    card: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg, width: "100%", marginBottom: 20 },
    cardTitle: { fontSize: 22, fontFamily: FONTS.bold, marginBottom: 6 },
    cardDesc: { fontSize: 14, marginBottom: 24 },

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
    fieldErrorText: { fontSize: 13, fontFamily: FONTS.semibold, marginBottom: 16, marginTop: -8 },

    nameRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
    nameField: { flex: 1 },
    label: { fontSize: 13, marginBottom: 8, fontFamily: FONTS.semibold },
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, marginBottom: 16 },
    inputFull: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, marginBottom: 24, width: "100%" },

    primaryBtn: { marginBottom: 20 },

    footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
    footerText: { fontSize: 14 },
    footerLink: { fontSize: 14, fontFamily: FONTS.bold, textDecorationLine: "underline" },

    terms: { fontSize: 12, textAlign: "center", marginTop: 20 },
});
