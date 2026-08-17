import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

import { MOTION, SPACING, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";
import { useReducedMotion } from "../hooks/useReducedMotion";
import PressableScale from "../components/PressableScale";

interface TabMeta {
    iconActive: string;
    iconInactive: string;
    label: string;
    iconFamily?: "Ionicons" | "MaterialCommunityIcons";
}

const TAB_META: Record<string, TabMeta> = {
    Home: { iconActive: "home", iconInactive: "home-outline", label: "Home" },
    Projects: {
        iconActive: "book-open-page-variant",
        iconInactive: "book-open-page-variant-outline",
        label: "Projects",
        iconFamily: "MaterialCommunityIcons",
    },
    MyTasks: {
        iconActive: "format-list-checks",
        iconInactive: "format-list-checks",
        label: "Board",
        iconFamily: "MaterialCommunityIcons",
    },
    Profile: {
        iconActive: "cog",
        iconInactive: "cog-outline",
        label: "Profile",
        iconFamily: "MaterialCommunityIcons",
    },
};

function TabButton({
    focused,
    meta,
    onPress,
    reducedMotion,
}: {
    focused: boolean;
    meta: TabMeta;
    onPress: () => void;
    reducedMotion: boolean;
}) {
    const { colors, isDark } = useTheme();

    const pillStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: reducedMotion ? 1 : withSpring(focused ? 1 : 0.9, MOTION.spring.snappy) },
        ],
    }));

    const IconComponent = meta.iconFamily === "MaterialCommunityIcons" ? MaterialCommunityIcons : Ionicons;

    // Active pill carries the brand primary in both themes; its content is dark
    // ink because white on #fbb54a fails contrast.
    const pillBg = colors.primary;
    const activeContent = "#2b1c04";
    const inactiveContent = isDark ? "#6b7280" : "#9ca3af";

    return (
        <PressableScale
            haptic={null}
            activeScale={0.95}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            style={styles.tabPressable}
        >
            <Animated.View
                style={[
                    styles.tabInner,
                    focused && { backgroundColor: pillBg, ...styles.tabInnerActive },
                    pillStyle,
                ]}
            >
                <IconComponent
                    name={(focused ? meta.iconActive : meta.iconInactive) as any}
                    size={focused ? 20 : 24}
                    color={focused ? activeContent : inactiveContent}
                />
                {focused && (
                    <Text style={[styles.tabLabel, { color: activeContent }]} numberOfLines={1}>
                        {meta.label}
                    </Text>
                )}
            </Animated.View>
        </PressableScale>
    );
}

export default function AnimatedTabBar({
    state,
    navigation,
    onOpenMenu,
}: {
    state: any;
    navigation: any;
    onOpenMenu: () => void;
}) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const reducedMotion = useReducedMotion();
    const routes = state.routes;

    const handlePress = (route: any, index: number) => {
        const isFocused = state.index === index;
        const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
        if (!isFocused && !event.defaultPrevented) {
            haptics.selection();
            navigation.navigate(route.name, { screen: "_Base" });
        }
    };

    const renderTab = (route: any, index: number) => {
        const meta = TAB_META[route.name] ?? {
            iconActive: "ellipse",
            iconInactive: "ellipse-outline",
            label: route.name,
        };
        return (
            <TabButton
                key={route.key}
                focused={state.index === index}
                meta={meta}
                onPress={() => handlePress(route, index)}
                reducedMotion={reducedMotion}
            />
        );
    };

    // The FAB sits in the middle of the bar, splitting the tabs into two halves.
    const splitAt = Math.ceil(routes.length / 2);
    const leftRoutes = routes.slice(0, splitAt);
    const rightRoutes = routes.slice(splitAt);

    return (
        <View
            style={{
                backgroundColor: colors.background,
                paddingHorizontal: SPACING.md,
                paddingBottom: Math.max(insets.bottom, SPACING.sm),
                paddingTop: SPACING.sm,
            }}
        >
            <View style={styles.bar} accessibilityRole="tablist">
                <View style={styles.tabGroup}>
                    {leftRoutes.map((route: any, i: number) => renderTab(route, i))}
                </View>

                {/* Center FAB */}
                <View style={styles.fabSlot}>
                    <PressableScale
                        haptic="medium"
                        onPress={onOpenMenu}
                        accessibilityRole="button"
                        accessibilityLabel="Create"
                        accessibilityHint="Opens the create menu"
                        style={[
                            styles.fab,
                            { backgroundColor: colors.primary, shadowColor: "#e0972a" },
                        ]}
                    >
                        <Ionicons name="add" size={28} color="#2b1c04" />
                    </PressableScale>
                </View>

                <View style={styles.tabGroup}>
                    {rightRoutes.map((route: any, i: number) => renderTab(route, splitAt + i))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: "row",
        alignItems: "center",
        height: 60,
    },
    tabGroup: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        height: "100%",
    },
    tabPressable: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
    },
    tabInner: {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 24,
        minHeight: 44,
    },
    tabInnerActive: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
        elevation: 4,
    },
    tabLabel: {
        fontSize: 10,
        fontFamily: FONTS.bold,
        letterSpacing: 0.2,
        marginTop: 2,
    },
    fabSlot: {
        width: 72,
        alignItems: "center",
        justifyContent: "center",
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 10,
    },
});
