import { type RefObject, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useEnergyUnit } from '@/hooks/useEnergyUnit';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { AiService } from '@/services/AiService';
import { describeAiError } from '@/utils/aiErrors';
import { estimateNutritionFromPhoto, type TrackMealIngredient } from '@/utils/coachAI';
import { readFileAsStringAsync } from '@/utils/file';
import {
  type MealEstimateProgressLine,
  mealEstimateProgressLine,
} from '@/utils/mealEstimateProgress';
import type { MealPhotoContext } from '@/utils/mealPhotoContext';
import { createPhaseTimer } from '@/utils/phaseTimer';
import { showSnackbar } from '@/utils/snackbarService';

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

  return useCallback(
    async ({ photos, context, name, onFailure }: Submission) => {
      if (abortRef.current || photos.length === 0) {
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setProcessing(true);
      setError(null);
      setProgress(null);
      const timer = createPhaseTimer('SmartCamera.aiMealPhotos');
      let outcome = 'done';
      let errorMessage: string | null = null;
      try {
        const images = await Promise.all(
          photos.map((uri) =>
            readFileAsStringAsync(uri, { encoding: 'base64' } as { encoding: 'base64' })
          )
        );
        timer.mark('images-read');
        const config = await AiService.getAiConfig();
        timer.mark('settings-read');
        if (controller.signal.aborted) {
          outcome = 'cancelled';
          return;
        }

        if (!config) {
          outcome = 'error';
          errorMessage = t('food.aiCamera.aiNotConfigured');
          return;
        }

        const result = await estimateNutritionFromPhoto(
          { ...config, signal: controller.signal },
          images.length === 1 ? images[0] : images,
          context,
          (progress) => setProgress(mealEstimateProgressLine(progress))
        );
        timer.mark('request');
        if (controller.signal.aborted) {
          outcome = 'cancelled';
          return;
        }

        const ingredients = result?.meals.flatMap((meal) => meal.ingredients) ?? [];
        if (!result || ingredients.length === 0) {
          outcome = 'error';
          errorMessage = t('food.aiCamera.aiAnalysisFailed');
          return;
        }

        const meal: Meal = {
          name:
            name?.trim() ||
            result.meals[0]?.mealName ||
            result.meals[0]?.mealType ||
            t('meals.customMeal'),
          type: t('meals.customMeal'),
          calories: ingredients.reduce((sum, item) => sum + item.kcal, 0),
          protein: ingredients.reduce((sum, item) => sum + item.protein, 0),
          carbs: ingredients.reduce((sum, item) => sum + item.carbs, 0),
          fat: ingredients.reduce((sum, item) => sum + item.fat, 0),
          grams: ingredients.reduce((sum, item) => sum + (item.grams || 0), 0),
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
      } catch (error) {
        outcome = controller.signal.aborted ? 'cancelled' : 'error';
        if (!controller.signal.aborted) {
          console.error('[SmartCamera] Error estimating meal photos:', error);
          errorMessage = describeAiError(error, t) ?? t('food.aiCamera.aiAnalysisFailed');
        }
      } finally {
        timer.log(outcome);
        abortRef.current = null;
        setProcessing(false);
        setProgress(null);
        if (outcome !== 'done') {
          setError(errorMessage);
          onFailure?.();
        }
      }
    },
    [
      abortRef,
      setProcessing,
      setProgress,
      setError,
      onSuccess,
      t,
      formatEnergyWithUnit,
      formatRoundedDecimal,
    ]
  );
}
