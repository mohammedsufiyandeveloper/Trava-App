import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { signIn } from "../services/api";
import { RootStackParamList } from "../types";
import { useResponsive } from "../hooks/useResponsive";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export default function SignInScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { FORM_MAX_WIDTH, value } = useResponsive();
    
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSignIn() {
        if (!email || !password) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }
        setLoading(true);
        try {
            await signIn(email.trim(), password);
            navigation.reset({
                index: 0,
                routes: [{ name: "Main" }],
            });
        } catch (err: any) {
            Alert.alert("Sign In Failed", err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scroll, 
                        { 
                            backgroundColor: colors.background,
                            paddingHorizontal: value(SPACING.lg * 1.1, SPACING.xl, SPACING.xxl)
                        }
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.contentWrapper, { maxWidth: FORM_MAX_WIDTH }]}>
                        {/* Logo/Branding */}
                        <View style={styles.logoRow}>
                            <Text style={[styles.logoText, { color: colors.primary }]}>TRAVA</Text>
                        </View>

                        {/* Login Card */}
                        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Welcome back!</Text>
                            <Text style={[styles.cardDesc, { color: colors.textDim }]}>Log in to manage your workspaces</Text>

                            {/* Email Input */}
                            <Text style={[styles.label, { color: colors.textMuted }]}>Email Address</Text>
                            <TextInput
                                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                                placeholder="your@email.com"
                                placeholderTextColor={colors.textDim}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={email}
                                onChangeText={setEmail}
                            />

                            {/* Password Input */}
                            <View style={styles.labelRow}>
                                <Text style={[styles.label, { color: colors.textMuted }]}>Password</Text>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Reset password"
                                    onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() })}
                                >
                                    <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot?</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.passwordWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                                <TextInput
                                    style={[styles.passwordInput, { color: colors.text }]}
                                    placeholder="••••••••"
                                    placeholderTextColor={colors.textDim}
                                    secureTextEntry={!showPwd}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={styles.eyeBtn}>
                                    <Text style={styles.eyeText}>{showPwd ? "🙈" : "👁"}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                style={[styles.primaryBtn, { backgroundColor: colors.primary }, (!email || !password || loading) && styles.disabled]}
                                onPress={handleSignIn}
                                disabled={!email || !password || loading}
                                activeOpacity={0.85}
                            >
                                {loading
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={styles.primaryText}>Sign In</Text>
                                }
                            </TouchableOpacity>

                            {/* Footer */}
                            <View style={styles.footerRow}>
                                <Text style={[styles.footerText, { color: colors.textDim }]}>New here? </Text>
                                <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
                                    <Text style={[styles.footerLink, { color: colors.text }]}>Create Account</Text>
                                </TouchableOpacity>
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
    backBtn: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 7,
        marginBottom: 32,
    },
    backText: {
        fontSize: 14,
        fontWeight: "500"
    },
    logoRow: {
        marginBottom: 24,
        alignItems: "center"
    },
    logoText: {
        fontSize: 15,
        fontWeight: "800",
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
        fontWeight: "700",
        marginBottom: 6
    },
    cardDesc: {
        fontSize: 14,
        marginBottom: 24
    },
    label: {
        fontSize: 13,
        marginBottom: 8,
        fontWeight: "600"
    },
    labelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8
    },
    forgotText: {
        fontSize: 13,
        fontWeight: "600"
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
        marginBottom: 24
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 15
    },
    eyeBtn: {
        paddingHorizontal: 12
    },
    eyeText: {
        fontSize: 16
    },
    primaryBtn: {
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: "center",
        marginBottom: 20
    },
    disabled: {
        opacity: 0.5
    },
    primaryText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16
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
        fontWeight: "700",
        textDecorationLine: "underline"
    },
    terms: {
        fontSize: 12,
        textAlign: "center",
        marginTop: 20
    },
});
