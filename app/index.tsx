import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // If platform is web, redirect user to home.tsx
    if (Platform.OS === 'web' && !__DEV__) {
      router.replace('/home');
    }
  }, [router]);

  // Show loading state while redirecting on web platforms
  if (Platform.OS === 'web') {
    return null;
  }

  // TODO: cant we just do href={Platform.OS === 'web' && !__DEV__ ? '/home' : '/app'}?
  return <Redirect href="/app" />;
}
