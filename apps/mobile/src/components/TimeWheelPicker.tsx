import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format, isSameDay } from "date-fns";
import { BORDER_RADIUS, FONTS } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PAD = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

interface WheelItem {
    label: string;
    value: number;
    disabled?: boolean;
}

interface WheelProps {
    items: WheelItem[];
    value: number;
    onChange: (value: number) => void;
    colors: any;
}

function Wheel({ items, value, onChange, colors }: WheelProps) {
    const ref = useRef<ScrollView>(null);
    const settledIndex = useRef(-1);
    const mounted = useRef(false);

    const index = items.findIndex((i) => i.value === value);

    useEffect(() => {
        if (index < 0 || index === settledIndex.current) return;
        settledIndex.current = index;
        ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: mounted.current });
        mounted.current = true;
    }, [index]);

    const nearestEnabled = (from: number) => {
        if (!items[from]?.disabled) return from;
        for (let offset = 1; offset < items.length; offset++) {
            if (items[from + offset] && !items[from + offset].disabled) return from + offset;
            if (items[from - offset] && !items[from - offset].disabled) return from - offset;
        }
        return from;
    };

    const settle = (offsetY: number) => {
        const raw = Math.round(offsetY / ITEM_HEIGHT);
        const clamped = Math.max(0, Math.min(items.length - 1, raw));
        const target = nearestEnabled(clamped);

        settledIndex.current = target;
        ref.current?.scrollTo({ y: target * ITEM_HEIGHT, animated: true });
        if (items[target].value !== value) onChange(items[target].value);
    };

    // A fling fires onScrollEndDrag first and onMomentumScrollEnd after. Settling on
    // the drag would yank the wheel back mid-flight, so only settle the drag when no
    // momentum follows it.
    const momentum = useRef(false);

    const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        setTimeout(() => {
            if (!momentum.current) settle(y);
        }, 60);
    };

    return (
        <ScrollView
            ref={ref}
            style={{ height: WHEEL_HEIGHT }}
            contentContainerStyle={{ paddingVertical: PAD }}
            snapToInterval={ITEM_HEIGHT}
            snapToAlignment="start"
            disableIntervalMomentum
            decelerationRate="fast"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            onMomentumScrollBegin={() => { momentum.current = true; }}
            onMomentumScrollEnd={(e) => { momentum.current = false; settle(e.nativeEvent.contentOffset.y); }}
            onScrollEndDrag={handleScrollEndDrag}
        >
            {items.map((item) => {
                const isSelected = item.value === value;
                return (
                    <View key={item.value} style={styles.item}>
                        <Text
                            style={[
                                styles.itemText,
                                {
                                    color: item.disabled
                                        ? colors.textDim + "50"
                                        : isSelected
                                            ? colors.primary
                                            : colors.textDim,
                                    fontFamily: isSelected ? FONTS.bold : FONTS.medium,
                                    fontSize: isSelected ? 22 : 18,
                                },
                            ]}
                        >
                            {item.label}
                        </Text>
                    </View>
                );
            })}
        </ScrollView>
    );
}

interface TimeWheelPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (date: Date) => void;
    /** The date whose time is being edited. Its day is preserved. */
    value?: Date | null;
    title?: string;
    /**
     * Earliest allowed date/time. The time floor only applies when `value`
     * (or today, if `value` is null) falls on the same day as this date.
     */
    minimumDate?: Date | null;
    accentIcon?: keyof typeof Ionicons.glyphMap;
}

