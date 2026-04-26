import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';

import { database } from '../database';
import UserMetric from '../database/models/UserMetric';
import Supplement from '../database/models/Supplement';

/**
 * Hook to get all supplements that need to be tracked today and haven't been.
 */
export function usePendingSupplements() {
  const [pendingSupplements, setPendingSupplements] = useState<Supplement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Get all supplements with reminders enabled
    const supplementsQuery = database
      .get<Supplement>('supplements')
      .query(Q.where('has_reminder', true), Q.where('deleted_at', Q.eq(null)));

    // 2. Get today's supplement logs
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startTimestamp = startOfDay.getTime();

    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);
    const endTimestamp = endOfDay.getTime();

    const logsQuery = database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'supplement'),
        Q.where('date', Q.gte(startTimestamp)),
        Q.where('date', Q.lte(endTimestamp)),
        Q.where('deleted_at', Q.eq(null))
      );

    const observeSupplements = supplementsQuery.observe();
    const observeLogs = logsQuery.observe();

    const subscription = observeSupplements.subscribe({
      next: (allSupplements) => {
        const logsSubscription = observeLogs.subscribe({
          next: (todayLogs) => {
            const loggedIds = new Set(
              todayLogs.map((log) => log.supplementId).filter(Boolean)
            );

            // Filter supplements that haven't been logged today
            const pending = allSupplements.filter(s => !loggedIds.has(s.id));

            setPendingSupplements(pending);
            setIsLoading(false);
          },
        });
        return () => logsSubscription.unsubscribe();
      },
      error: (err) => {
        console.error('Error observing pending supplements:', err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  return { pendingSupplements, isLoading };
}
