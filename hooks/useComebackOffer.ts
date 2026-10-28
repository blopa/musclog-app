import { differenceInCalendarDays } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { ActivityRepository } from '@/database/repositories/ActivityRepository';
import { useComebackState } from '@/hooks/useComebackState';
import { detectLapse, type LapseResult, shouldOfferComeback } from '@/utils/comeback/lapse';

export type UseComebackOfferResult = {
  /** null until the first read finishes, so the card never flashes in and out. */
  lapse: LapseResult | null;
  shouldOffer: boolean;
  /** Whole days since the last activity of any kind; null when there is none. */
  daysSinceActivity: number | null;
  /** Re-reads the latest activity (after a log, or after a dismissal). */
  refresh: () => Promise<void>;
};

/**
 * Whether Home should offer to ease back in. Latest activity is re-read whenever the screen gains
 * focus, which is when a workout or meal logged elsewhere would have changed the answer.
 */
export function useComebackOffer(): UseComebackOfferResult {
  const { state, today } = useComebackState();
  const [lapse, setLapse] = useState<LapseResult | null>(null);

  const refresh = useCallback(async () => {
    try {
      const last = await ActivityRepository.lastActivity();
      setLapse(
        detectLapse({
          ...last,
          everWorkout: last.lastWorkoutAt !== null,
          everFood: last.lastFoodAt !== null,
          now: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error reading latest activity:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return useMemo(() => {
    const lastActivityAt = lapse?.lastActivityAt ?? null;

    return {
      lapse,
      shouldOffer: lapse !== null && shouldOfferComeback(state, lapse, today),
      daysSinceActivity:
        lastActivityAt === null
          ? null
          : Math.max(0, differenceInCalendarDays(today, lastActivityAt)),
      refresh,
    };
  }, [lapse, state, today, refresh]);
}
