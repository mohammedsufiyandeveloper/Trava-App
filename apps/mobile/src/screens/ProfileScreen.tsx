import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useNotifications } from "../context/NotificationContext";
import { getCachedSession, signOut, getSession, getProfile } from "../services/api";
import { MainTabParamList, User } from "../types";
import { useResponsive } from "../hooks/useResponsive";

type Props = BottomTabScreenProps<MainTabParamList, "Profile">;

interface MenuItemProps {
    icon: {
        name: keyof typeof Ionicons.glyphMap;
        color?: string;
        bg?: string;
    };
    label: string;
    onPress?: () => void;
    color?: string;
    isLast?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onPress, color, isLast = false }) => {
    const { colors } = useTheme();
    const itemColor = color || colors.text;

    return (
        <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: colors.border }, isLast && { borderBottomWidth: 0 }]}
            onPress={onPress}
            activeOpacity={0.7}
            disabled={!onPress}
        >
            <View style={styles.menuLeft}>
                <View style={[styles.iconBox, { backgroundColor: icon.bg || colors.surface }]}>
                    <Ionicons name={icon.name} size={18} color={icon.color || colors.text} />
                </View>
                <Text style={[styles.menuLabel, { color: itemColor }]}>{label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
        </TouchableOpacity>
    );
};

export default function ProfileScreen({ navigation }: Props) {
    const [user, setUser] = useState<User | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const { colors, isDark, toggleTheme } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const fetchUser = async (fromServer = false) => {
        setRefreshing(true);
        const session = fromServer ? await getSession() : await getCachedSession();
        if (session?.user) {
            setUser(session.user);
        }
        // Fetch profile to get the actual surname from DB (Better Auth session
        // only returns the standard 'name' field, not our custom 'surname').
        try {
            const prof = await getProfile();
            if (prof?.success && prof.user) {
                const displayName = prof.user.surname || prof.user.name;
                setUser(prev =>
                    prev
                        ? { ...prev, name: displayName }
                        : ({ name: displayName, email: prof.user.email } as any)
                );
            }
        } catch (_) {}
        setRefreshing(false);
    };

    useFocusEffect(
        useCallback(() => {
            fetchUser(true);
        }, [])
    );

    const handleSignOut = async () => {
        await signOut();
        (navigation.getParent() as any)?.replace("SignIn");
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(0, SPACING.xl, SPACING.xxl) }]}
                >
                    {/* Profile Header */}
                <TouchableOpacity
                    style={styles.profileHeader}
                    onPress={() => (navigation as any)?.navigate("MyProfile")}
                    activeOpacity={0.7}
                >
                    <View style={[styles.avatarLarge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.avatarTextLarge}>
                            {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={{ alignItems: "center" }}>
                        <View style={{ alignItems: "center" }}>
                            <Text style={[styles.userNameLarge, { color: colors.text }]}>{user?.name}</Text>
                            <Text style={[styles.userEmailLarge, { color: colors.textDim }]}>{user?.email}</Text>
                        </View>
                        {user?.phoneNumber && (
                            <Text style={[styles.userEmailLarge, { color: colors.textDim, marginTop: 2 }]}>
                                {user.phoneNumber}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Account Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.textDim }]}>ACCOUNT</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MenuItem
                            icon={{ name: "person-outline", color: "#3b82f6", bg: "#3b82f615" }}
                            label="My Profile"
                            onPress={() => (navigation as any)?.navigate("MyProfile")}
                        />
                        <MenuItem
                            icon={{ name: "notifications-outline", color: "#f59e0b", bg: "#f59e0b15" }}
                            label="Notifications"
                            onPress={() => (navigation as any)?.navigate("Notifications")}
                            isLast
                        />
                    </View>
                </View>

                {/* Preferences */}
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.textDim }]}>PREFERENCES</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MenuItem
                            icon={{ name: isDark ? "sunny-outline" : "moon-outline", color: "#8b5cf6", bg: "#8b5cf615" }}
                            label={`Appearance: ${isDark ? "Dark" : "Light"}`}
                            onPress={toggleTheme}
                            isLast
                        />
                    </View>
                </View>

                {/* Workspace Settings */}
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.textDim }]}>WORKSPACE</Text>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MenuItem
                            icon={{ name: "people-outline", color: "#8b5cf6", bg: "#8b5cf615" }}
                            label="Teams"
                            onPress={() => (navigation as any)?.navigate("TeamList")}
                        />
                        <MenuItem
                            icon={{ name: "pricetags-outline", color: "#f59e0b", bg: "#f59e0b15" }}
                            label="Manage Task Tags"
                            onPress={() => (navigation as any)?.navigate("ManageTags")}
                        />
                        {/* Admin Only Sections */}
                        {(user as any)?.role === "ADMIN" || (user as any)?.role === "OWNER" ? (
                            <>
                                <MenuItem
                                    icon={{ name: "settings-outline", color: "#3b82f6", bg: "#3b82f615" }}
                                    label="Workspace Settings"
                                    onPress={() => (navigation as any)?.navigate("WorkspaceSettings")}
                                />
                                <MenuItem
                                    icon={{ name: "calendar-outline", color: "#10b981", bg: "#10b98115" }}
                                    label="Review Team Leaves"
                                    onPress={() => (navigation as any)?.navigate("AdminLeave")}
                                    isLast
                                />
                            </>
                        ) : null}
                    </View>
                </View>

                {/* Actions */}
                <View style={[styles.section, { marginBottom: SPACING.xxl }]}>
                    <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <MenuItem
                            icon={{ name: "log-out-outline", color: colors.error, bg: colors.error + "15" }}
                            label="Sign Out"
                            color={colors.error}
                            onPress={handleSignOut}
                            isLast
                        />
                    </View>
                    <Text style={[styles.versionText, { color: colors.textDim }]}>Trava Mobile v1.0.0</Text>
                </View>
            </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 20 },

    profileHeader: { alignItems: "center", paddingVertical: SPACING.xxl, paddingHorizontal: SPACING.lg },
    avatarLarge: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: SPACING.md },
    avatarTextLarge: { color: "#fff", fontSize: 32, fontWeight: "700" },
    userNameLarge: { fontSize: 20, fontWeight: "700" },
    userEmailLarge: { fontSize: 14, marginTop: 4 },
    editBtn: { marginTop: SPACING.lg, paddingHorizontal: SPACING.lg, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
    editBtnText: { fontWeight: "600", fontSize: 13 },

    section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
    sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: SPACING.sm, paddingLeft: 4 },
    menuCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, overflow: "hidden" },
    menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md, borderBottomWidth: 1 },
    menuLeft: { flexDirection: "row", alignItems: "center" },
    iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    menuLabel: { marginLeft: SPACING.md, fontSize: 15, fontWeight: "500" },

    versionText: { marginTop: SPACING.xl, textAlign: "center", fontSize: 12 },
});
