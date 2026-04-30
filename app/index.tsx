import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { getCurrentOnboardingStep, isOnboardingCompleted } from '@/utils/onboardingService';

export default function Index() {
  const theme = useTheme();
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && !__DEV__) {
      setTarget('/home');
      return;
    }

    const checkOnboarding = async () => {
      try {
        const completed = await isOnboardingCompleted();

        if (completed) {
          setTarget('/app');
        } else {
          const saved = await getCurrentOnboardingStep();
          if (saved) {
            if (saved === '/app/onboarding/connect-with-google') {
              setTarget('/app/onboarding/fitness-info');
            } else {
              const normalizedSaved = saved.startsWith('/app') ? saved : `/app${saved}`;
              setTarget(normalizedSaved);
            }
          } else {
            setTarget('/app/onboarding/landing');
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status in root index:', error);
        setTarget('/app/onboarding/landing');
      }
    };

    checkOnboarding();
  }, []);

  if (!target) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.colors.background.primary }}
      >
        <ActivityIndicator size="large" color={theme.colors.accent.primary} />
      </View>
    );
  }

  return <Redirect href={target as any} />;
}
