import { useEffect, useState } from 'react';

import { getMacroStreak, type MacroStreak } from '@/utils/macroStreak';

type UseMacroStreakResult = MacroStreak & {
  isLoading: boolean;
};

type UseMacroStreakParams = {
  date?: Date;
  visible?: boolean;
};

/**
 * Reads the macro-logging streak (current + best) via {@link getMacroStreak}, which recomputes
 * from the database at most once per local calendar day and caches the rest in AsyncStorage.
 */
export function useMacroStreak({
  date,
  visible = true,
}: UseMacroStreakParams = {}): UseMacroStreakResult {
  const [streak, setStreak] = useState<MacroStreak>({ currentStreak: 0, bestStreak: 0 });
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null);
  const dateTime = date?.getTime();
  const requestKey = visible ? String(dateTime ?? 'today') : null;

  useEffect(() => {
    if (requestKey == null) {
      return;
    }

    let cancelled = false;

    getMacroStreak(dateTime == null ? undefined : new Date(dateTime))
      .then((result) => {
        if (!cancelled) {
          setStreak(result);
        }
      })
      .catch((error) => {
        console.error('[useMacroStreak] Error loading macro streak:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadedRequestKey(requestKey);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dateTime, requestKey]);

  return { ...streak, isLoading: requestKey != null && loadedRequestKey !== requestKey };
}
