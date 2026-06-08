import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { Task } from "../../types";
import { getStatusHex } from "../../utils/taskColors";

interface MobileGanttBarProps {
    task: Task;
    leftPercent: number;   // 0-100
    widthPercent: number;  // 0-100
    totalWidth: number;    // the pixel width of the entire timeline canvas
    isSubtask?: boolean;
    onPress: () => void;
}

// STATUS_COLORS removed in favor of getStatusHex from taskColors utility

export default function MobileGanttBar({
    task,
    leftPercent,
    widthPercent,
    totalWidth,
    isSubtask = false,
    onPress,
}: MobileGanttBarProps) {
    const { isDark } = useTheme();

    const statusKey = task.status ?? "TO_DO";
    const barColor = getStatusHex(statusKey);

    // Convert percentages to pixels for the given canvas width
    const leftPx  = (leftPercent  / 100) * totalWidth;
    const widthPx = Math.max(14, (widthPercent / 100) * totalWidth);

    const barHeight = isSubtask ? 14 : 24;
    const barTop    = isSubtask ? 34 : 8;

    const barStyle = {
        left:            leftPx,
        width:           widthPx,
        height:          barHeight,
        top:             barTop,
        backgroundColor: barColor + (isDark ? "cc" : "ee"),
        borderColor:     barColor + "66",
    };

    const showLabel = widthPx > 50;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={[styles.bar, barStyle]}
        >
            {/* Glassy shimmer stripe on top */}
            <View style={styles.glassHighlight} pointerEvents="none" />

            {showLabel && (
                <Text style={styles.label} numberOfLines={1}>
                    {task.name}
                </Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    bar: {
        position:      "absolute",
        borderRadius:  6,
        borderWidth:   1,
        justifyContent:"center",
        paddingHorizontal: 6,
        overflow:      "hidden",
        // Elevation for Android
        elevation: 3,
        // Shadow for iOS
        shadowColor:   "#000",
        shadowOffset:  { width: 0, height: 2 },
        shadowOpacity: 0.20,
        shadowRadius:  3,
    },
    glassHighlight: {
        position:      "absolute",
        top:           0,
        left:          0,
        right:         0,
        height:        "40%",
        backgroundColor:"rgba(255,255,255,0.18)",
        borderTopLeftRadius:  6,
        borderTopRightRadius: 6,
    },
    label: {
        color:      "#fff",
        fontSize:   9,
        fontWeight: "700",
        letterSpacing: 0.2,
        textShadowColor: "rgba(0,0,0,0.4)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
