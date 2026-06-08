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
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { requestEmailOtp } from "../services/api";
import { RootStackParamList } from "../types";
import { useResponsive } from "../hooks/useResponsive";

type Props = NativeStackScreenProps<RootStackParamList, "SignUp">;

export default function SignUpScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { FORM_MAX_WIDTH, value } = useResponsive();
    
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleContinue() {
        if (!firstName || !lastName || !email) {
            Alert.alert("Error", "Please fill in all fields.");
            return;
        }
        setLoading(true);
        try {
            await requestEmailOtp(email.trim());
            Alert.alert(
                "Verify your email ✉️",
                `We've sent a verification link to ${email}. Please check your inbox and verify your email, then return to Sign In.`,
                [{ text: "Okay, go to Login", onPress: () => navigation.replace("SignIn") }]
            );
        } catch (err: any) {
            Alert.alert("Sign Up Error", err.message || "Could not start sign up process.");
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
                        {/* Back */}
                        <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={18} color={colors.text} style={{ marginRight: 6 }} />
                            <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
                        </TouchableOpacity>

                        {/* Branding */}
                        <View style={styles.logoRow}>
                            <Text style={[styles.logoText, { color: colors.primary }]}>TRAVA</Text>
                        </View>

                        {/* Sign Up Card */}
                        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>Create Account</Text>
                            <Text style={[styles.cardDesc, { color: colors.textDim }]}>Sign up with your work email</Text>

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
                                        onChangeText={setFirstName}
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
                                        onChangeText={setLastName}
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
                                value={email}
                                onChangeText={setEmail}
                            />

                            {/* Submit Button */}
                            <TouchableOpacity
                                style={[styles.primaryBtn, { backgroundColor: colors.primary }, (!firstName || !lastName || !email || loading) && styles.disabled]}
                                onPress={handleContinue}
                                disabled={!firstName || !lastName || !email || loading}
                                activeOpacity={0.85}
                            >
                                {loading
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={styles.primaryText}>Continue to Email Verify</Text>
                                }
                            </TouchableOpacity>

                            {/* Footer */}
                            <View style={styles.footerRow}>
                                <Text style={[styles.footerText, { color: colors.textDim }]}>Already have an account? </Text>
                                <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
                                    <Text style={[styles.footerLink, { color: colors.text }]}>Log In</Text>
                                </TouchableOpacity>
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
    backBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 32 },
    backText: { fontSize: 14, fontWeight: "500" },

    logoRow: { marginBottom: 24, alignItems: "center" },
    logoText: { fontSize: 15, fontWeight: "800", letterSpacing: 2 },

    card: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg, width: "100%", marginBottom: 20 },
    cardTitle: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
    cardDesc: { fontSize: 14, marginBottom: 24 },

    nameRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
    nameField: { flex: 1 },
    label: { fontSize: 13, marginBottom: 8, fontWeight: "600" },
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, marginBottom: 16 },
    inputFull: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, marginBottom: 24, width: "100%" },

    primaryBtn: { paddingVertical: 15, borderRadius: 8, alignItems: "center", marginBottom: 20 },
    disabled: { opacity: 0.5 },
    primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },

    footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
    footerText: { fontSize: 14 },
    footerLink: { fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },

    terms: { fontSize: 12, textAlign: "center", marginTop: 20 },
});
