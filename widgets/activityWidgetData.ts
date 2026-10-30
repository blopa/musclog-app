import { subDays } from 'date-fns';

import { ACTIVITY_HEATMAP_SOURCES, type ActivityHeatmapSource } from '@/constants/settings';
import { database } from '@/database/database-instance';
import { ActivityHeatmapRepository } from '@/database/repositories/ActivityHeatmapRepository';
import type { ActivityHeatmapDay } from '@/utils/activityHeatmap';

import { ACTIVITY_WIDGET_DAYS } from './activityWidgetSnapshot';

/** The days the widget draws for every source, ending on `today`. Plaintext columns only: nothing is decrypted. */
export async function loadActivityWidgetDays(
  today: Date
): Promise<Record<ActivityHeatmapSource, ActivityHeatmapDay[]>> {
  const start = subDays(today, ACTIVITY_WIDGET_DAYS - 1);
  const days = await Promise.all(
    ACTIVITY_HEATMAP_SOURCES.map((source) =>
      ActivityHeatmapRepository.fetchDays(source, start, today)
    )
  );

  return Object.fromEntries(
    ACTIVITY_HEATMAP_SOURCES.map((source, index) => [source, days[index]])
  ) as Record<ActivityHeatmapSource, ActivityHeatmapDay[]>;
}

/** Calls `listener` after any write to the tables the widget is derived from (imports included). */
export function subscribeToActivityChanges(listener: () => void): () => void {
  const subscription = database
    .withChangesForTables(['workout_logs', 'nutrition_logs'])
    .subscribe(listener);

  return () => subscription.unsubscribe();
}
