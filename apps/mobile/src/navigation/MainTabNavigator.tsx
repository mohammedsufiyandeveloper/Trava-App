import React, { useState, useCallback } from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import AnimatedTabBar from "./AnimatedTabBar";
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
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    animation: "slide_from_right",
                    gestureEnabled: true,
                }}
            >
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

    const [menuVisible, setMenuVisible] = useState(false);
    const [menuType, setMenuType] = useState("list");
    const [createTaskVisible, setCreateTaskVisible] = useState(false);
    const [createSubTaskVisible, setCreateSubTaskVisible] = useState(false);
    const [createProjectVisible, setCreateProjectVisible] = useState(false);
    const [createTagVisible, setCreateTagVisible] = useState(false);

    const openMenu = useCallback(() => {
        // Haptic is fired by the FAB's PressableScale (haptic="medium").
        setMenuType("speed-dial");
        setMenuVisible(true);
    }, []);

    const handleAction = useCallback((id: string) => {
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

    const renderTabBar = useCallback(({ state, navigation }: any) => (
        <AnimatedTabBar state={state} navigation={navigation} onOpenMenu={openMenu} />
    ), [openMenu]);

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
