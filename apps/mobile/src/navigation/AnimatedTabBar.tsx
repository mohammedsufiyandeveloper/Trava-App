import React, { useCallback, useState } from "react";
import { LayoutChangeEvent, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, withSpring, withTiming } from "react-native-reanimated";

import { MOTION, TOUCH_TARGET } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";
import { useReducedMotion } from "../hooks/useReducedMotion";
import PressableScale from "../components/PressableScale";

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

    const barBg = isDark ? "#121212" : "#FFFFFF";
    const pillBg = isDark ? "#1a1a1a" : "#f3f4f6";
    const indicatorBg = isDark ? "#262626" : "#FFFFFF";

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
                height: 65 + insets.bottom,
                backgroundColor: barBg,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                alignItems: "center",
                paddingBottom: insets.bottom,
                paddingHorizontal: 12,
                gap: 12,
            }}
        >
            <View
                onLayout={onPillLayout}
                accessibilityRole="tablist"
                style={{
                    flex: 1,
                    flexDirection: "row",
                    backgroundColor: pillBg,
                    height: 52,
                    borderRadius: 26,
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
                                shadowColor: isDark ? "#000" : colors.primary,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: isDark ? 0.4 : 0.15,
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

            <PressableScale
                haptic="medium"
                onPress={onOpenMenu}
                accessibilityRole="button"
                accessibilityLabel="Create"
                accessibilityHint="Opens the create menu"
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: pillBg,
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: isDark ? "#262626" : "#e5e7eb",
                }}
            >
                <Ionicons name="add" size={28} color={colors.primary} />
            </PressableScale>
        </View>
    );
}
