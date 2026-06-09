import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeContext';
import { WorkspaceProvider } from './src/context/WorkspaceContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ToastProvider } from './src/context/ToastContext';
import { initHaptics } from './src/services/haptics';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    // Hydrate the persisted "haptics enabled" preference once at startup.
    initHaptics();
  }, []);

  return (
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
  );
}
