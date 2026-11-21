import { Redirect, Stack, useSegments } from 'expo-router';
import { Platform } from 'react-native';

import { isProduction } from '@/utils/app';
import { isHarnessRouteAllowed } from '@/utils/premium/harnessGuard';

export default function TestRoutesLayout() {
  const segments = useSegments();
  const isScreenshotFixture =
    Platform.OS === 'web' &&
    process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1' &&
    segments.at(-1) === 'modals';

  // The onboarding AI-choice fixture, for the app-store captures only (same two conditions).
  const isAiChoiceFixture =
    Platform.OS === 'web' &&
    process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1' &&
    segments.at(-1) === 'ai-choice';

  const isPremiumHarness = isHarnessRouteAllowed({
    lastSegment: segments.at(-1),
    platform: Platform.OS,
    flag: process.env.EXPO_PUBLIC_PREMIUM_HARNESS,
  });

  if (isProduction() && !isScreenshotFixture && !isAiChoiceFixture && !isPremiumHarness) {
    return <Redirect href="/app" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
