import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { NutritionCheckinService } from '@/database/services/NutritionCheckinService';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';

/** Evidence is refreshed on every return from logging, even when review status hasn't changed. */
export function useWeeklyReviewOverview(reviewId?: string, day?: string) {
  const [data, setData] = useState<Awaited<ReturnType<typeof WeeklyReviewService.overview>> | null>(
    null
  );
  const [legacy, setLegacy] = useState<
    Awaited<ReturnType<typeof NutritionCheckinService.getPastHistory>>
  >([]);
  const [loadError, setLoadError] = useState(false);
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
      setData(overview);
      setLegacy(history);
      setLoadError(false);
    } catch {
      if (request.current === id) {
        setLoadError(true);
      }
    }
  }, [reviewId, day]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        request.current++;
      };
    }, [reload])
  );
  const clear = () => {
    request.current++;
    setData(null);
  };
  return { data, legacy, loadError, reload, clear };
}
