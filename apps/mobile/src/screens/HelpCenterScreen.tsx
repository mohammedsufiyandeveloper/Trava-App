import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useResponsive } from "../hooks/useResponsive";
import { SPACING } from "../constants/theme";

type Props = NativeStackScreenProps<RootStackParamList, "HelpCenter">;

export default function HelpCenterScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: value(12, SPACING.xl, SPACING.xxl) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Help Center</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Content */}
            <View style={styles.body}>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="construct-outline" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
                    <Text style={[styles.question, { color: colors.text }]}>
                        What help you need..?
                    </Text>
                    <Text style={[styles.answer, { color: colors.textDim }]}>
                        Go finish the Courtyard first
                    </Text>
                </View>
            </View>
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
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 20,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
    },
    body: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    card: {
        width: "100%",
        alignItems: "center",
        padding: 32,
        borderRadius: 20,
        borderWidth: 1,
        gap: 4,
    },
    question: {
        fontSize: 22,
        fontWeight: "700",
        textAlign: "center",
        marginBottom: 12,
    },
    answer: {
        fontSize: 16,
        textAlign: "center",
        fontStyle: "italic",
        marginTop: 4,
    },
});
