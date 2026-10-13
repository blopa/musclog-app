import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { NutritionCheckinService } from '@/database/services/NutritionCheckinService';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';

type Overview = Awaited<ReturnType<typeof WeeklyReviewService.overview>>;

/**
 * Evidence is refreshed on every return from logging, even when review status hasn't changed.
 *
 * Each result is stored with the selection it was loaded for, and `data` is only returned while that
 * selection is still current. Switching reviews therefore shows the spinner without the caller
 * clearing anything — and re-selecting the review already on screen keeps it. The screen used to
 * clear the data itself and rely on the selection change to reload, so tapping the history row that
 * was already open emptied the page and left the spinner up forever.
 */
export function useWeeklyReviewOverview(reviewId?: string, day?: string) {
  const key = `${reviewId ?? ''}|${day ?? ''}`;
  const [loaded, setLoaded] = useState<{ key: string; overview: Overview } | null>(null);
  const [legacy, setLegacy] = useState<
    Awaited<ReturnType<typeof NutritionCheckinService.getPastHistory>>
  >([]);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const id = ++request.current;
    try {
      const [overview, history] = await Promise.all([
        WeeklyReviewService.overview(
          reviewId,
          day && Number.isFinite(Number(day)) ? new Date(Number(day)) : undefined
        ),
        NutritionCheckinService.getPastHistory(30),
      ]);
      if (request.current !== id) {
        return;
      }
      setLoaded({ key, overview });
      setLegacy(history);
      setFailedKey(null);
    } catch {
      if (request.current === id) {
        setFailedKey(key);
      }
    }
  }, [reviewId, day, key]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        request.current++;
      };
    }, [reload])
  );
  return {
    data: loaded?.key === key ? loaded.overview : null,
    legacy,
    loadError: failedKey === key,
    reload,
  };
}
