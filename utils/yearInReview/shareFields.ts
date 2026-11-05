import type { YearInReview } from '@/utils/yearInReview/types';

export interface ShareFieldOptions {
  /** The user turned on "Include weight change". Off, the weight never reaches the image. */
  includeWeight: boolean;
  /** The user turned on "Include nutrition". Off, no food figure reaches the image. */
  includeNutrition: boolean;
}

/**
 * The only figures the share image may draw. Everything not chosen is null, so the image cannot
 * show it even by accident. Cycle data is not part of the review at all.
 */
export interface YearShareFields {
  year: number;
  sessions: number | null;
  activeDays: number | null;
  totalVolumeKg: number | null;
  topExercise: { name: string; sets: number } | null;
  personalRecords: number | null;
  weightChangeKg: number | null;
  mealsLogged: number | null;
  nutritionDaysLogged: number | null;
}

export function selectShareFields(
  review: YearInReview,
  { includeWeight, includeNutrition }: ShareFieldOptions
): YearShareFields {
  const [top] = review.topExercises;

  return {
    year: review.year,
    sessions: review.sessions,
    activeDays: review.activeDays,
    totalVolumeKg: review.totalVolumeKg,
    topExercise: top ? { name: top.name, sets: top.sets } : null,
    personalRecords: review.personalRecords,
    weightChangeKg: includeWeight ? review.weightChangeKg : null,
    mealsLogged: includeNutrition ? review.mealsLogged : null,
    nutritionDaysLogged: includeNutrition ? review.nutritionDaysLogged : null,
  };
}
