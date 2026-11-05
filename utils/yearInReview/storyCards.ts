import { kgToDisplay } from '@/utils/unitConversion';
import type { TrainingTimeBucket, YearInReview } from '@/utils/yearInReview/types';

/**
 * The story is a list of cards, one per statistic, in the order the screen shows them. Each card
 * carries plain numbers (kilograms, seconds, month index); the screen formats and translates them.
 */
export type YearStoryCard =
  | { kind: 'intro'; year: number }
  | { kind: 'sessions'; sessions: number; activeDays: number | null }
  | { kind: 'heatmap'; year: number }
  | { kind: 'streak'; weeks: number }
  | { kind: 'volume'; totalVolumeKg: number }
  | { kind: 'topExercises'; exercises: { name: string; sets: number }[] }
  | { kind: 'records'; count: number }
  | { kind: 'busiestMonth'; month: number; sessions: number }
  | { kind: 'trainingTime'; bucket: TrainingTimeBucket | null; seconds: number | null }
  | { kind: 'nutrition'; meals: number; days: number }
  | { kind: 'weight'; changeKg: number }
  | { kind: 'outro'; year: number };

export interface StoryCardOptions {
  /** False while the progress lock is held: the weight card never appears. */
  showWeight: boolean;
}

/**
 * Cards for a year, in story order. A card whose statistic is null is left out, and an empty year
 * has no story at all (the screen shows one quiet line instead).
 */
export function buildYearStoryCards(
  review: YearInReview,
  { showWeight }: StoryCardOptions
): YearStoryCard[] {
  if (!review.hasContent) {
    return [];
  }

  const cards: (YearStoryCard | null)[] = [
    { kind: 'intro', year: review.year },
    review.sessions !== null
      ? { kind: 'sessions', sessions: review.sessions, activeDays: review.activeDays }
      : null,
    review.workoutDays.length > 0 ? { kind: 'heatmap', year: review.year } : null,
    review.longestWeeklyStreak !== null
      ? { kind: 'streak', weeks: review.longestWeeklyStreak }
      : null,
    review.totalVolumeKg !== null ? { kind: 'volume', totalVolumeKg: review.totalVolumeKg } : null,
    review.topExercises.length > 0
      ? {
          kind: 'topExercises',
          exercises: review.topExercises.map(({ name, sets }) => ({ name, sets })),
        }
      : null,
    review.personalRecords !== null ? { kind: 'records', count: review.personalRecords } : null,
    review.busiestMonth
      ? {
          kind: 'busiestMonth',
          month: review.busiestMonth.month,
          sessions: review.busiestMonth.sessions,
        }
      : null,
    review.favouriteTrainingTime !== null || review.trainingSeconds !== null
      ? {
          kind: 'trainingTime',
          bucket: review.favouriteTrainingTime,
          seconds: review.trainingSeconds,
        }
      : null,
    review.mealsLogged !== null && review.nutritionDaysLogged !== null
      ? { kind: 'nutrition', meals: review.mealsLogged, days: review.nutritionDaysLogged }
      : null,
    showWeight && review.weightChangeKg !== null
      ? { kind: 'weight', changeKg: review.weightChangeKg }
      : null,
    { kind: 'outro', year: review.year },
  ];

  return cards.filter((card): card is YearStoryCard => card !== null);
}

/** The volume in the account's units, unrounded: the screen rounds it for display. */
export function volumeInUnits(totalVolumeKg: number, units: 'metric' | 'imperial'): number {
  return kgToDisplay(totalVolumeKg, units);
}
