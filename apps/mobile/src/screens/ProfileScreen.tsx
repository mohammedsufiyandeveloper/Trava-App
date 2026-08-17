import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    ScrollView,
    ActivityIndicator,
    Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { getHapticsEnabled, setHapticsEnabled, haptics } from "../services/haptics";
import { useNotifications } from "../context/NotificationContext";
import { getCachedSession, signOut, getSession, getProfile } from "../services/api";
import { MainTabParamList, User } from "../types";
import { useResponsive } from "../hooks/useResponsive";
import AppCard from "../components/AppCard";
import PressableScale from "../components/PressableScale";
import ConfirmationSheet from "../components/ConfirmationSheet";

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
        <PressableScale
            style={[styles.menuItem, { borderBottomColor: colors.border }, isLast && { borderBottomWidth: 0 }]}
            onPress={onPress}
            disabled={!onPress}
            haptic="selection"
            accessibilityLabel={label}
            accessibilityRole="button"
        >
            <View style={styles.menuLeft}>
                <View style={[styles.iconBox, { backgroundColor: icon.bg || colors.surface }]}>
                    <Ionicons name={icon.name} size={18} color={icon.color || colors.text} />
                </View>
                <Text style={[styles.menuLabel, { color: itemColor }]}>{label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
        </PressableScale>
    );
};

const ToggleItem: React.FC<{
    icon: { name: keyof typeof Ionicons.glyphMap; color?: string; bg?: string };
    label: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    isLast?: boolean;
}> = ({ icon, label, value, onValueChange, isLast = false }) => {
    const { colors } = useTheme();
    return (
        <View
            style={[styles.menuItem, { borderBottomColor: colors.border }, isLast && { borderBottomWidth: 0 }]}
            accessibilityRole="switch"
            accessibilityLabel={label}
            accessibilityState={{ checked: value }}
        >
            <View style={styles.menuLeft}>
                <View style={[styles.iconBox, { backgroundColor: icon.bg || colors.surface }]}>
                    <Ionicons name={icon.name} size={18} color={icon.color || colors.text} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#ffffff"
            />
        </View>
    );
};

export default function ProfileScreen({ navigation }: Props) {
    const [user, setUser] = useState<User | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [hapticsOn, setHapticsOn] = useState(getHapticsEnabled());
    const [signOutVisible, setSignOutVisible] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const { colors, isDark, toggleTheme } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const onToggleTheme = () => {
        haptics.selection();
        toggleTheme();
    };

    const onToggleHaptics = (next: boolean) => {
        setHapticsOn(next);
        setHapticsEnabled(next);
        if (next) haptics.selection(); // confirm the new state with a tap
    };

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
        setSigningOut(true);
        try {
            await signOut();
            (navigation.getParent() as any)?.replace("SignIn");
        } finally {
            setSigningOut(false);
            setSignOutVisible(false);
        }
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
                <PressableScale
                    style={styles.profileHeader}
                    onPress={() => (navigation as any)?.navigate("MyProfile")}
                    haptic="light"
                    accessibilityLabel="Open my profile"
                    accessibilityRole="button"
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
                </PressableScale>

                {/* Account Section */}
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.textDim }]}>ACCOUNT</Text>
                    <AppCard padded={false} style={styles.menuCard}>
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
                    </AppCard>
                </View>

                {/* Preferences */}
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.textDim }]}>PREFERENCES</Text>
                    <AppCard padded={false} style={styles.menuCard}>
                        <ToggleItem
                            icon={{ name: isDark ? "moon" : "sunny", color: colors.primary, bg: colors.primary + "1f" }}
                            label="Dark mode"
                            value={isDark}
                            onValueChange={onToggleTheme}
                        />
                        <ToggleItem
                            icon={{ name: "phone-portrait-outline", color: "#10b981", bg: "#10b98115" }}
                            label="Haptic feedback"
                            value={hapticsOn}
                            onValueChange={onToggleHaptics}
                            isLast
                        />
                    </AppCard>
                </View>

                {/* Workspace Settings */}
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.textDim }]}>WORKSPACE</Text>
                    <AppCard padded={false} style={styles.menuCard}>
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
                    </AppCard>
                </View>

                {/* Actions */}
                <View style={[styles.section, { marginBottom: SPACING.xxl }]}>
                    <AppCard padded={false} style={styles.menuCard}>
                        <MenuItem
                            icon={{ name: "log-out-outline", color: colors.error, bg: colors.error + "15" }}
                            label="Sign Out"
                            color={colors.error}
                            onPress={() => setSignOutVisible(true)}
                            isLast
                        />
                    </AppCard>
                    <Text style={[styles.versionText, { color: colors.textDim }]}>Trava Mobile v1.0.0</Text>
                </View>
            </ScrollView>
            </View>

            <ConfirmationSheet
                visible={signOutVisible}
                title="Sign out?"
                description="You'll need to sign in again to access your workspaces."
                tone="warning"
                confirmLabel="Sign Out"
                cancelLabel="Cancel"
                loading={signingOut}
                onConfirm={handleSignOut}
                onClose={() => setSignOutVisible(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingBottom: 20 },

    profileHeader: { alignItems: "center", paddingVertical: SPACING.xxl, paddingHorizontal: SPACING.lg },
    avatarLarge: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: SPACING.md },
    avatarTextLarge: { color: "#fff", fontSize: 32, fontFamily: FONTS.bold },
    userNameLarge: { fontSize: 20, fontFamily: FONTS.bold },
    userEmailLarge: { fontSize: 14, marginTop: 4 },
    editBtn: { marginTop: SPACING.lg, paddingHorizontal: SPACING.lg, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
    editBtnText: { fontFamily: FONTS.semibold, fontSize: 13 },

    section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
    sectionLabel: { fontSize: 11, fontFamily: FONTS.bold, letterSpacing: 1, marginBottom: SPACING.sm, paddingLeft: 4 },
    menuCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, overflow: "hidden" },
    menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md, borderBottomWidth: 1 },
    menuLeft: { flexDirection: "row", alignItems: "center" },
    iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    menuLabel: { marginLeft: SPACING.md, fontSize: 15, fontFamily: FONTS.medium },

    versionText: { marginTop: SPACING.xl, textAlign: "center", fontSize: 12 },
});
