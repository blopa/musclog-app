import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';

import { database } from '../database';
import UserMetric from '../database/models/UserMetric';

/**
 * Hook to check if a supplement entry exists for today.
 */
export function useTodaySupplement() {
  const [hasSupplementToday, setHasSupplementToday] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startTimestamp = startOfDay.getTime();

    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);
    const endTimestamp = endOfDay.getTime();

    const query = database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'supplement'),
        Q.where('date', Q.gte(startTimestamp)),
        Q.where('date', Q.lte(endTimestamp)),
        Q.where('deleted_at', Q.eq(null)),
        Q.take(1)
      );

    const subscription = query.observe().subscribe({
      next: (metrics) => {
        setHasSupplementToday(metrics.length > 0);
        setIsLoading(false);
      },
      error: (err) => {
        console.error('Error observing today supplement:', err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  return { hasSupplementToday, isLoading };
}
