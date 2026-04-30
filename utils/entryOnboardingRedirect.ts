import type { Router } from 'expo-router';

import { handleError } from '@/utils/handleError';
import { getCurrentOnboardingStep, isOnboardingCompleted } from '@/utils/onboardingService';

export async function runEntryOnboardingRedirect(router: Router, errorContext: string) {
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
      } catch (error) {
        handleError(error, `${errorContext}.restoreOnboardingStep`);
        router.replace('/app/onboarding/landing');
      }
    } else {
      router.replace('/app');
    }
  } catch (error) {
    handleError(error, `${errorContext}.checkOnboardingStatus`);
    router.replace('/app');
  }
}
