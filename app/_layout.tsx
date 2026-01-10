import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { SnackbarProvider } from '../components/SnackbarContext';

import '../database';
import '../lang/lang';
import '../global.css';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SnackbarProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background.primary },
          }}
        />
      </SnackbarProvider>
    </SafeAreaProvider>
  );
}
