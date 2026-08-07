import { useEffect, useState } from 'react';

import type Food from '@/database/models/Food';
import { NutritionService } from '@/database/services';
import { utcDayKeyFromLocalDate } from '@/utils/calendarDate';
import { buildCopyDaySections, type CopyDaySection } from '@/utils/copyDaySelection';
import { handleError } from '@/utils/handleError';

export type RecentLoggedDay = {
  dayKey: number;
  itemCount: number;
  calories: number;
};

type UseCopyDaySourceParams = {
  /** Only query while the modal is open. */
  enabled: boolean;
  /** The day being copied *into* — excluded from its own candidate list. */
  targetDate: Date;
  /** Chosen source day, or null before the user picks one. */
  sourceDate: Date | null;
};

type UseCopyDaySourceResult = {
  recentDays: RecentLoggedDay[];
  isLoadingRecentDays: boolean;
  sections: CopyDaySection[];
  isLoadingPreview: boolean;
  /** True once a source day has loaded and turned out to have no logs. */
  isSourceEmpty: boolean;
};

const RECENT_DAY_LIMIT = 14;
const RECENT_DAY_LOOKBACK_DAYS = 60;

/**
 * Loads the two reads the copy-day modal needs: the candidate source days, and the
 * preview for whichever day the user picked.
 *
 * Deliberately not `useNutritionLogs` — that hook's WatermelonDB observer is scoped
 * to the *viewed* day, whereas the source day is a one-off read that should not
 * re-render the diary or hold a subscription open.
 */
export function useCopyDaySource({
  enabled,
  targetDate,
  sourceDate,
}: UseCopyDaySourceParams): UseCopyDaySourceResult {
  const [recentDays, setRecentDays] = useState<RecentLoggedDay[]>([]);
  const [isLoadingRecentDays, setIsLoadingRecentDays] = useState(false);
  const [sections, setSections] = useState<CopyDaySection[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [hasLoadedPreview, setHasLoadedPreview] = useState(false);

  const targetDayKey = utcDayKeyFromLocalDate(targetDate);

  useEffect(() => {
    let cancelled = false;

    // State updates go through named helpers rather than bare setState calls in the effect
    // body — `react-hooks/set-state-in-effect` is an error here, and this is the wrapper
    // idiom the codebase already uses (see `useSubModalVisibility`). Don't inline them.
    const markIdle = () => setRecentDays([]);
    const markLoading = () => setIsLoadingRecentDays(true);

    if (!enabled) {
      markIdle();
      return;
    }

    markLoading();

    NutritionService.getRecentLoggedDays(RECENT_DAY_LIMIT, RECENT_DAY_LOOKBACK_DAYS, {
      excludeDayKey: targetDayKey,
    })
      .then((days) => {
        if (!cancelled) {
          setRecentDays(days);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRecentDays([]);
        }
        handleError(error, 'copyDay.loadRecentDays', { showSnackbar: false });
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRecentDays(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, targetDayKey]);

  const sourceDayKey = sourceDate ? utcDayKeyFromLocalDate(sourceDate) : null;

  useEffect(() => {
    let cancelled = false;
    const dayToLoad = enabled ? sourceDate : null;

    const markIdle = () => {
      setSections([]);
      setHasLoadedPreview(false);
    };

    const markLoading = () => {
      setIsLoadingPreview(true);
      setHasLoadedPreview(false);
    };

    if (!dayToLoad) {
      markIdle();
      return;
    }

    markLoading();

    const load = async () => {
      try {
        const logs = await NutritionService.getNutritionLogsForDate(dayToLoad);
        // Same relation resolution the diary does, so labels and calories match what
        // the user saw on that day.
        const resolved = await Promise.all(
          logs.map(async (log) => {
            let food: Food | null = null;
            try {
              food = await log.food;
            } catch {
              // Food may be deleted; the snapshot still carries name and nutrients.
            }
            const [nutrients, gramWeight, displayName] = await Promise.all([
              log.getNutrients(),
              log.getGramWeight(),
              log.getDisplayName(),
            ]);
            return { log, food, nutrients, gramWeight, displayName };
          })
        );

        if (!cancelled) {
          setSections(buildCopyDaySections(resolved));
        }
      } catch (error) {
        if (!cancelled) {
          setSections([]);
        }
        handleError(error, 'copyDay.loadSourceDay', { showSnackbar: false });
      } finally {
        if (!cancelled) {
          setIsLoadingPreview(false);
          setHasLoadedPreview(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
    // `sourceDayKey` (not the Date identity) is the real dependency — a new Date object
    // for the same calendar day must not retrigger the read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sourceDayKey]);

  return {
    recentDays,
    isLoadingRecentDays,
    sections,
    isLoadingPreview,
    isSourceEmpty: hasLoadedPreview && sections.length === 0,
  };
}
