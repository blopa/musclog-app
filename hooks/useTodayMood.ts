import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';

import { database } from '../database';
import UserMetric from '../database/models/UserMetric';
import { localDayClosedRangeMaxMs, localDayStartMs } from '../utils/calendarDate';

/**
 * Hook to check if a mood entry exists for today.
 */
export function useTodayMood() {
  const [hasMoodToday, setHasMoodToday] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const startTimestamp = localDayStartMs(today);
    const endTimestamp = localDayClosedRangeMaxMs(today);

    const query = database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'mood'),
        Q.where('date', Q.gte(startTimestamp)),
        Q.where('date', Q.lte(endTimestamp)),
        Q.where('deleted_at', Q.eq(null)),
        Q.take(1)
      );

    const subscription = query.observe().subscribe({
      next: (metrics) => {
        setHasMoodToday(metrics.length > 0);
        setIsLoading(false);
      },
      error: (err) => {
        console.error('Error observing today mood:', err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  return { hasMoodToday, isLoading };
}
