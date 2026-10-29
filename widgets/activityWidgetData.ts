import { subDays } from 'date-fns';

import { database } from '@/database/database-instance';
import { ActivityHeatmapRepository } from '@/database/repositories/ActivityHeatmapRepository';
import type { ActivityHeatmapDay } from '@/utils/activityHeatmap';

import { ACTIVITY_WIDGET_DAYS } from './activityWidgetSnapshot';

/** The days the widget draws, ending on `today`. Plaintext columns only: nothing is decrypted. */
export async function loadActivityWidgetDays(
  today: Date
): Promise<{ workoutDays: ActivityHeatmapDay[]; mealDays: ActivityHeatmapDay[] }> {
  const start = subDays(today, ACTIVITY_WIDGET_DAYS - 1);
  const [workoutDays, mealDays] = await Promise.all([
    ActivityHeatmapRepository.fetchWorkoutDays(start, today),
    ActivityHeatmapRepository.fetchMealDays(start, today),
  ]);

  return { workoutDays, mealDays };
}

/** Calls `listener` after any write to the tables the widget is derived from (imports included). */
export function subscribeToActivityChanges(listener: () => void): () => void {
  const subscription = database
    .withChangesForTables(['workout_logs', 'nutrition_logs'])
    .subscribe(listener);

  return () => subscription.unsubscribe();
}
