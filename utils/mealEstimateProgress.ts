// What an AI meal estimate is doing right now, reported by `trackMeal` and
// `estimateNutritionFromPhoto` (`utils/coachAI.ts`) as each step really starts. Pure and
// relative-import-only. A step is only reported when the code is about to do it, with the counts it
// actually has: never a paraphrase of the model's reasoning, never a percentage or countdown.

export type MealEstimateProgress =
  /** The first request is on its way: reading the description or looking at the photo. */
  | { step: 'reading'; photo: boolean }
  /**
   * A follow-up request estimates `count` ingredients that have no numbers yet: the ones the model
   * named without numbers, or matched to a food id this database does not have. `matched` is how
   * many were already found in the person's foods.
   */
  | { step: 'estimating'; count: number; matched: number }
  /** A follow-up request re-estimates `count` ingredients whose numbers did not add up. */
  | { step: 'rechecking'; count: number };

export type MealEstimateProgressListener = (progress: MealEstimateProgress) => void;

/** Whole keys, so `check-translations` sees every one. Plural keys take `count`. */
export const MEAL_ESTIMATE_PROGRESS_KEYS = {
  reading: 'food.aiProgress.reading',
  readingPhoto: 'food.aiProgress.readingPhoto',
  estimating: 'food.aiProgress.estimating',
  estimatingWithMatches: 'food.aiProgress.estimatingWithMatches',
  rechecking: 'food.aiProgress.rechecking',
} as const;

export type MealEstimateProgressLine = {
  key: (typeof MEAL_ESTIMATE_PROGRESS_KEYS)[keyof typeof MEAL_ESTIMATE_PROGRESS_KEYS];
  options?: { count: number; matched?: number };
};

/** The line a screen shows for a step: `t(line.key, line.options)`. */
export function mealEstimateProgressLine(progress: MealEstimateProgress): MealEstimateProgressLine {
  switch (progress.step) {
    case 'reading':
      return {
        key: progress.photo
          ? MEAL_ESTIMATE_PROGRESS_KEYS.readingPhoto
          : MEAL_ESTIMATE_PROGRESS_KEYS.reading,
      };
    case 'estimating':
      return progress.matched > 0
        ? {
            key: MEAL_ESTIMATE_PROGRESS_KEYS.estimatingWithMatches,
            options: { count: progress.count, matched: progress.matched },
          }
        : { key: MEAL_ESTIMATE_PROGRESS_KEYS.estimating, options: { count: progress.count } };
    case 'rechecking':
      return { key: MEAL_ESTIMATE_PROGRESS_KEYS.rechecking, options: { count: progress.count } };
  }
}
