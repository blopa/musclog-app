import type { Router } from 'expo-router';

import { handleError } from '@/utils/handleError';
import { getCurrentOnboardingStep, isOnboardingCompleted } from '@/utils/onboardingService';

function normalizePath(path: string): string {
  const [pathname] = path.split('?');
  return pathname.replace(/\/+$/, '') || '/';
}

function replaceIfNeeded(router: Router, currentPath: string | undefined, targetPath: string) {
  if (currentPath && normalizePath(currentPath) === normalizePath(targetPath)) {
    return;
  }

  router.replace(targetPath as never);
}

export async function runEntryOnboardingRedirect(
  router: Router,
  errorContext: string,
  currentPath?: string
) {
  try {
    const completed = await isOnboardingCompleted();

    if (!completed) {
      try {
        const saved = await getCurrentOnboardingStep();
        if (saved) {
          const normalizedSaved = saved.startsWith('/app') ? saved : `/app${saved}`;
          replaceIfNeeded(router, currentPath, normalizedSaved);
        } else {
          replaceIfNeeded(router, currentPath, '/app/onboarding/landing');
        }
      } catch (error) {
        handleError(error, `${errorContext}.restoreOnboardingStep`);
        replaceIfNeeded(router, currentPath, '/app/onboarding/landing');
      }
    } else {
      replaceIfNeeded(router, currentPath, '/app');
    }
  } catch (error) {
    handleError(error, `${errorContext}.checkOnboardingStatus`);
    replaceIfNeeded(router, currentPath, '/app');
  }
}
