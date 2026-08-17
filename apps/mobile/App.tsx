import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider } from './src/context/ThemeContext';
import { WorkspaceProvider } from './src/context/WorkspaceContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ToastProvider } from './src/context/ToastContext';
import { initHaptics } from './src/services/haptics';
import AppNavigator from './src/navigation/AppNavigator';

// Hold the splash screen until Plus Jakarta Sans is ready, so the UI never
// flashes in the system font first.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* already hidden — safe to ignore */
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    // Hydrate the persisted "haptics enabled" preference once at startup.
    initHaptics();
  }, []);

  const onLayoutRootView = useCallback(() => {
    // Font failure is not fatal — fall through to the system font rather than
    // leaving the user stuck on the splash screen.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => { });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <WorkspaceProvider>
              <NotificationProvider>
                <AppNavigator />
              </NotificationProvider>
            </WorkspaceProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </View>
  );
}
