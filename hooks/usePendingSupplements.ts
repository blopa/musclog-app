import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';
import { combineLatest } from 'rxjs';

import { database } from '@/database';
import Supplement from '@/database/models/Supplement';
import UserMetric from '@/database/models/UserMetric';
import { localDayHalfOpenRange } from '@/utils/calendarDate';

export function usePendingSupplements() {
  const [pendingSupplements, setPendingSupplements] = useState<Supplement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { start, nextStart } = localDayHalfOpenRange(new Date());

    const supplementsQuery = database
      .get<Supplement>('supplements')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('has_reminder', true),
        Q.sortBy('created_at', Q.asc)
      );

    const logsQuery = database
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('deleted_at', Q.eq(null)),
        Q.where('type', 'supplement'),
        Q.where('date', Q.gte(start)),
        Q.where('date', Q.lt(nextStart))
      );

    const subscription = combineLatest([supplementsQuery.observe(), logsQuery.observe()]).subscribe(
      {
        next: ([supplements, logs]) => {
          const handledSupplementIds = new Set(
            logs.map((log) => log.supplementId).filter((id): id is string => Boolean(id))
          );

          setPendingSupplements(
            supplements.filter((supplement) => !handledSupplementIds.has(supplement.id))
          );
          setIsLoading(false);
        },
        error: (error) => {
          console.error('Error observing pending supplements:', error);
          setIsLoading(false);
        },
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { pendingSupplements, isLoading };
}
