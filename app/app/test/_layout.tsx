import { Redirect, Stack, useSegments } from 'expo-router';
import { Platform } from 'react-native';

import { isProduction } from '@/utils/app';

export default function TestRoutesLayout() {
  const segments = useSegments();
  const isScreenshotFixture =
    Platform.OS === 'web' &&
    process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1' &&
    segments.at(-1) === 'modals';

  if (isProduction() && !isScreenshotFixture) {
    return <Redirect href="/app" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
