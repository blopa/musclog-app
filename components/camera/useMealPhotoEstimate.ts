import { type RefObject, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useCameraAiProcessing } from '@/components/camera/useCameraAiProcessing';
import { useEnergyUnit } from '@/hooks/useEnergyUnit';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import type { TrackMealIngredient } from '@/utils/coachAI';
import { estimateNutritionFromPhoto } from '@/utils/coachMealEstimate';
import { readFileAsStringAsync } from '@/utils/file';
import {
  type MealEstimateProgressLine,
  mealEstimateProgressLine,
} from '@/utils/mealEstimateProgress';
import type { MealPhotoContext } from '@/utils/mealPhotoContext';
import { showSnackbar } from '@/utils/snackbarService';
import { trackedMealTotals } from '@/utils/trackedMealTotals';

type Meal = {
  name: string;
  type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
};

type Options = {
  abortRef: RefObject<AbortController | null>;
  setProcessing: (value: boolean) => void;
  setProgress: (value: MealEstimateProgressLine | null) => void;
  setError: (value: string | null) => void;
  onSuccess: (meal: Meal, ingredients: TrackMealIngredient[], photo: string) => void;
};

type Submission = {
  photos: string[];
  context?: MealPhotoContext;
  name?: string;
  onFailure?: () => void;
};

export function useMealPhotoEstimate({
  abortRef,
  setProcessing,
  setProgress,
  setError,
  onSuccess,
}: Options) {
  const { t } = useTranslation();
  const { formatEnergyWithUnit } = useEnergyUnit();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const runCameraAiTask = useCameraAiProcessing({
    abortRef,
    setProcessing,
    setProgress,
    setError,
  });

  return useCallback(
    async ({ photos, context, name, onFailure }: Submission) => {
      if (photos.length === 0) {
        return;
      }

      await runCameraAiTask({
        timerName: 'SmartCamera.aiMealPhotos',
        logLabel: 'Error estimating meal photos',
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

          const totals = trackedMealTotals(ingredients);
          const meal: Meal = {
            name:
              name?.trim() ||
              result.meals[0]?.mealName ||
              result.meals[0]?.mealType ||
              t('meals.customMeal'),
            type: t('meals.customMeal'),
            // Totals as the diary stores them: estimated carbs are net, so fiber is added.
            calories: totals.calories,
            protein: totals.protein,
            carbs: totals.carbs,
            fat: totals.fat,
            grams: totals.grams,
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

          onSuccess(meal, ingredients, photos[0]);

          return null;
        },
      });
    },
    [runCameraAiTask, setProgress, onSuccess, t, formatEnergyWithUnit, formatRoundedDecimal]
  );
}
