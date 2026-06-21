import { Redirect, Stack } from 'expo-router';

import { isProduction } from '@/utils/app';

export default function TestRoutesLayout() {
  if (isProduction()) {
    return <Redirect href="/app" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
