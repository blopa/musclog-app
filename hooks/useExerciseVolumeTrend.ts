import type { Locale } from 'date-fns';
import { useEffect, useState } from 'react';

import type { VolumeTrend } from '@/utils/volumeTrend';
import { calculateExerciseVolumeTrend } from '@/utils/workoutDetail';

/**
 * Volume trend of one exercise across the sessions of the same workout, or null while it loads
 * (or when there is nothing to show yet).
 *
 * The result is keyed by what it was computed for, so a slow response for an exercise the user has
 * since closed can never surface under another one: it is dropped on arrival, and a stored result
 * for a different selection reads as null.
 */
export function useExerciseVolumeTrend(
  workoutLogId: string | undefined,
  exerciseId: string | null,
  locale: Locale
): VolumeTrend | null {
  const [result, setResult] = useState<{ key: string; trend: VolumeTrend } | null>(null);
  const key = workoutLogId && exerciseId ? `${workoutLogId}:${exerciseId}` : null;

  useEffect(() => {
    if (!workoutLogId || !exerciseId || !key) {
      return;
    }

    let live = true;
    calculateExerciseVolumeTrend(workoutLogId, exerciseId, locale)
      .then((trend) => {
        if (live) {
          setResult({ key, trend });
        }
      })
      .catch((err) => console.warn('[useExerciseVolumeTrend] exercise trend error:', err));

    return () => {
      live = false;
    };
  }, [workoutLogId, exerciseId, locale, key]);

  return key !== null && result?.key === key ? result.trend : null;
}
