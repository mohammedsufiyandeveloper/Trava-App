import React from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { RootStackParamList } from "../types";
import { useResponsive } from "../hooks/useResponsive";

type Props = NativeStackScreenProps<RootStackParamList, "Landing">;

export default function LandingScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { FORM_MAX_WIDTH, value } = useResponsive();
    
    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
            <View style={[styles.container, { backgroundColor: colors.background, paddingHorizontal: value(SPACING.lg * 1.2, SPACING.xl, SPACING.xxl) }]}>
                
                <View style={[styles.contentWrapper, { maxWidth: FORM_MAX_WIDTH }]}>
                    {/* Badge */}
                    <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <Text style={[styles.badgeText, { color: colors.textMuted }]}>Welcome to Trava Management</Text>
                    </View>

                    {/* Headline */}
                    <Text style={[styles.title, { color: colors.text }]}>Elevate your Experience</Text>

                    {/* Subtitle */}
                    <Text style={[styles.subtitle, { color: colors.textDim }]}>
                        Discover a world of knowledge with our interactive learning platform.
                        Explore courses, track your progress, and achieve your goals with ease.
                    </Text>

                    {/* Primary CTA */}
                    <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate("SignUp")}
                    >
                        <Text style={styles.primaryText}>Explore Workspace</Text>
                    </TouchableOpacity>

                    {/* Secondary CTA */}
                    <TouchableOpacity
                        style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate("SignIn")}
                    >
                        <Text style={[styles.secondaryText, { color: colors.text }]}>Log In</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
    },
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 40,
    },
    contentWrapper: {
        width: "100%",
        alignItems: "center",
    },
    badge: {
        borderWidth: 1,
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 14,
        paddingVertical: 5,
        marginBottom: 28,
    },
    badgeText: {
        fontSize: 12,
        letterSpacing: 0.3,
    },
    title: {
        fontSize: 34,
        fontWeight: "700",
        textAlign: "center",
        letterSpacing: -0.5,
        lineHeight: 42,
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 15,
        textAlign: "center",
        lineHeight: 24,
        maxWidth: 320,
        marginBottom: 40,
    },
    primaryBtn: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: BORDER_RADIUS.md,
        width: "100%",
        alignItems: "center",
        marginBottom: 12,
    },
    primaryText: {
        color: "#ffffff",
        fontWeight: "600",
        fontSize: 16,
        letterSpacing: 0.2,
    },
    secondaryBtn: {
        borderWidth: 1,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: BORDER_RADIUS.md,
        width: "100%",
        alignItems: "center",
    },
    secondaryText: {
        fontWeight: "500",
        fontSize: 16,
    },
});
