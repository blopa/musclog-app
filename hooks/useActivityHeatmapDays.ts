import { addDays } from 'date-fns';
import { useEffect, useState } from 'react';

import { ActivityHeatmapRepository } from '@/database/repositories/ActivityHeatmapRepository';
import type { ActivityHeatmapDay } from '@/utils/activityHeatmap';
import { handleError } from '@/utils/handleError';

export type ActivityHeatmapSource = 'workouts' | 'nutrition';

/**
 * The live days for one heatmap, ending on `endDate`. The query reaches one week further back
 * than `weeks` so the grid's first, partial week is complete whichever weekday it starts on.
 * Starts empty, which draws an empty grid rather than a spinner: a heatmap is a glance, and the
 * first emission lands within a frame or two of mounting.
 */
export function useActivityHeatmapDays(
  source: ActivityHeatmapSource,
  endDate: Date,
  weeks: number
): ActivityHeatmapDay[] {
  const [days, setDays] = useState<ActivityHeatmapDay[]>([]);
  const endMs = endDate.getTime();

  useEffect(() => {
    const end = new Date(endMs);
    const start = addDays(end, -(weeks + 1) * 7);
    const days$ =
      source === 'workouts'
        ? ActivityHeatmapRepository.observeWorkoutDays(start, end)
        : ActivityHeatmapRepository.observeMealDays(start, end);

    const subscription = days$.subscribe({
      next: setDays,
      error: (error) => void handleError(error, `useActivityHeatmapDays.${source}`),
    });

    return () => subscription.unsubscribe();
  }, [source, endMs, weeks]);

  return days;
}
