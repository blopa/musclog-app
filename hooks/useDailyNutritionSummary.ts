import { useMemo } from 'react';

import { useCurrentNutritionGoal } from './useCurrentNutritionGoal';
import { useNutritionLogs } from './useNutritionLogs';

export interface UseDailyNutritionSummaryParams {
  date: Date;
  enableReactivity?: boolean;
  visible?: boolean;
}

/**
 * Consolidates daily nutrition data fetching and computes calories/macros
 * with consistent Math.round rounding for both home and food screens.
 */
export function useDailyNutritionSummary({
  date,
  enableReactivity,
  visible,
}: UseDailyNutritionSummaryParams) {
  const { goal: nutritionGoal, isLoading: isLoadingGoal } = useCurrentNutritionGoal({
    mode: 'current',
    date,
    enableReactivity,
    visible,
  });

  const {
    logs,
    dailyNutrients,
    isLoading: isLoadingNutrition,
    refresh,
    totalCount,
  } = useNutritionLogs({
    mode: 'daily',
    date,
    enableReactivity,
    visible,
  });

  const calories = useMemo(() => {
    const goal = nutritionGoal?.totalCalories ?? 0;
    const consumed = Math.round(dailyNutrients.calories);
    const remaining = Math.max(0, goal - consumed);
    return { consumed, remaining, goal };
  }, [nutritionGoal, dailyNutrients]);

  const macros = useMemo(
    () => ({
      protein: {
        value: Math.round(dailyNutrients.protein),
        goal: nutritionGoal?.protein ?? 0,
      },
      carbs: {
        value: Math.round(dailyNutrients.carbs),
        goal: nutritionGoal?.carbs ?? 0,
      },
      fat: {
        value: Math.round(dailyNutrients.fat),
        goal: nutritionGoal?.fats ?? 0,
      },
    }),
    [dailyNutrients, nutritionGoal]
  );

  return {
    calories,
    macros,
    nutritionGoal,
    dailyNutrients,
    logs,
    totalCount,
    refresh,
    isLoading: isLoadingGoal || isLoadingNutrition,
  };
}
