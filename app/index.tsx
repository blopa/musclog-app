import { Redirect, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { handleError } from '@/utils/handleError';
import { getCurrentOnboardingStep, isOnboardingCompleted } from '@/utils/onboardingService';

export default function Index() {
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (Platform.OS === 'web' && !__DEV__) {
      return;
    }

    if (!navigationState?.key) {
      return;
    }

    const checkOnboarding = async () => {
      try {
        const completed = await isOnboardingCompleted();

        if (!completed) {
          try {
            const saved = await getCurrentOnboardingStep();
            if (saved) {
              if (saved === '/app/onboarding/connect-with-google') {
                router.replace('/app/onboarding/fitness-info');
              } else {
                const normalizedSaved = saved.startsWith('/app') ? saved : `/app${saved}`;
                router.replace(normalizedSaved as never);
              }
            } else {
              router.replace('/app/onboarding/landing');
            }
          } catch (e) {
            handleError(e, 'index.restoreOnboardingStep');
            router.replace('/app/onboarding/landing');
          }
        } else {
          router.replace('/app');
        }
      } catch (error) {
        handleError(error, 'index.checkOnboardingStatus');
        router.replace('/app');
      }
    };

    checkOnboarding();
  }, [navigationState?.key, router]);

  if (Platform.OS === 'web' && !__DEV__) {
    return <Redirect href="/home" />;
  }

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#0a1f1a' }}>
      <ActivityIndicator size="large" color="#4EDEA3" />
    </View>
  );
}
