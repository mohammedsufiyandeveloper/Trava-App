import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    eachDayOfInterval,
    isBefore,
    isAfter,
    startOfToday,
    isWithinInterval,
} from "date-fns";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

interface CalendarPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect?: (date: Date) => void;
    onSelectRange?: (startDate: Date, endDate: Date) => void;
    mode?: "single" | "range";
    value?: Date | null;
    startDate?: Date | null;
    endDate?: Date | null;
    title?: string;
    minimumDate?: Date;
}

export default function CalendarPicker({
    visible,
    onClose,
    onSelect,
    onSelectRange,
    mode = "single",
    value,
    startDate: initialStartDate,
    endDate: initialEndDate,
    title = "Select Date",
    minimumDate,
}: CalendarPickerProps) {
    const { colors, isDark } = useTheme();
    const [currentMonth, setCurrentMonth] = useState(value || initialStartDate || new Date());
    const [rangeStart, setRangeStart] = useState<Date | null>(initialStartDate || null);
    const [rangeEnd, setRangeEnd] = useState<Date | null>(initialEndDate || null);

    const days = ["S", "M", "T", "W", "T", "F", "S"];

    const handleDayPress = (day: Date) => {
        if (mode === "single") {
            onSelect?.(day);
            onClose();
            return;
        }

        // Range mode logic
        if (!rangeStart || (rangeStart && rangeEnd)) {
            setRangeStart(day);
            setRangeEnd(null);
        } else if (rangeStart && !rangeEnd) {
            if (isBefore(day, rangeStart)) {
                setRangeStart(day);
                setRangeEnd(null);
            } else {
                setRangeEnd(day);
            }
        }
    };

    const handleApply = () => {
        if (mode === "range" && rangeStart && rangeEnd) {
            onSelectRange?.(rangeStart, rangeEnd);
            onClose();
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.monthText, { color: colors.text }]}>
                {format(currentMonth, "MMMM yyyy")}
            </Text>
            <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <Ionicons name="chevron-forward" size={24} color={colors.primary} />
            </TouchableOpacity>
        </View>
    );

    const renderDays = () => (
        <View style={styles.daysRow}>
            {days.map((day, i) => (
                <Text key={i} style={[styles.dayLabel, { color: colors.textDim }]}>
                    {day}
                </Text>
            ))}
        </View>
    );

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const calendarDays = eachDayOfInterval({
            start: startDate,
            end: endDate,
        });

        const rows: any[] = [];
        let daysInRow: any[] = [];

        calendarDays.forEach((day, i) => {
            let isSelected = false;
            let isInRange = false;
            let isRangeStart = false;
            let isRangeEnd = false;

            if (mode === "single") {
                isSelected = !!(value && isSameDay(day, value));
            } else {
                isRangeStart = !!(rangeStart && isSameDay(day, rangeStart));
                isRangeEnd = !!(rangeEnd && isSameDay(day, rangeEnd));
                isSelected = isRangeStart || isRangeEnd;
                if (rangeStart && rangeEnd) {
                    isInRange = isWithinInterval(day, { start: rangeStart, end: rangeEnd });
                }
            }

            const isCurrentMonth = isSameMonth(day, monthStart);
            const isDisabled = minimumDate && isBefore(day, minimumDate) && !isSameDay(day, minimumDate);

            daysInRow.push(
                <TouchableOpacity
                    key={day.toString()}
                    style={[
                        styles.cell,
                        isSelected && { backgroundColor: colors.primary },
                        isInRange && !isSelected && { backgroundColor: colors.primary + "20" },
                        isRangeStart && rangeEnd && { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
                        isRangeEnd && rangeStart && { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
                    ]}
                    onPress={() => {
                        if (!isDisabled) {
                            handleDayPress(day);
                        }
                    }}
                    disabled={isDisabled}
                >
                    <Text
                        style={[
                            styles.cellText,
                            { color: isCurrentMonth ? colors.text : colors.textDim + "40" },
                            isSelected && { color: "#fff", fontWeight: "700" },
                            isInRange && !isSelected && { color: colors.primary, fontWeight: "600" },
                            isDisabled && { color: colors.textDim + "20" },
                        ]}
                    >
                        {format(day, "d")}
                    </Text>
                </TouchableOpacity>
            );
            if ((i + 1) % 7 === 0) {
                rows.push(
                    <View key={i} style={styles.row}>
                        {daysInRow}
                    </View>
                );
                daysInRow = [];
            }
        });

        return <View style={styles.cellsContainer}>{rows}</View>;
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity 
                style={styles.overlay} 
                activeOpacity={1} 
                onPress={onClose}
            >
                <View 
                    style={[styles.container, { backgroundColor: colors.surface }]}
                    onStartShouldSetResponder={() => true}
                >
                    <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.textDim} />
                        </TouchableOpacity>
                    </View>
                    
                    {renderHeader()}
                    {renderDays()}
                    {renderCells()}

                    <View style={styles.footer}>
                        {mode === "range" ? (
                            <TouchableOpacity 
                                style={[
                                    styles.applyBtn, 
                                    { backgroundColor: rangeStart && rangeEnd ? colors.primary : colors.border }
                                ]}
                                onPress={handleApply}
                                disabled={!rangeStart || !rangeEnd}
                            >
                                <Text style={{ color: "#fff", fontWeight: "700" }}>Apply Range</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                style={[styles.todayBtn, { backgroundColor: colors.primary + "15" }]}
                                onPress={() => {
                                    onSelect?.(new Date());
                                    onClose();
                                }}
                            >
                                <Text style={{ color: colors.primary, fontWeight: "600" }}>Today</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    container: {
        width: "100%",
        borderRadius: BORDER_RADIUS.xl,
        padding: 20,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    titleRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    monthText: {
        fontSize: 16,
        fontWeight: "600",
    },
    daysRow: {
        flexDirection: "row",
        marginBottom: 10,
    },
    dayLabel: {
        flex: 1,
        textAlign: "center",
        fontSize: 12,
        fontWeight: "600",
    },
    cellsContainer: {
        width: "100%",
    },
    row: {
        flexDirection: "row",
    },
    cell: {
        flex: 1,
        aspectRatio: 1,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: BORDER_RADIUS.md,
        margin: 2,
    },
    cellText: {
        fontSize: 14,
    },
    footer: {
        marginTop: 20,
        alignItems: "center",
    },
    todayBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: BORDER_RADIUS.md,
    },
    applyBtn: {
        width: "100%",
        height: 48,
        borderRadius: BORDER_RADIUS.md,
        justifyContent: "center",
        alignItems: "center",
    }
});
