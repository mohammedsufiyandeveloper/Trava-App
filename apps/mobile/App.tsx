import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/context/ThemeContext';
import { WorkspaceProvider } from './src/context/WorkspaceContext';
import { NotificationProvider } from './src/context/NotificationContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <WorkspaceProvider>
          <NotificationProvider>
            <AppNavigator />
          </NotificationProvider>
        </WorkspaceProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
