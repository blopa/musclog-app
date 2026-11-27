import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type MealEstimateReview,
  mealEstimateReview,
} from '@/components/camera/mealEstimateReview';
import type { CameraAiProcessing } from '@/components/camera/useCameraAiProcessing';
import { useEnergyUnit } from '@/hooks/useEnergyUnit';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { estimateNutritionFromPhoto } from '@/utils/coachMealEstimate';
import { readFileAsStringAsync } from '@/utils/file';
import { mealEstimateProgressLine } from '@/utils/mealEstimateProgress';
import type { MealPhotoContext } from '@/utils/mealPhotoContext';
import { showSnackbar } from '@/utils/snackbarService';

/** A photographed meal waiting for the person to confirm it. */
export type MealReview = MealEstimateReview & {
  /** The first photo of the meal, saved with it. */
  photoUri: string;
};

type Submission = {
  photos: string[];
  context?: MealPhotoContext;
  name?: string;
  onEstimate: (review: MealReview) => void;
  /** The reason an estimate failed, in the person's language. */
  onError: (message: string) => void;
  /** The estimate ended without a meal: it failed or was cancelled. */
  onFailure?: () => void;
};

/** Estimates one meal from its photos, as one camera AI request. */
export function useMealPhotoEstimate({ run, setProgress }: CameraAiProcessing) {
  const { t } = useTranslation();
  const { formatEnergyWithUnit } = useEnergyUnit();
  const { formatRoundedDecimal } = useFormatAppNumber();

  return useCallback(
    async ({ photos, context, name, onEstimate, onError, onFailure }: Submission) => {
      if (photos.length === 0) {
        return;
      }

      await run({
        timerName: 'SmartCamera.aiMealPhotos',
        logLabel: 'Error estimating meal photos',
        onError,
        onFinish: (outcome) => {
          if (outcome !== 'done') {
            onFailure?.();
          }
        },
        task: async ({ signal, config, timer }) => {
          const images = await Promise.all(
            photos.map((uri) =>
              readFileAsStringAsync(uri, { encoding: 'base64' } as { encoding: 'base64' })
            )
          );

          timer.mark('images-read');
          if (signal.aborted) {
            return null;
          }

          const result = await estimateNutritionFromPhoto(
            config,
            images.length === 1 ? images[0] : images,
            context,
            (progress) => setProgress(mealEstimateProgressLine(progress))
          );
          timer.mark('request');
          if (signal.aborted) {
            return null;
          }

          const review = mealEstimateReview(result, { name, fallback: t('meals.customMeal') });
          if (!review) {
            return t('food.aiCamera.aiAnalysisFailed');
          }

          const { meal } = review;

          showSnackbar(
            'success',
            t('food.aiCamera.analysisSuccess', {
              name: meal.name,
              kcal: formatEnergyWithUnit(meal.calories),
              protein: formatRoundedDecimal(meal.protein, 2),
              carbs: formatRoundedDecimal(meal.carbs, 2),
              fat: formatRoundedDecimal(meal.fat, 2),
            })
          );

          onEstimate({ ...review, photoUri: photos[0] });

          return null;
        },
      });
    },
    [run, setProgress, t, formatEnergyWithUnit, formatRoundedDecimal]
  );
}
