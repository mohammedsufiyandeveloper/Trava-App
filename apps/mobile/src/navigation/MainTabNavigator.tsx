import React, { useState, useCallback } from "react";
import { View, StyleSheet, Platform, TouchableOpacity, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useSharedValue, runOnJS } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { SPACING } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import HomeScreen from "../screens/HomeScreen";
import ProjectsScreen from "../screens/ProjectsScreen";
import AttendanceScreen from "../screens/AttendanceScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ProjectDetailScreen from "../screens/ProjectDetailScreen";
import ProjectSubTaskList from "../screens/project/ProjectSubTaskList";
import ProjectActivityScreen from "../screens/project/ProjectActivityScreen";
import TaskDetailScreen from "../screens/TaskDetailScreen";
import ManageTagsScreen from "../screens/ManageTagsScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import NotificationScreen from "../screens/NotificationScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RadialMenu from "../components/RadialMenu";
import CreateTaskModal from "../components/CreateTaskModal";
import CreateSubTaskModal from "../components/CreateSubTaskModal";
import CreateProjectModal from "../components/CreateProjectModal";
import CreateTagModal from "../components/CreateTagModal";
import MyBoardScreen from "../screens/MyBoardScreen";
import MyProfileScreen from "../screens/MyProfileScreen";
import TeamListScreen from "../screens/TeamListScreen";
import DirectChatScreen from "../screens/DirectChatScreen";
import LeaveScreen from "../screens/LeaveScreen";
import WorkspaceSettingsScreen from "../screens/WorkspaceSettingsScreen";
import AdminLeaveScreen from "../screens/AdminLeaveScreen";
import { MainTabParamList } from "../types";

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator();

import AIScreen from "../screens/AIScreen";
import ProcurementScreen from "../screens/ProcurementScreen";
import CreateIndentScreen from "../screens/CreateIndentScreen";
import IndentDetailScreen from "../screens/IndentDetailScreen";

const createTabStack = (BaseComponent: any, stackName?: string) => {
    return function TabStack() {
        return (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="_Base" component={BaseComponent} />
                <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen as any} />
                <Stack.Screen name="ProjectSubTasks" component={ProjectSubTaskList as any} />
                <Stack.Screen name="ProjectActivity" component={ProjectActivityScreen as any} />
                <Stack.Screen name="TaskDetail" component={TaskDetailScreen as any} />
                <Stack.Screen name="Notifications" component={NotificationScreen as any} />
                <Stack.Screen name="ManageTags" component={ManageTagsScreen as any} />
                <Stack.Screen name="ChangePassword" component={ChangePasswordScreen as any} />
                <Stack.Screen name="MyProfile" component={MyProfileScreen as any} />
                <Stack.Screen name="TeamList" component={TeamListScreen as any} />
                <Stack.Screen name="DirectChat" component={DirectChatScreen as any} />
                <Stack.Screen name="Attendance" component={AttendanceScreen as any} />
                <Stack.Screen name="Leave" component={LeaveScreen as any} />
                <Stack.Screen name="WorkspaceSettings" component={WorkspaceSettingsScreen as any} />
                <Stack.Screen name="AdminLeave" component={AdminLeaveScreen as any} />
                <Stack.Screen name="AI" component={AIScreen as any} />
                <Stack.Screen name="Procurement" component={ProcurementScreen as any} />
                <Stack.Screen name="CreateIndent" component={CreateIndentScreen as any} />
                <Stack.Screen name="IndentDetail" component={IndentDetailScreen as any} />
            </Stack.Navigator>
        );
    }
};

const HomeStack = createTabStack(HomeScreen, "Home");
const ProjectsStack = createTabStack(ProjectsScreen, "Projects");
const AttendanceStack = createTabStack(AttendanceScreen, "Attendance");
const MyTasksStack = createTabStack(MyBoardScreen, "MyTasks");
const ProfileStack = createTabStack(ProfileScreen, "Profile");

