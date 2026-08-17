import React from "react";
import { View, Text, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SPACING, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { RootStackParamList } from "../types";
import { useResponsive } from "../hooks/useResponsive";
import AmbientBackground from "../components/AmbientBackground";
import GlassSurface from "../components/GlassSurface";
import AppButton from "../components/AppButton";

type Props = NativeStackScreenProps<RootStackParamList, "Landing">;

export default function LandingScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { FORM_MAX_WIDTH, value } = useResponsive();

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <AmbientBackground decoration />
            <View style={[styles.container, { paddingHorizontal: value(SPACING.lg * 1.2, SPACING.xl, SPACING.xxl) }]}>

                <View style={[styles.contentWrapper, { maxWidth: FORM_MAX_WIDTH }]}>
                    {/* Badge */}
                    <GlassSurface level="surface" radius="full" elevation="none" style={styles.badge}>
                        <Text style={[styles.badgeText, { color: colors.textMuted }]}>Welcome to Trava Management</Text>
                    </GlassSurface>

                    {/* Headline */}
                    <Text style={[styles.title, { color: colors.text }]}>Elevate your Experience</Text>

                    {/* Subtitle */}
                    <Text style={[styles.subtitle, { color: colors.textDim }]}>
                        Discover a world of knowledge with our interactive learning platform.
                        Explore courses, track your progress, and achieve your goals with ease.
                    </Text>

                    {/* Primary CTA */}
                    <AppButton
                        label="Explore Workspace"
                        onPress={() => navigation.navigate("SignUp")}
                        fullWidth
                        size="lg"
                        haptic="medium"
                        style={styles.primaryBtn}
                    />

                    {/* Secondary CTA */}
                    <AppButton
                        label="Log In"
                        variant="secondary"
                        onPress={() => navigation.navigate("SignIn")}
                        fullWidth
                        size="lg"
                        haptic="light"
                    />
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
        paddingHorizontal: 14,
        paddingVertical: 6,
        marginBottom: 28,
    },
    badgeText: {
        fontSize: 12,
        letterSpacing: 0.3,
    },
    title: {
        fontSize: 34,
        fontFamily: FONTS.bold,
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
        marginBottom: 12,
    },
});
