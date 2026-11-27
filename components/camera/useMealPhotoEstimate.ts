import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { CameraAiProcessing } from '@/components/camera/useCameraAiProcessing';
import { useEnergyUnit } from '@/hooks/useEnergyUnit';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import type { TrackMealIngredient } from '@/utils/coachAI';
import { estimateNutritionFromPhoto } from '@/utils/coachMealEstimate';
import { readFileAsStringAsync } from '@/utils/file';
import { mealEstimateProgressLine } from '@/utils/mealEstimateProgress';
import type { MealPhotoContext } from '@/utils/mealPhotoContext';
import { showSnackbar } from '@/utils/snackbarService';
import { trackedMealTotals } from '@/utils/trackedMealTotals';

/** An estimated meal waiting for the person to confirm it. */
export type MealReview = {
  /** Totals as the diary will store them. */
  meal: ReturnType<typeof trackedMealTotals> & { name: string; type: string };
  ingredients: TrackMealIngredient[];
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

          const ingredients = result?.meals.flatMap((meal) => meal.ingredients) ?? [];
          if (!result || ingredients.length === 0) {
            return t('food.aiCamera.aiAnalysisFailed');
          }

          const meal: MealReview['meal'] = {
            ...trackedMealTotals(ingredients),
            name:
              name?.trim() ||
              result.meals[0]?.mealName ||
              result.meals[0]?.mealType ||
              t('meals.customMeal'),
            type: t('meals.customMeal'),
          };

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

          onEstimate({ meal, ingredients, photoUri: photos[0] });

          return null;
        },
      });
    },
    [run, setProgress, t, formatEnergyWithUnit, formatRoundedDecimal]
  );
}
