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
  const {
    goal: nutritionGoal,
    resolvedMacros,
    isLoading: isLoadingGoal,
  } = useCurrentNutritionGoal({
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
    const goal = resolvedMacros?.totalCalories ?? nutritionGoal?.totalCalories ?? 0;
    const consumed = Math.round(dailyNutrients.calories);
    const remaining = goal - consumed;
    return { consumed, remaining, goal };
  }, [nutritionGoal, resolvedMacros, dailyNutrients]);

  const macros = useMemo(
    () => ({
      protein: {
        value: Math.round(dailyNutrients.protein),
        goal: resolvedMacros?.protein ?? nutritionGoal?.protein ?? 0,
      },
      carbs: {
        value: Math.round(dailyNutrients.carbs),
        goal: resolvedMacros?.carbs ?? nutritionGoal?.carbs ?? 0,
      },
      fat: {
        value: Math.round(dailyNutrients.fat),
        goal: resolvedMacros?.fats ?? nutritionGoal?.fats ?? 0,
      },
      fiber: {
        value: Math.round(dailyNutrients.fiber),
        goal: resolvedMacros?.fiber ?? nutritionGoal?.fiber ?? 0,
      },
    }),
    [dailyNutrients, nutritionGoal, resolvedMacros]
  );

  const secondaryNutrients = useMemo(
    () => ({
      alcohol: Math.round(dailyNutrients.alcohol),
    }),
    [dailyNutrients]
  );

  return {
    calories,
    macros,
    secondaryNutrients,
    nutritionGoal,
    resolvedMacros,
    dailyNutrients,
    logs,
    totalCount,
    refresh,
    isLoading: isLoadingGoal || isLoadingNutrition,
  };
}
