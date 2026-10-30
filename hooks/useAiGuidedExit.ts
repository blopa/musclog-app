import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { stageAnswersForGuided } from '@/services/onboardingAnswersApply';
import type { AiOnboardingMode } from '@/utils/aiOnboarding/draftStorage';
import { handleError } from '@/utils/handleError';
import { PROFILE_ROUTE } from '@/utils/onboardingRoutes';

import type { AiOnboardingDraftApi } from './useAiOnboardingDraft';

/** The first guided screen after the AI setup: the same one the Personalized setup starts on. */
export const GUIDED_START_ROUTE = '/app/onboarding/personalized-preferences';

/**
 * "Do this with forms instead", available from every AI-setup screen. In onboarding it hands
 * whatever has been answered, and any provider already chosen, to the guided screens so each opens
 * prefilled, then drops the AI session. From the profile it simply goes back: the profile already
 * has its own editor. Either way the person is never stuck in the AI flow.
 */
export function useAiGuidedExit(
  mode: AiOnboardingMode,
  draftApi: Pick<AiOnboardingDraftApi, 'draft' | 'hasSaved' | 'discard'>
): () => Promise<void> {
  const router = useRouter();
  const { draft, hasSaved, discard } = draftApi;

  return useCallback(async () => {
    if (mode === 'profile') {
      router.replace(PROFILE_ROUTE as never);
      return;
    }

    try {
      if (draft && (hasSaved || Object.keys(draft.answers).length > 0 || draft.skipMusclogApi)) {
        await stageAnswersForGuided(draft.answers, { skipMusclogApi: draft.skipMusclogApi });
        discard();
      }
    } catch (error) {
      // The forms still open, just without the carried-over answers.
      handleError(error, 'useAiGuidedExit');
    }

    router.replace(GUIDED_START_ROUTE as never);
  }, [mode, draft, hasSaved, discard, router]);
}
