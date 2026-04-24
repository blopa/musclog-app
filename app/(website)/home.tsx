import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // If platform is not web, redirect user to app/app/index.tsx
    if (Platform.OS !== 'web') {
      router.replace('/app');
    }
  }, [router]);

  // Show loading state while redirecting on non-web platforms
  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View>
      <Text>Hello world</Text>
    </View>
  );
}
