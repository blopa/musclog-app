// What an AI meal estimate is doing right now, reported by `trackMeal` and
// `estimateNutritionFromPhoto` (`utils/coachAI.ts`) as each step really starts. Pure and
// relative-import-only. A step is only reported when the code is about to do it, with the counts it
// actually has: never a paraphrase of the model's reasoning, never a percentage or countdown.

export type MealEstimateProgress =
  /**
   * The first request is on its way: reading the description or looking at the photo.
   * `photoCount` is how many photos of the meal it carries (more than one: "these 3 photos").
   */
  | { step: 'reading'; photo: boolean; photoCount?: number }
  /** A first look at the description or photo notes what is in the meal before anything is estimated (Tokenmaxxing). */
  | { step: 'observing'; photo: boolean; photoCount?: number }
  /**
   * The on-device model looks at one photo at a time: photo `index` (1-based) of `count`. Only
   * reported when there is more than one photo.
   */
  | { step: 'identifying'; index: number; count: number }
  /**
   * A follow-up request estimates `count` ingredients that have no numbers yet: the ones the model
   * named without numbers, or matched to a food id this database does not have. `matched` is how
   * many were already found in the person's foods.
   */
  | { step: 'estimating'; count: number; matched: number }
  /** A follow-up request re-estimates `count` ingredients whose numbers did not add up. */
  | { step: 'rechecking'; count: number }
  /** A review request looks for anything the estimate missed (Thinking: High and up). */
  | { step: 'reviewing' }
  /** `count` independent estimates are being combined into one (Tokenmaxxing). */
  | { step: 'comparing'; count: number };

export type MealEstimateProgressListener = (progress: MealEstimateProgress) => void;

/** Whole keys, so `check-translations` sees every one. Plural keys take `count`. */
export const MEAL_ESTIMATE_PROGRESS_KEYS = {
  reading: 'food.aiProgress.reading',
  readingPhoto: 'food.aiProgress.readingPhoto',
  readingPhotos: 'food.aiProgress.readingPhotos',
  observing: 'food.aiProgress.observing',
  observingPhoto: 'food.aiProgress.observingPhoto',
  observingPhotos: 'food.aiProgress.observingPhotos',
  identifyingPhoto: 'food.aiProgress.identifyingPhoto',
  estimating: 'food.aiProgress.estimating',
  estimatingWithMatches: 'food.aiProgress.estimatingWithMatches',
  rechecking: 'food.aiProgress.rechecking',
  reviewing: 'food.aiProgress.reviewing',
  comparing: 'food.aiProgress.comparing',
} as const;

export type MealEstimateProgressLine = {
  key: (typeof MEAL_ESTIMATE_PROGRESS_KEYS)[keyof typeof MEAL_ESTIMATE_PROGRESS_KEYS];
  options?: { count: number; matched?: number; index?: number };
};

/** The line a screen shows for a step: `t(line.key, line.options)`. */
export function mealEstimateProgressLine(progress: MealEstimateProgress): MealEstimateProgressLine {
  switch (progress.step) {
    case 'reading':
      if (progress.photo && (progress.photoCount ?? 1) > 1) {
        return {
          key: MEAL_ESTIMATE_PROGRESS_KEYS.readingPhotos,
          options: { count: progress.photoCount ?? 1 },
        };
      }

      return {
        key: progress.photo
          ? MEAL_ESTIMATE_PROGRESS_KEYS.readingPhoto
          : MEAL_ESTIMATE_PROGRESS_KEYS.reading,
      };
    case 'observing':
      if (progress.photo && (progress.photoCount ?? 1) > 1) {
        return {
          key: MEAL_ESTIMATE_PROGRESS_KEYS.observingPhotos,
          options: { count: progress.photoCount ?? 1 },
        };
      }

      return {
        key: progress.photo
          ? MEAL_ESTIMATE_PROGRESS_KEYS.observingPhoto
          : MEAL_ESTIMATE_PROGRESS_KEYS.observing,
      };
    case 'identifying':
      return {
        key: MEAL_ESTIMATE_PROGRESS_KEYS.identifyingPhoto,
        options: { count: progress.count, index: progress.index },
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
    case 'reviewing':
      return { key: MEAL_ESTIMATE_PROGRESS_KEYS.reviewing };
    case 'comparing':
      return { key: MEAL_ESTIMATE_PROGRESS_KEYS.comparing, options: { count: progress.count } };
  }
}
