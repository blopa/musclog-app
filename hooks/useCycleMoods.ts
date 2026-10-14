import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';

import { isStaticExport } from '@/constants/platform';
import { database } from '@/database/database-instance';
import type UserMetric from '@/database/models/UserMetric';
import { calendarDateFromRecordDay } from '@/utils/calendarDate';
import type { MoodPoint } from '@/utils/cycle/cycleInsights';

/** Shared mood stays observable so cycle summaries and exports include edits made elsewhere. */
export function useCycleMoods(enabled = true) {
  const [moods, setMoods] = useState<MoodPoint[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled || isStaticExport) {
      return;
    }

    let token = 0;
    const subscription = database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'mood'),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('date', Q.asc),
        Q.sortBy('updated_at', Q.asc)
      )
      .observeWithColumns(['value', 'date', 'updated_at', 'deleted_at'])
      .subscribe({
        next: (records) => {
          const current = ++token;
          setLoading(true);
          void Promise.all(
            records.map(async (m) => ({
              date: calendarDateFromRecordDay(m.date, m.timezone).getTime(),
              value: (await m.getDecrypted()).value,
            }))
          )
            .then((points) => {
              if (current !== token) {
                return;
              }

              setMoods([...new Map(points.map((point) => [point.date, point])).values()]);
              setLoading(false);
              setError(false);
            })
            .catch(() => {
              if (current === token) {
                setLoading(false);
                setError(true);
              }
            });
        },
        error: () => {
          setLoading(false);
          setError(true);
        },
      });
    return () => {
      token++;
      subscription.unsubscribe();
    };
  }, [enabled]);
  return { moods, isLoading, error };
}
