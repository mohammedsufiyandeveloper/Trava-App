import React from 'react';
import { Platform, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView as ExpoBlurView } from 'expo-blur';

interface BlurViewProps {
    intensity?: number;
    tint?: 'light' | 'dark' | 'default';
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
}

/**
 * Cross-platform BlurView wrapper.
 * On iOS, renders the high-performance native live blur (ExpoBlurView).
 * On Android, falls back to a semi-translucent View to avoid New Architecture (Fabric)
 * rendering crashes and save GPU/rendering performance.
 */
export default function BlurView({ intensity = 50, tint = 'default', style, children }: BlurViewProps) {
    if (Platform.OS === 'ios') {
        return (
            <ExpoBlurView intensity={intensity} tint={tint} style={style}>
                {children}
            </ExpoBlurView>
        );
    }

    // On Android, render a fallback semi-translucent View.
    const isDark = tint === 'dark';
    const opacity = Math.min(intensity / 100, 0.95);
    const backgroundColor = isDark 
        ? `rgba(20, 20, 20, ${opacity * 0.7})` 
        : `rgba(255, 255, 255, ${opacity * 0.75})`;

    return (
        <View style={[style, { backgroundColor }]}>
            {children}
        </View>
    );
}
