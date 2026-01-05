import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../lang/lang';
import '../global.css';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0a1f1a' },
        }}
      />
    </SafeAreaProvider>
  );
}
