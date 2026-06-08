import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { getWorkspaceSettings, updateWorkspaceSettings } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";

export default function WorkspaceSettingsScreen({ navigation }: any) {
    const { colors } = useTheme();
    const { activeWorkspace } = useWorkspace();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<any>(null);

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

    const handleSave = async () => {
        if (!activeWorkspace?.id) return;
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
            Alert.alert("Success", "Workspace settings updated successfully.");
            navigation.goBack();
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update settings");
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
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>Workspace Settings</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: value(SPACING.lg, SPACING.xl, SPACING.xxl) }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>General</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Text style={[styles.label, { color: colors.textDim }]}>Workspace Name</Text>
                        <TextInput 
                            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Attendance Thresholds</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Late Threshold (HH:mm)</Text>
                                <TextInput 
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={lateThreshold}
                                    onChangeText={setLateThreshold}
                                    placeholder="09:40"
                                />
                            </View>
                            <View style={{ width: SPACING.md }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Overtime (HH:mm)</Text>
                                <TextInput 
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={overtimeThreshold}
                                    onChangeText={setOvertimeThreshold}
                                    placeholder="07:00"
                                />
                            </View>
                        </View>

                        <View style={[styles.row, { marginTop: SPACING.md }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Half Day (HH:mm)</Text>
                                <TextInput 
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={halfDayThreshold}
                                    onChangeText={setHalfDayThreshold}
                                    placeholder="23:00"
                                />
                            </View>
                            <View style={{ flex: 1 }} />
                        </View>
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Shift Timing</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Start Time</Text>
                                <TextInput 
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={shiftStartTime}
                                    onChangeText={setShiftStartTime}
                                />
                            </View>
                            <View style={{ width: SPACING.md }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>End Time</Text>
                                <TextInput 
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={shiftEndTime}
                                    onChangeText={setShiftEndTime}
                                />
                            </View>
                        </View>
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Leave Policies</Text>
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Sick Leave Limit</Text>
                                <TextInput 
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={sickLeaveLimit}
                                    onChangeText={setSickLeaveLimit}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ width: SPACING.md }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: colors.textDim }]}>Casual Accrual (Days)</Text>
                                <TextInput 
                                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                    value={casualLeaveAccrualDays}
                                    onChangeText={setCasualLeaveAccrualDays}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                    </TouchableOpacity>
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
    title: { fontSize: 20, fontWeight: "700" },
    scrollContent: { padding: SPACING.lg, paddingBottom: 40 },
    sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: SPACING.xl, marginBottom: SPACING.md },
    card: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
    label: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
    input: { height: 44, borderRadius: BORDER_RADIUS.md, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
    row: { flexDirection: "row" },
    saveBtn: { marginTop: SPACING.xxl, height: 52, borderRadius: BORDER_RADIUS.lg, justifyContent: "center", alignItems: "center" },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
