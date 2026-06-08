import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList, UserProfile } from "../types";
import { useTheme } from "../context/ThemeContext";
import { getProfile, updateProfile } from "../services/api";
import { SPACING, BORDER_RADIUS } from "../constants/theme";
import { useResponsive } from "../hooks/useResponsive";

type Props = NativeStackScreenProps<RootStackParamList, "MyProfile">;

export default function MyProfileScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { MAX_CONTENT_WIDTH, value } = useResponsive();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    // Form states
    const [name, setName] = useState("");
    const [surname, setSurname] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [image, setImage] = useState("");

    const fetchProfileData = async () => {
        setLoading(true);
        const data = await getProfile();
        console.log("[DEBUG] MyProfileScreen Received Data:", JSON.stringify(data));
        if (data?.success) {
            setProfile(data);
            setName(data.user.name || "");
            setSurname(data.user.surname || "");
            setPhoneNumber(data.user.phoneNumber || "");
            setImage(data.user.image || "");
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchProfileData();
    }, []);

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("Error", "Name is required");
            return;
        }

        setSaving(true);
        try {
            const result = await updateProfile({
                name,
                surname,
                image
            });

            if (result.success) {
                Alert.alert("Success", "Profile updated successfully");
                fetchProfileData(); // Refresh UI
            }
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };


    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            <View style={{ flex: 1, maxWidth: MAX_CONTENT_WIDTH, width: '100%', alignSelf: 'center' }}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border, paddingHorizontal: value(16, SPACING.xl, SPACING.xxl) }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>My Profile</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                    {/* Centered Avatar Section */}
                    <View style={styles.avatarSection}>
                        <View style={[styles.avatarContainer, { borderColor: colors.primary }]}>
                            {image ? (
                                <Image source={{ uri: image }} style={styles.avatarImage} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                                    <Text style={styles.avatarText}>
                                        {(surname || "?").charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.profileName, { color: colors.text }]}>{surname}</Text>
                    </View>


                    {/* Forms */}
                    <View style={styles.formContainer}>
                        <Text style={[styles.sectionTitle, { color: colors.textDim }]}>PERSONAL IDENTITY</Text>

                        <View style={[styles.formGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.inputItem}>
                                <Text style={[styles.inputLabel, { color: colors.textDim }]}>First Name</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.textDim }]}
                                    value={name}
                                    editable={false}
                                />
                                <Ionicons name="lock-closed" size={14} color={colors.textDim} style={{ position: "absolute", right: 16, bottom: 12 }} />
                            </View>
                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            <View style={styles.inputItem}>
                                <Text style={[styles.inputLabel, { color: colors.textDim }]}>Surname</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.textDim }]}
                                    value={surname}
                                    editable={false}
                                />
                                <Ionicons name="lock-closed" size={14} color={colors.textDim} style={{ position: "absolute", right: 16, bottom: 12 }} />
                            </View>
                        </View>

                        <Text style={[styles.sectionTitle, { color: colors.textDim, marginTop: 24 }]}>CONTACT INFORMATION</Text>
                        <View style={[styles.formGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.inputItem}>
                                <Text style={[styles.inputLabel, { color: colors.textDim }]}>Email Address</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.textDim }]}
                                    value={profile?.user.email}
                                    editable={false}
                                />
                                <Ionicons name="lock-closed" size={14} color={colors.textDim} style={{ position: "absolute", right: 16, bottom: 12 }} />
                            </View>
                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            <View style={styles.inputItem}>
                                <Text style={[styles.inputLabel, { color: colors.textDim }]}>Phone Number</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.textDim }]}
                                    value={phoneNumber}
                                    editable={false}
                                    placeholder="Add phone number"
                                    placeholderTextColor={colors.textDim + "80"}
                                    keyboardType="phone-pad"
                                />
                                <Ionicons name="lock-closed" size={14} color={colors.textDim} style={{ position: "absolute", right: 16, bottom: 12 }} />
                            </View>
                        </View>

                        <Text style={[styles.sectionTitle, { color: colors.textDim, marginTop: 24 }]}>SECURITY</Text>
                        <View style={[styles.formGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => navigation.navigate("ChangePassword")}
                                activeOpacity={0.7}
                            >
                                <View style={styles.menuLeft}>
                                    <View style={[styles.iconBox, { backgroundColor: "#8b5cf615" }]}>
                                        <Ionicons name="key-outline" size={18} color="#8b5cf6" />
                                    </View>
                                    <Text style={[styles.menuLabel, { color: colors.text }]}>Change Password</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                            </TouchableOpacity>
                        </View>

                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    headerTitle: { fontSize: 18, fontWeight: "700" },
    saveHeaderBtn: { paddingHorizontal: 12, paddingVertical: 6 },
    saveHeaderText: { fontSize: 16, fontWeight: "600" },
    scrollContent: { paddingBottom: SPACING.bottomTabBar },

    avatarSection: { alignItems: "center", marginTop: 24 },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        padding: 3,
        position: "relative",
        marginBottom: 16,
    },
    avatarPlaceholder: {
        width: "100%",
        height: "100%",
        borderRadius: 47,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarImage: {
        width: "100%",
        height: "100%",
        borderRadius: 47,
    },
    avatarText: { color: "#fff", fontSize: 40, fontWeight: "700" },
    editBadge: {
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: "#fff",
    },
    profileName: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
    profileRole: { fontSize: 14, fontWeight: "500", opacity: 0.7 },


    formContainer: { paddingHorizontal: SPACING.lg, marginTop: 32 },
    sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
    formGroup: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, overflow: "hidden" },
    inputItem: { paddingHorizontal: 16, paddingVertical: 12 },
    inputLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
    input: { fontSize: 16, padding: 0, height: 24 },
    divider: { height: 1, width: "100%" },
    menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
    menuLeft: { flexDirection: "row", alignItems: "center" },
    iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    menuLabel: { marginLeft: 12, fontSize: 15, fontWeight: "500" },
});
