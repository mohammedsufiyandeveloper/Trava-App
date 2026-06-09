import React, { useCallback, useEffect } from "react";
import {
    Dimensions,
    Modal,
    Pressable,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedKeyboard,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";

import { BORDER_RADIUS, MOTION, Z_INDEX } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { haptics } from "../services/haptics";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DISMISS_THRESHOLD = 120;

interface SheetProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    /** Disable drag-down-to-dismiss. */
    dismissable?: boolean;
    style?: StyleProp<ViewStyle>;
    /** Accessible title announced when the sheet opens. */
    accessibilityLabel?: string;
}

/**
 * Premium bottom sheet: blurred backdrop, grabber, rubber-band drag-to-dismiss,
 * and keyboard-aware lift so focused inputs stay visible. Wrap modal *content*
 * in this instead of a bare <Modal animationType>. Mount it always and drive
 * with `visible` — it manages its own enter/exit.
 */
export default function Sheet({ visible, onClose, children, dismissable = true, style, accessibilityLabel }: SheetProps) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const keyboard = useAnimatedKeyboard();

    const [mounted, setMounted] = React.useState(visible);
    const translateY = useSharedValue(SCREEN_HEIGHT);

    const finishClose = useCallback(() => setMounted(false), []);

    const animateOut = useCallback(() => {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: MOTION.duration.base }, (finished) => {
            if (finished) runOnJS(finishClose)();
        });
    }, [translateY, finishClose]);

    const requestClose = useCallback(() => {
        animateOut();
        runOnJS(onClose)();
    }, [animateOut, onClose]);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            requestAnimationFrame(() => {
                translateY.value = withSpring(0, MOTION.spring.gentle);
            });
        } else if (mounted) {
            animateOut();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const pan = Gesture.Pan()
        .enabled(dismissable)
        .onChange((e) => {
            translateY.value = Math.max(0, translateY.value + e.changeY);
        })
        .onEnd((e) => {
            if (translateY.value > DISMISS_THRESHOLD || e.velocityY > 800) {
                runOnJS(haptics.light)();
                translateY.value = withTiming(SCREEN_HEIGHT, { duration: MOTION.duration.base }, (finished) => {
                    if (finished) runOnJS(finishClose)();
                });
                runOnJS(onClose)();
            } else {
                translateY.value = withSpring(0, MOTION.spring.snappy);
            }
        });

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value - keyboard.height.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT], [1, 0], Extrapolation.CLAMP),
    }));

    if (!mounted) return null;

    return (
        <Modal transparent visible={mounted} onRequestClose={requestClose} statusBarTranslucent animationType="none">
            {/* Content inside a RN Modal lives in a detached view tree — it needs its
                own GestureHandlerRootView for the swipe-to-dismiss pan to register. */}
            <GestureHandlerRootView style={StyleSheet.absoluteFill}>
                <Animated.View style={[StyleSheet.absoluteFill, { zIndex: Z_INDEX.sheetBackdrop }, backdropStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Close">
                        <BlurView intensity={isDark ? 40 : 25} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]} />
                    </Pressable>
                </Animated.View>

                <GestureDetector gesture={pan}>
                    <Animated.View
                        accessibilityViewIsModal
                        accessibilityLabel={accessibilityLabel}
                        style={[
                            styles.sheet,
                            { backgroundColor: colors.surface, paddingBottom: insets.bottom + 8, zIndex: Z_INDEX.sheet },
                            sheetStyle,
                            style,
                        ]}
                    >
                        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
                        {children}
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    sheet: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        paddingTop: 8,
        maxHeight: "92%",
    },
    grabber: {
        alignSelf: "center",
        width: 40,
        height: 5,
        borderRadius: 3,
        marginBottom: 8,
    },
});
