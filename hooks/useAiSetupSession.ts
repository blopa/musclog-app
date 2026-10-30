import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { AI_SETUP_COPY } from '@/utils/aiOnboarding/modeCopy';
import { aiSetupRoute, type AiSetupScreen, resolveAiSetupMode } from '@/utils/onboardingRoutes';

import { useAiGuidedExit } from './useAiGuidedExit';
import { useAiOnboardingDraft } from './useAiOnboardingDraft';

/**
 * What every AI-setup screen starts from: the mode in the route, the saved session for it, the way
 * out to the forms, the mode's wording and a typed way to move between the setup screens. The route
 * helper returns a plain string, so the one cast that expo-router's typed routes need lives here.
 */
export function useAiSetupSession() {
  const router = useRouter();
  const mode = resolveAiSetupMode(useLocalSearchParams<{ mode?: string }>().mode);
  const draftApi = useAiOnboardingDraft(mode);
  const goGuided = useAiGuidedExit(mode, draftApi);

  const go = useCallback(
    (screen: AiSetupScreen, params?: Record<string, string>) => {
      router.navigate(aiSetupRoute(screen, mode, params) as never);
    },
    [router, mode]
  );

  return { mode, isProfile: mode === 'profile', copy: AI_SETUP_COPY[mode], draftApi, goGuided, go };
}

export type AiSetupSession = ReturnType<typeof useAiSetupSession>;
