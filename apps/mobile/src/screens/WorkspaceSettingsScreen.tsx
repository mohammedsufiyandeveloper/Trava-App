import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { SPACING, BORDER_RADIUS, FONTS } from "../constants/theme";
import { getWorkspaceSettings, updateWorkspaceSettings } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";
import AppCard from "../components/AppCard";
import AppButton from "../components/AppButton";
import PressableScale from "../components/PressableScale";
import { useToast } from "../context/ToastContext";

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

type FieldErrors = Partial<Record<
    "name" | "lateThreshold" | "overtimeThreshold" | "halfDayThreshold" | "shiftStartTime" | "shiftEndTime" | "sickLeaveLimit" | "casualLeaveAccrualDays",
    string
>>;

export default function WorkspaceSettingsScreen({ navigation }: any) {
    const { colors } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<any>(null);
    const [errors, setErrors] = useState<FieldErrors>({});

    // Form state
    const [name, setName] = useState("");
    const [lateThreshold, setLateThreshold] = useState("");
    const [overtimeThreshold, setOvertimeThreshold] = useState("");
    const [halfDayThreshold, setHalfDayThreshold] = useState("");
    const [shiftStartTime, setShiftStartTime] = useState("");
    const [shiftEndTime, setShiftEndTime] = useState("");
    const [sickLeaveLimit, setSickLeaveLimit] = useState("");
    const [casualLeaveAccrualDays, setCasualLeaveAccrualDays] = useState("");

    const loadSettings = useCallback(async () => {
        if (!activeWorkspace?.id) return;
        setLoading(true);
        try {
            const data = await getWorkspaceSettings(activeWorkspace.id);
            if (data) {
                setSettings(data);
                setName(data.name || "");
                setLateThreshold(data.lateThreshold || "");
                setOvertimeThreshold(data.overtimeThreshold || "");
                setHalfDayThreshold(data.halfDayThreshold || "");
                setShiftStartTime(data.shiftStartTime || "");
                setShiftEndTime(data.shiftEndTime || "");
                setSickLeaveLimit(String(data.sickLeaveLimit || 0));
                setCasualLeaveAccrualDays(String(data.casualLeaveAccrualDays || 0));
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        } finally {
            setLoading(false);
        }
    }, [activeWorkspace?.id]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const validate = (): FieldErrors => {
        const next: FieldErrors = {};
        if (!name.trim()) next.name = "Workspace name is required.";

        const timeFields: Array<[string, keyof FieldErrors, string]> = [
            [lateThreshold, "lateThreshold", "Use HH:mm, e.g. 09:40"],
            [overtimeThreshold, "overtimeThreshold", "Use HH:mm, e.g. 07:00"],
            [halfDayThreshold, "halfDayThreshold", "Use HH:mm, e.g. 23:00"],
            [shiftStartTime, "shiftStartTime", "Use HH:mm, e.g. 09:30"],
            [shiftEndTime, "shiftEndTime", "Use HH:mm, e.g. 18:30"],
        ];
        for (const [val, key, msg] of timeFields) {
            if (val && !HHMM_RE.test(val)) next[key] = msg;
        }

        if (sickLeaveLimit && (isNaN(Number(sickLeaveLimit)) || Number(sickLeaveLimit) < 0)) {
            next.sickLeaveLimit = "Enter a valid non-negative number.";
        }
        if (casualLeaveAccrualDays && (isNaN(Number(casualLeaveAccrualDays)) || Number(casualLeaveAccrualDays) < 0)) {
            next.casualLeaveAccrualDays = "Enter a valid non-negative number.";
        }
        return next;
    };

    const handleSave = async () => {
        if (!activeWorkspace?.id) return;
        const nextErrors = validate();
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            toast.error("Please fix the highlighted fields.");
            return;
        }
        setSaving(true);
        try {
            await updateWorkspaceSettings(activeWorkspace.id, {
                name,
                lateThreshold,
                overtimeThreshold,
                halfDayThreshold,
                shiftStartTime,
                shiftEndTime,
                sickLeaveLimit: parseInt(sickLeaveLimit, 10),
                casualLeaveAccrualDays: parseInt(casualLeaveAccrualDays, 10),
            });
            toast.success("Workspace settings updated.");
            navigation.goBack();
        } catch (error: any) {
            // Entered values are preserved (still in local state) so the user can retry.
            toast.error(error.message || "Failed to update settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                <View style={[styles.header, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <PressableScale
                        onPress={() => navigation.goBack()}
                        style={styles.backBtn}
                        haptic="light"
                        accessibilityLabel="Go back"
                        accessibilityRole="button"
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </PressableScale>
                    <Text style={[styles.title, { color: colors.text }]}>Workspace Settings</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>General</Text>
                    <AppCard style={styles.card}>
                        <Text style={[styles.label, { color: colors.textDim }]}>Workspace Name</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: errors.name ? colors.error : colors.border }]}
                            value={name}
                            onChangeText={(t) => { setName(t); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
                            accessibilityLabel="Workspace name"
                        />
                        {!!errors.name && <Text style={[styles.errorText, { color: colors.error }]}>{errors.name}</Text>}
                    </AppCard>

                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Attendance Thresholds</Text>
                    <AppCard style={styles.card}>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Late Threshold (HH:mm)</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: errors.lateThreshold ? colors.error : colors.border }]}
                                    value={lateThreshold}
                                    onChangeText={(t) => { setLateThreshold(t); if (errors.lateThreshold) setErrors((e) => ({ ...e, lateThreshold: undefined })); }}
                                    placeholder="09:40"
                                    placeholderTextColor={colors.textDim}
                                    accessibilityLabel="Late threshold"
                                />
                                {!!errors.lateThreshold && <Text style={[styles.errorText, { color: colors.error }]}>{errors.lateThreshold}</Text>}
                            </View>
                            <View style={{ width: SPACING.md }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Overtime (HH:mm)</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: errors.overtimeThreshold ? colors.error : colors.border }]}
                                    value={overtimeThreshold}
                                    onChangeText={(t) => { setOvertimeThreshold(t); if (errors.overtimeThreshold) setErrors((e) => ({ ...e, overtimeThreshold: undefined })); }}
                                    placeholder="07:00"
                                    placeholderTextColor={colors.textDim}
                                    accessibilityLabel="Overtime threshold"
                                />
                                {!!errors.overtimeThreshold && <Text style={[styles.errorText, { color: colors.error }]}>{errors.overtimeThreshold}</Text>}
                            </View>
                        </View>

                        <View style={[styles.row, { marginTop: SPACING.md }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Half Day (HH:mm)</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: errors.halfDayThreshold ? colors.error : colors.border }]}
                                    value={halfDayThreshold}
                                    onChangeText={(t) => { setHalfDayThreshold(t); if (errors.halfDayThreshold) setErrors((e) => ({ ...e, halfDayThreshold: undefined })); }}
                                    placeholder="23:00"
                                    placeholderTextColor={colors.textDim}
                                    accessibilityLabel="Half day threshold"
                                />
                                {!!errors.halfDayThreshold && <Text style={[styles.errorText, { color: colors.error }]}>{errors.halfDayThreshold}</Text>}
                            </View>
                            <View style={{ flex: 1 }} />
                        </View>
                    </AppCard>

                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Shift Timing</Text>
                    <AppCard style={styles.card}>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Start Time</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: errors.shiftStartTime ? colors.error : colors.border }]}
                                    value={shiftStartTime}
                                    onChangeText={(t) => { setShiftStartTime(t); if (errors.shiftStartTime) setErrors((e) => ({ ...e, shiftStartTime: undefined })); }}
                                    accessibilityLabel="Shift start time"
                                />
                                {!!errors.shiftStartTime && <Text style={[styles.errorText, { color: colors.error }]}>{errors.shiftStartTime}</Text>}
                            </View>
                            <View style={{ width: SPACING.md }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>End Time</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: errors.shiftEndTime ? colors.error : colors.border }]}
                                    value={shiftEndTime}
                                    onChangeText={(t) => { setShiftEndTime(t); if (errors.shiftEndTime) setErrors((e) => ({ ...e, shiftEndTime: undefined })); }}
                                    accessibilityLabel="Shift end time"
                                />
                                {!!errors.shiftEndTime && <Text style={[styles.errorText, { color: colors.error }]}>{errors.shiftEndTime}</Text>}
                            </View>
                        </View>
                    </AppCard>

                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Leave Policies</Text>
                    <AppCard style={styles.card}>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Sick Leave Limit</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: errors.sickLeaveLimit ? colors.error : colors.border }]}
                                    value={sickLeaveLimit}
                                    onChangeText={(t) => { setSickLeaveLimit(t); if (errors.sickLeaveLimit) setErrors((e) => ({ ...e, sickLeaveLimit: undefined })); }}
                                    keyboardType="numeric"
                                    accessibilityLabel="Sick leave limit"
                                />
                                {!!errors.sickLeaveLimit && <Text style={[styles.errorText, { color: colors.error }]}>{errors.sickLeaveLimit}</Text>}
                            </View>
                            <View style={{ width: SPACING.md }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Casual Accrual (Days)</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: errors.casualLeaveAccrualDays ? colors.error : colors.border }]}
                                    value={casualLeaveAccrualDays}
                                    onChangeText={(t) => { setCasualLeaveAccrualDays(t); if (errors.casualLeaveAccrualDays) setErrors((e) => ({ ...e, casualLeaveAccrualDays: undefined })); }}
                                    keyboardType="numeric"
                                    accessibilityLabel="Casual leave accrual days"
                                />
                                {!!errors.casualLeaveAccrualDays && <Text style={[styles.errorText, { color: colors.error }]}>{errors.casualLeaveAccrualDays}</Text>}
                            </View>
                        </View>
                    </AppCard>

                    <AppButton
                        label="Save Changes"
                        onPress={handleSave}
                        loading={saving}
                        haptic="medium"
                        fullWidth
                        size="lg"
                        style={{ marginTop: SPACING.xxl }}
                    />
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.lg },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    title: { fontSize: 20, fontFamily: FONTS.bold },
    scrollContent: { padding: SPACING.lg, paddingBottom: 40 },
    sectionTitle: { fontSize: 16, fontFamily: FONTS.bold, marginTop: SPACING.xl, marginBottom: SPACING.md },
    card: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    label: { fontSize: 12, fontFamily: FONTS.semibold, marginBottom: 6 },
    input: { height: 44, borderRadius: BORDER_RADIUS.md, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
    row: { flexDirection: "row" },
    errorText: { fontSize: 12, fontFamily: FONTS.semibold, marginTop: 6 },
});
