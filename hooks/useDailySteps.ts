import { Q } from '@nozbe/watermelondb';
import { useEffect, useState } from 'react';

import { database } from '@/database';
import UserMetric from '@/database/models/UserMetric';
import { localDayHalfOpenRange } from '@/utils/calendarDate';

/**
 * Today's step count, as synced from Health Connect / HealthKit into the
 * `daily_steps` user metric.
 *
 * `observeWithColumns` rather than `observe` is load-bearing: the platform sync
 * upserts ONE `daily_steps` row per day, so every step update after the first is an
 * in-place `prepareUpdate` on a record that is already in the result set. A plain
 * `observe()` only emits when records enter or leave that set, so the home screen
 * would show the day's first reading and then never move.
 */
export function useDailySteps(date: Date) {
  const [steps, setSteps] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Guards against out-of-order decryption: `getDecrypted` is async, so a slow
    // earlier emission could otherwise resolve after a newer one and win.
    let latestEmission = 0;

    const { start, nextStart } = localDayHalfOpenRange(date);

    const subscription = database.collections
      .get<UserMetric>('user_metrics')
      .query(
        Q.where('type', 'daily_steps'),
        Q.where('deleted_at', Q.eq(null)),
        Q.where('date', Q.gte(start)),
        Q.where('date', Q.lt(nextStart))
      )
      .observeWithColumns(['value'])
      .subscribe((records) => {
        const emission = ++latestEmission;

        const publish = (value: number | null) => {
          if (active && emission === latestEmission) {
            setSteps(value);
            setIsLoading(false);
          }
        };

        if (records.length === 0) {
          publish(null);
          return;
        }

        // The sync keeps a single row per day; if an older duplicate survives, the
        // most recently written one is the current total.
        const newest = records.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));

        newest
          .getDecrypted()
          .then((decrypted) => publish(decrypted.value))
          .catch(() => publish(null));
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [date]);

  return { steps, isLoading };
}
