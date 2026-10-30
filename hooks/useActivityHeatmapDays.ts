import { addDays } from 'date-fns';
import { useEffect, useState } from 'react';

import type { ActivityHeatmapSource } from '@/constants/settings';
import { ActivityHeatmapRepository } from '@/database/repositories/ActivityHeatmapRepository';
import type { ActivityHeatmapDay } from '@/utils/activityHeatmap';
import { handleError } from '@/utils/handleError';

const NO_DAYS: ActivityHeatmapDay[] = [];

/**
 * The live days for one heatmap, ending on `endDate`. The query reaches one week further back
 * than `weeks` so the grid's first, partial week is complete whichever weekday it starts on.
 * Starts empty, which draws an empty grid rather than a spinner: a heatmap is a glance, and the
 * first emission lands within a frame or two of mounting.
 *
 * `enabled: false` subscribes to nothing and returns no days, for a caller that calls one hook per
 * source but shows only some of them.
 */
export function useActivityHeatmapDays(
  source: ActivityHeatmapSource,
  endDate: Date,
  weeks: number,
  { enabled = true }: { enabled?: boolean } = {}
): ActivityHeatmapDay[] {
  const [days, setDays] = useState<ActivityHeatmapDay[]>([]);
  const endMs = endDate.getTime();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const end = new Date(endMs);
    const start = addDays(end, -(weeks + 1) * 7);
    const subscription = ActivityHeatmapRepository.observeDays(source, start, end).subscribe({
      next: setDays,
      error: (error) => void handleError(error, `useActivityHeatmapDays.${source}`),
    });

    return () => subscription.unsubscribe();
  }, [source, endMs, weeks, enabled]);

  return enabled ? days : NO_DAYS;
}
