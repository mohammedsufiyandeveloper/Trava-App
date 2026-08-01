import React, { useCallback, useState } from "react";
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";

import { MOTION, SPACING, TOUCH_TARGET } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";
import { useReducedMotion } from "../hooks/useReducedMotion";
import PressableScale from "../components/PressableScale";
import GlassSurface from "../components/GlassSurface";

interface TabMeta {
    iconActive: keyof typeof Ionicons.glyphMap;
    iconInactive: keyof typeof Ionicons.glyphMap;
    label: string;
}

const TAB_META: Record<string, TabMeta> = {
    Home: { iconActive: "home", iconInactive: "home-outline", label: "Home" },
    Projects: { iconActive: "briefcase", iconInactive: "briefcase-outline", label: "Projects" },
    MyTasks: { iconActive: "list", iconInactive: "list-outline", label: "Tasks" },
    Profile: { iconActive: "person", iconInactive: "person-outline", label: "Profile" },
};

function TabButton({
    focused,
    meta,
    onPress,
    activeColor,
    inactiveColor,
    reducedMotion,
}: {
    focused: boolean;
    meta: TabMeta;
    onPress: () => void;
    activeColor: string;
    inactiveColor: string;
    reducedMotion: boolean;
}) {
    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: reducedMotion ? 1 : withSpring(focused ? 1.12 : 1, MOTION.spring.snappy) },
        ],
    }));

    return (
        <PressableScale
            haptic={null}
            activeScale={0.9}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", height: "100%", minHeight: TOUCH_TARGET.min }}
        >
            <Animated.View style={[{ alignItems: "center" }, iconStyle]}>
                <Ionicons
                    name={focused ? meta.iconActive : meta.iconInactive}
                    size={focused ? 23 : 20}
                    color={focused ? activeColor : inactiveColor}
                />
                <Text
                    style={{
                        fontSize: focused ? 10 : 9,
                        fontWeight: focused ? "800" : "500",
                        color: focused ? activeColor : inactiveColor,
                        marginTop: 2,
                    }}
                >
                    {meta.label}
                </Text>
            </Animated.View>
        </PressableScale>
    );
}

/**
 * Premium bottom tab bar: a spring-driven pill indicator slides under the active
 * tab, icons scale on focus, and every tab change fires a selection haptic.
 * Respects Reduce Motion (indicator snaps instead of springing).
 */
export default function AnimatedTabBar({
    state,
    navigation,
    onOpenMenu,
}: {
    state: any;
    navigation: any;
    onOpenMenu: () => void;
}) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const reducedMotion = useReducedMotion();
    const routes = state.routes;

    const [pillWidth, setPillWidth] = useState(0);
    const onPillLayout = useCallback((e: LayoutChangeEvent) => {
        setPillWidth(e.nativeEvent.layout.width);
    }, []);

    const PILL_PADDING = 4;
    const tabWidth = pillWidth > 0 ? (pillWidth - PILL_PADDING * 2) / routes.length : 0;

    const indicatorStyle = useAnimatedStyle(() => {
        const x = PILL_PADDING + state.index * tabWidth;
        return {
            width: tabWidth,
            transform: [
                { translateX: reducedMotion ? withTiming(x, { duration: 0 }) : withSpring(x, MOTION.spring.snappy) },
            ],
        };
    });

    const indicatorBg = isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.85)";
    // expo-blur on Android is more prone to jank/inconsistency behind fast-scrolling
    // content; keep the tab bar's blur cheap and lean on the tint if it struggles.
    const allowTabBarBlur = Platform.OS !== "android" || Platform.Version >= 28;

    const handlePress = (route: any, index: number) => {
        const isFocused = state.index === index;
        const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
        if (!isFocused && !event.defaultPrevented) {
            haptics.selection();
            navigation.navigate(route.name, { screen: "_Base" });
        }
    };

    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.background,
                paddingHorizontal: SPACING.md,
                paddingBottom: Math.max(insets.bottom, SPACING.sm),
                paddingTop: SPACING.sm,
                gap: 12,
            }}
        >
            <GlassSurface
                level="elevated"
                intensity="header"
                radius="full"
                elevation="md"
                allowBlur={allowTabBarBlur}
                style={{ flex: 1 }}
            >
                <View
                    onLayout={onPillLayout}
                    accessibilityRole="tablist"
                    style={{
                        flexDirection: "row",
                        height: 56,
                        padding: PILL_PADDING,
                    }}
                >
                    {pillWidth > 0 && (
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                {
                                    position: "absolute",
                                    top: PILL_PADDING,
                                    bottom: PILL_PADDING,
                                    borderRadius: 22,
                                    backgroundColor: indicatorBg,
                                    borderWidth: StyleSheet.hairlineWidth,
                                    borderColor: colors.glassBorder,
                                    shadowColor: isDark ? "#000" : colors.primary,
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: isDark ? 0.35 : 0.15,
                                    shadowRadius: 8,
                                    elevation: 6,
                                },
                                indicatorStyle,
                            ]}
                        />
                    )}
                    {routes.map((route: any, index: number) => {
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
                                activeColor={colors.primary}
                                inactiveColor={colors.textDim}
                                reducedMotion={reducedMotion}
                            />
                        );
                    })}
                </View>
            </GlassSurface>

            <GlassSurface
                level="elevated"
                intensity="header"
                radius="full"
                elevation="md"
                allowBlur={allowTabBarBlur}
                style={{ width: 56, height: 56 }}
            >
                <PressableScale
                    haptic="medium"
                    onPress={onOpenMenu}
                    accessibilityRole="button"
                    accessibilityLabel="Create"
                    accessibilityHint="Opens the create menu"
                    style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
                >
                    <Ionicons name="add" size={28} color={colors.primary} />
                </PressableScale>
            </GlassSurface>
        </View>
    );
}
