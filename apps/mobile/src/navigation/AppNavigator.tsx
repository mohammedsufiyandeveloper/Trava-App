import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";


import SignIn from "../screens/SignInScreen";
import SignUp from "../screens/SignUpScreen";
import MainTabs from "./MainTabNavigator";
import { useTheme } from "../context/ThemeContext";
import { getSession, getCachedSession } from "../services/api";
import { RootStackParamList } from "../types";

import { navigationRef } from "./navigationRef";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
    const { colors } = useTheme();

    useEffect(() => {
        (async () => {
            // Fast path: if we have a cached session, trust it and go to Main immediately
            const cached = await getCachedSession();
            if (cached?.user) {
                setInitialRoute("Main");
                // Validate in background
                getSession().catch(err => {
                    console.error("[AppNavigator] Background validation error:", err);
                });
                return;
            }
            // No cache: do a network check
            const live = await getSession();
            setInitialRoute(live ? "Main" : "SignIn");
        })();
    }, []);

    // Splash-style loader while checking session
    if (initialRoute === null) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
                initialRouteName={initialRoute}
                screenOptions={{ headerShown: false, animation: "fade" }}
            >

                <Stack.Screen name="SignIn" component={SignIn as any} />
                <Stack.Screen name="SignUp" component={SignUp as any} />
                <Stack.Screen name="Main" component={MainTabs as any} />
                <Stack.Screen name="TaskDetail" component={require("../screens/TaskDetailScreen").default as any} />
                <Stack.Screen name="MySpace" component={require("../screens/MySpaceScreen").default as any} />
                <Stack.Screen name="DirectChat" component={require("../screens/DirectChatScreen").default as any} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
