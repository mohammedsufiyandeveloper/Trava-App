import React, { useCallback, useState } from "react";
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";

import { MOTION, SPACING } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";
import { useReducedMotion } from "../hooks/useReducedMotion";
import PressableScale from "../components/PressableScale";
import GlassSurface from "../components/GlassSurface";

interface TabMeta {
    iconActive: string;
    iconInactive: string;
    label: string;
    iconFamily?: "Ionicons" | "MaterialCommunityIcons" | "Feather";
}

const TAB_META: Record<string, TabMeta> = {
    Home: { iconActive: "home", iconInactive: "home-outline", label: "Home" },
    Projects: { iconActive: "briefcase", iconInactive: "briefcase-outline", label: "Projects" },
    MyTasks: { iconActive: "trello", iconInactive: "trello", label: "Board", iconFamily: "Feather" },
    Profile: { iconActive: "person", iconInactive: "person-outline", label: "Profile" },
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
    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: reducedMotion ? 1 : withSpring(focused ? 1.05 : 1, MOTION.spring.snappy) },
        ],
    }));

    const IconComponent = 
        meta.iconFamily === "MaterialCommunityIcons" 
            ? MaterialCommunityIcons 
            : meta.iconFamily === "Feather"
            ? Feather
            : Ionicons;

    return (
        <PressableScale
            haptic={null}
            activeScale={0.95}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", height: "100%" }}
        >
            <Animated.View style={[{ alignItems: "center", justifyContent: "center", width: "100%" }, iconStyle]}>
                <View style={{ height: 32, width: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" }}>
                    <IconComponent
                        name={focused ? (meta.iconActive as any) : (meta.iconInactive as any)}
                        size={20}
                        color={focused ? "#000000" : "#888888"}
                    />
                </View>
                <Text
                    style={{
                        fontSize: 10,
                        fontWeight: focused ? "700" : "500",
                        color: focused ? "#ffffff" : "#888888",
                        marginTop: 4,
                    }}
                >
                    {meta.label}
                </Text>
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

    const [tabsWidth, setTabsWidth] = useState(0);
    const onTabsLayout = useCallback((e: LayoutChangeEvent) => {
        setTabsWidth(e.nativeEvent.layout.width);
    }, []);

    const tabWidth = tabsWidth > 0 ? tabsWidth / routes.length : 0;
    const indicatorWidth = 56;

    const indicatorStyle = useAnimatedStyle(() => {
        const x = state.index * tabWidth + (tabWidth - indicatorWidth) / 2;
        return {
            width: indicatorWidth,
            transform: [
                { translateX: reducedMotion ? withTiming(x, { duration: 0 }) : withSpring(x, MOTION.spring.snappy) },
            ],
        };
    });

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
                backgroundColor: colors.background,
                paddingHorizontal: SPACING.md,
                paddingBottom: Math.max(insets.bottom, SPACING.sm),
                paddingTop: SPACING.sm,
            }}
        >
            <GlassSurface
                level="elevated"
                intensity="header"
                radius="xl"
                elevation="md"
                allowBlur={allowTabBarBlur}
                style={{ 
                    backgroundColor: "#111111", 
                    borderRadius: 24, 
                    borderWidth: 1, 
                    borderColor: "rgba(255,255,255,0.04)" 
                }}
            >
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        height: 64,
                        paddingHorizontal: 8,
                    }}
                >
                    {/* Tabs Container */}
                    <View
                        onLayout={onTabsLayout}
                        accessibilityRole="tablist"
                        style={{
                            flex: 1,
                            flexDirection: "row",
                            height: "100%",
                            alignItems: "center",
                            position: "relative",
                        }}
                    >
                        {tabsWidth > 0 && (
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    {
                                        position: "absolute",
                                        top: 8, // Centered vertically in 64px height: (64 - 48)/2 = 8px
                                        height: 32,
                                        borderRadius: 16,
                                        backgroundColor: "#ffffff",
                                        shadowColor: "#000",
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 4,
                                        elevation: 3,
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
                                    reducedMotion={reducedMotion}
                                />
                            );
                        })}
                    </View>

                    {/* Spacing between tabs and FAB */}
                    <View style={{ width: 4 }} />

                    {/* FAB "+" Button */}
                    <View style={{ justifyContent: "center", alignItems: "center" }}>
                        <PressableScale
                            haptic="medium"
                            onPress={onOpenMenu}
                            accessibilityRole="button"
                            accessibilityLabel="Create"
                            accessibilityHint="Opens the create menu"
                            style={{ 
                                width: 44, 
                                height: 44, 
                                borderRadius: 22, 
                                borderColor: "#f59e0b", 
                                borderWidth: 1, 
                                backgroundColor: "#111111", 
                                justifyContent: "center", 
                                alignItems: "center" 
                            }}
                        >
                            <Ionicons name="add" size={24} color="#f59e0b" />
                        </PressableScale>
                    </View>
                </View>
            </GlassSurface>
        </View>
    );
}