export default function TimeWheelPicker({
    visible,
    onClose,
    onSelect,
    value,
    title = "Select Time",
    minimumDate,
    accentIcon = "time-outline",
}: TimeWheelPickerProps) {
    const { colors } = useTheme();

    const baseDate = useMemo(() => value || new Date(), [value, visible]);

    // Minutes since midnight below which selection is not allowed (-1 = no floor).
    const minTotal = useMemo(() => {
        if (!minimumDate || !isSameDay(baseDate, minimumDate)) return -1;
        return minimumDate.getHours() * 60 + minimumDate.getMinutes();
    }, [minimumDate, baseDate]);

    const [hour12, setHour12] = useState(12);
    const [minute, setMinute] = useState(0);
    const [isPM, setIsPM] = useState(false);

    const to24 = (h: number, pm: boolean) => (pm ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h);

    useEffect(() => {
        if (!visible) return;
        const initial = value || new Date();
        let total = initial.getHours() * 60 + initial.getMinutes();
        if (minTotal >= 0 && total < minTotal) total = minTotal;

        const h24 = Math.floor(total / 60);
        setIsPM(h24 >= 12);
        setHour12(h24 % 12 || 12);
        setMinute(total % 60);
    }, [visible]);

    const ampmItems: WheelItem[] = useMemo(
        () => [
            { label: "AM", value: 0, disabled: minTotal >= 12 * 60 },
            { label: "PM", value: 1, disabled: false },
        ],
        [minTotal]
    );

    const hourItems: WheelItem[] = useMemo(
        () =>
            Array.from({ length: 12 }, (_, i) => {
                const h = i + 1;
                const h24 = to24(h, isPM);
                // Disabled only when every minute of that hour is before the floor.
                return { label: h.toString().padStart(2, "0"), value: h, disabled: minTotal >= 0 && h24 * 60 + 59 < minTotal };
            }),
        [isPM, minTotal]
    );

    const minuteItems: WheelItem[] = useMemo(() => {
        const h24 = to24(hour12, isPM);
        return Array.from({ length: 60 }, (_, m) => ({
            label: m.toString().padStart(2, "0"),
            value: m,
            disabled: minTotal >= 0 && h24 * 60 + m < minTotal,
        }));
    }, [hour12, isPM, minTotal]);

    // Re-clamp whenever a neighbouring wheel pushes the selection below the floor.
    useEffect(() => {
        if (minTotal < 0) return;
        const total = to24(hour12, isPM) * 60 + minute;
        if (total >= minTotal) return;

        const h24 = Math.floor(minTotal / 60);
        setIsPM(h24 >= 12);
        setHour12(h24 % 12 || 12);
        setMinute(minTotal % 60);
    }, [hour12, minute, isPM, minTotal]);

    const previewDate = useMemo(() => {
        const d = new Date(baseDate);
        d.setHours(to24(hour12, isPM), minute, 0, 0);
        return d;
    }, [baseDate, hour12, minute, isPM]);

    const handleConfirm = () => {
        onSelect(previewDate);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                {/* Backdrop as a sibling, not a parent: a touchable wrapping the card would
                    claim the responder on touch-start and the wheels would never scroll. */}
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleLeft}>
                            <View style={[styles.iconBox, { backgroundColor: colors.primary + "20" }]}>
                                <Ionicons name={accentIcon} size={16} color={colors.primary} />
                            </View>
                            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                            <Ionicons name="close" size={22} color={colors.textDim} />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.preview, { color: colors.primary }]}>{format(previewDate, "hh:mm a")}</Text>

                    <View style={styles.wheels}>
                        <View
                            style={[
                                styles.band,
                                { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" },
                            ]}
                            pointerEvents="none"
                        />
                        <View style={{ flex: 1 }}>
                            <Wheel items={hourItems} value={hour12} onChange={setHour12} colors={colors} />
                        </View>
                        <Text style={[styles.separator, { color: colors.textDim }]}>:</Text>
                        <View style={{ flex: 1 }}>
                            <Wheel items={minuteItems} value={minute} onChange={setMinute} colors={colors} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Wheel
                                items={ampmItems}
                                value={isPM ? 1 : 0}
                                onChange={(v) => setIsPM(v === 1)}
                                colors={colors}
                            />
                        </View>
                    </View>

                    {minTotal >= 0 && (
                        <Text style={[styles.hint, { color: colors.textDim }]}>
                            Earliest available: {format(minimumDate as Date, "hh:mm a")}
                        </Text>
                    )}

                    <View style={styles.footer}>
                        <TouchableOpacity
                            onPress={onClose}
                            style={[styles.btn, { borderWidth: 1, borderColor: colors.border }]}
                        >
                            <Text style={{ fontSize: 14, fontFamily: FONTS.semibold, color: colors.text }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleConfirm} style={[styles.btn, { backgroundColor: colors.primary }]}>
                            <Text style={{ fontSize: 14, fontFamily: FONTS.bold, color: "#fff" }}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    container: {
        width: "100%",
        maxWidth: 340,
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
        padding: 20,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    titleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    titleLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    iconBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: 16,
        fontFamily: FONTS.bold,
    },
    preview: {
        fontSize: 26,
        fontFamily: FONTS.bold,
        textAlign: "center",
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    wheels: {
        height: WHEEL_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        position: "relative",
    },
    band: {
        position: "absolute",
        top: PAD,
        left: 0,
        right: 0,
        height: ITEM_HEIGHT,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
    },
    separator: {
        fontSize: 20,
        fontFamily: FONTS.bold,
        marginHorizontal: -4,
    },
    item: {
        height: ITEM_HEIGHT,
        justifyContent: "center",
        alignItems: "center",
    },
    itemText: {
        textAlign: "center",
    },
    hint: {
        fontSize: 11,
        fontFamily: FONTS.medium,
        textAlign: "center",
        marginTop: 12,
    },
    footer: {
        flexDirection: "row",
        gap: 12,
        marginTop: 20,
    },
    btn: {
        flex: 1,
        height: 46,
        borderRadius: BORDER_RADIUS.md,
        justifyContent: "center",
        alignItems: "center",
    },
});
