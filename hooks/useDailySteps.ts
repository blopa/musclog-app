import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';

import { database } from '@/database';
import UserMetric from '@/database/models/UserMetric';
import { localDayHalfOpenRange } from '@/utils/calendarDate';

export function useDailySteps(date: Date) {
  const [steps, setSteps] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { start, nextStart } = localDayHalfOpenRange(date);

    const query = database.collections
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'daily_steps'),
        Q.where('date', Q.gte(start)),
        Q.where('date', Q.lt(nextStart))
      );

    const subscription = query.observe().subscribe(async (records) => {
      if (records.length > 0) {
        // Technically there should be only one per day by design,
        // but if multiple, use the first (newest by date logic if sorted, but we didn't sort, we'll just take records[0] since they sync daily)
        try {
          const decrypted = await records[0].getDecrypted();
          if (active) {
            setSteps(decrypted.value);
            setIsLoading(false);
          }
        } catch {
          if (active) {
            setSteps(null);
            setIsLoading(false);
          }
        }
      } else {
        if (active) {
          setSteps(null);
          setIsLoading(false);
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [date]);

  return { steps, isLoading, source: 'health' as const };
}
