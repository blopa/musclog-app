import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type MealEstimateReview,
  mealEstimateReview,
} from '@/components/camera/mealEstimateReview';
import type { CameraAiProcessing } from '@/components/camera/useCameraAiProcessing';
import { trackMealFromVoice } from '@/utils/coachMealEstimate';
import { mealEstimateProgressLine } from '@/utils/mealEstimateProgress';

type Submission = {
  /** The spoken description of the meal. */
  transcript: string;
  onEstimate: (review: MealEstimateReview) => void;
  /** The reason an estimate failed, in the person's language. */
  onError: (message: string) => void;
  /** The estimate ended without a meal: it failed or was cancelled. */
  onFailure?: () => void;
};

/** Estimates one meal from what the person said, as one AI request at a time. */
export function useMealTextEstimate({ run, setProgress }: CameraAiProcessing) {
  const { t } = useTranslation();

  return useCallback(
    async ({ transcript, onEstimate, onError, onFailure }: Submission) => {
      await run({
        timerName: 'Voice.aiMealText',
        logLabel: 'Error estimating a spoken meal',
        onError,
        onFinish: (outcome) => {
          if (outcome !== 'done') {
            onFailure?.();
          }
        },
        task: async ({ signal, config }) => {
          // What was said stays out of the debug dump, on every request of the estimate.
          const result = await trackMealFromVoice(
            { ...config, redactDump: true },
            transcript,
            (progress) => setProgress(mealEstimateProgressLine(progress))
          );
          if (signal.aborted) {
            return null;
          }

          const review = mealEstimateReview(result, { fallback: t('meals.customMeal') });
          if (!review) {
            return t('food.aiCamera.aiAnalysisFailed');
          }

          onEstimate(review);

          return null;
        },
      });
    },
    [run, setProgress, t]
  );
}
