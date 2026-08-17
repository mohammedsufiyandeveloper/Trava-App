import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useResponsive } from "../hooks/useResponsive";
import { SPACING, FONTS } from "../constants/theme";
import AppCard from "../components/AppCard";
import PressableScale from "../components/PressableScale";

type Props = NativeStackScreenProps<RootStackParamList, "HelpCenter">;

export default function HelpCenterScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surfaceSolid, paddingHorizontal: value(12, SPACING.xl, SPACING.xxl) }]}>
                <PressableScale
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    haptic="light"
                    accessibilityLabel="Go back"
                    accessibilityRole="button"
                >
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </PressableScale>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Help Center</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Content */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[styles.body, { paddingHorizontal: value(16, SPACING.xl, SPACING.xxl) }]}
                showsVerticalScrollIndicator={false}
            >
                <AppCard style={styles.card}>
                    <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
                        <Ionicons name="construct-outline" size={32} color={colors.primary} />
                    </View>
                    <Text style={[styles.question, { color: colors.text }]}>
                        What do you need help with?
                    </Text>
                    <Text style={[styles.answer, { color: colors.textDim }]}>
                        We're still building out the Help Center. In the meantime, reach out to your workspace admin for support.
                    </Text>
                </AppCard>
            </ScrollView>
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
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backBtn: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 22,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: FONTS.bold,
    },
    body: {
        flexGrow: 1,
        justifyContent: "center",
        paddingVertical: 24,
    },
    card: {
        width: "100%",
        alignItems: "center",
        padding: 32,
        gap: 4,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    question: {
        fontSize: 20,
        fontFamily: FONTS.bold,
        textAlign: "center",
        marginBottom: 8,
    },
    answer: {
        fontSize: 15,
        textAlign: "center",
        lineHeight: 22,
        marginTop: 4,
    },
});
