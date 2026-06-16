import { useEffect, useState } from 'react';

import { getMacroStreak, type MacroStreak } from '@/utils/macroStreak';

type UseMacroStreakResult = MacroStreak & {
  isLoading: boolean;
};

/**
 * Reads the macro-logging streak (current + best) via {@link getMacroStreak}, which recomputes
 * from the database at most once per local calendar day and caches the rest in AsyncStorage.
 */
export function useMacroStreak(): UseMacroStreakResult {
  const [streak, setStreak] = useState<MacroStreak>({ currentStreak: 0, bestStreak: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getMacroStreak()
      .then((result) => {
        if (!cancelled) {
          setStreak(result);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { ...streak, isLoading };
}