export default function MainTabNavigator() {
    const navigation = useNavigation();
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    // Calculate dynamic dimensions
    const isGestureNav = insets.bottom > 0;
    const barHeight = 65 + insets.bottom;

    // FAB position should be responsive to insets
    const fabBottom = isGestureNav ? insets.bottom + 12 : 12;

    const [menuVisible, setMenuVisible] = useState(false);
    const [menuType, setMenuType] = useState("list");
    const [createTaskVisible, setCreateTaskVisible] = useState(false);
    const [createSubTaskVisible, setCreateSubTaskVisible] = useState(false);
    const [createProjectVisible, setCreateProjectVisible] = useState(false);
    const [createTagVisible, setCreateTagVisible] = useState(false);

    const triggerHaptic = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const openMenu = useCallback(() => {
        setMenuType("speed-dial");
        setMenuVisible(true);
        triggerHaptic();
    }, []);

    const handleAction = useCallback((id: string) => {
        console.log("Action triggered:", id);
        setMenuVisible(false);
        if (id === "task") {
            setCreateTaskVisible(true);
        } else if (id === "subtask") {
            setCreateSubTaskVisible(true);
        } else if (id === "project") {
            setCreateProjectVisible(true);
        } else if (id === "tag") {
            setCreateTagVisible(true);
        } else if (id === "attendance") {
            (navigation as any).navigate("Attendance");
        } else if (id === "ai") {
            (navigation as any).navigate("AI");
        }
    }, [navigation]);

    const renderTabBar = useCallback(({ state, descriptors, navigation }: any) => {
        const routes = state.routes;
        const barBgColor = isDark ? "#121212" : "#FFFFFF";

        return (
            <View style={{
                flexDirection: 'row',
                height: 65 + insets.bottom,
                backgroundColor: barBgColor,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                alignItems: 'center',
                paddingBottom: insets.bottom,
                paddingHorizontal: 12,
                gap: 12,
            }}>
                {/* Main Navigation Pill Segment */}
                <View style={{
                    flex: 1,
                    flexDirection: 'row',
                    backgroundColor: isDark ? "#1a1a1a" : "#f3f4f6",
                    height: 52,
                    borderRadius: 26,
                    padding: 4,
                }}>
                    {routes.map((route: any, index: number) => {
                        const isFocused = state.index === index;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });
                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name, { screen: "_Base" });
                            }
                        };

                        const color = isFocused ? colors.primary : colors.textDim;
                        let iconName = "help-outline";
                        let displayLabel = route.name;

                        if (route.name === "Home") iconName = isFocused ? "home" : "home-outline";
                        else if (route.name === "Projects") iconName = isFocused ? "briefcase" : "briefcase-outline";
                        else if (route.name === "MyTasks") {
                            iconName = isFocused ? "list" : "list-outline";
                            displayLabel = "Tasks";
                        }
                        else if (route.name === "Profile") iconName = isFocused ? "person" : "person-outline";

                        return (
                            <TouchableOpacity
                                key={route.key}
                                onPress={onPress}
                                style={{
                                    flex: 1,
                                    borderRadius: 22,
                                    backgroundColor: isFocused ? (isDark ? "#262626" : "#FFFFFF") : 'transparent',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    // The Zoom Effect
                                    transform: [{ scale: isFocused ? 1.1 : 1 }],
                                    // The "Front" Effect (Shadows/Elevation)
                                    ...(isFocused && {
                                        shadowColor: isDark ? "#000" : colors.primary,
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: isDark ? 0.4 : 0.15,
                                        shadowRadius: 8,
                                        elevation: 6,
                                    })
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={iconName as any}
                                    size={isFocused ? 24 : 20}
                                    color={color}
                                />
                                <Text style={{
                                    fontSize: isFocused ? 10 : 9,
                                    fontWeight: isFocused ? "800" : "500",
                                    color,
                                    marginTop: 1
                                }}>
                                    {displayLabel}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Separate Create Circle */}
                <TouchableOpacity
                    onPress={openMenu}
                    activeOpacity={0.8}
                    style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        backgroundColor: isDark ? "#1a1a1a" : "#f3f4f6",
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: isDark ? "#262626" : "#e5e7eb",
                    }}
                >
                    <Ionicons name="add" size={28} color={colors.primary} />
                </TouchableOpacity>
            </View>
        );
    }, [colors, isDark, insets.bottom, openMenu]);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
                <Tab.Navigator
                    screenOptions={() => ({ headerShown: false, tabBarHideOnKeyboard: true })}
                    tabBar={renderTabBar}
                >
                    <Tab.Screen name="Home" component={HomeStack as any} />
                    <Tab.Screen name="Projects" component={ProjectsStack as any} />
                    <Tab.Screen name="MyTasks" component={MyTasksStack as any} />
                    <Tab.Screen name="Profile" component={ProfileStack as any} />
                </Tab.Navigator>

                <RadialMenu
                    visible={menuVisible}
                    type={menuType}
                    onClose={() => setMenuVisible(false)}
                    onAction={handleAction}
                />

                <CreateTaskModal
                    visible={createTaskVisible}
                    onClose={() => setCreateTaskVisible(false)}
                />

                <CreateSubTaskModal
                    visible={createSubTaskVisible}
                    onClose={() => setCreateSubTaskVisible(false)}
                />

                <CreateProjectModal
                    visible={createProjectVisible}
                    onClose={() => setCreateProjectVisible(false)}
                />

                <CreateTagModal
                    visible={createTagVisible}
                    onClose={() => setCreateTagVisible(false)}
                />
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    fabContainer: {
        justifyContent: "center",
        alignItems: "center",
        width: 70,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: "center",
        alignItems: "center",
        ...Platform.select({
            ios: {
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
            },
            android: {
                elevation: 10,
            },
        }),
        borderWidth: 4,
    },
});
