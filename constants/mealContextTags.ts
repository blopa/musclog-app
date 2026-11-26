export type MealContextTag = {
  id: string;
  labelKey: string;
};

export const MEAL_CONTEXT_TAGS: readonly MealContextTag[] = [
  { id: 'highProtein', labelKey: 'food.aiNutritionContext.quickTagHighProtein' },
  { id: 'lowCarb', labelKey: 'food.aiNutritionContext.quickTagLowCarb' },
  { id: 'largeServing', labelKey: 'food.aiNutritionContext.quickTagLargeServing' },
  { id: 'eatingOut', labelKey: 'food.aiNutritionContext.quickTagEatingOut' },
  { id: 'vegan', labelKey: 'food.aiNutritionContext.quickTagVegan' },
];
