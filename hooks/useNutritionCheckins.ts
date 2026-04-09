import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useState } from 'react';

import { database } from '@/database';
import type NutritionCheckin from '@/database/models/NutritionCheckin';
import { NutritionCheckinService } from '@/database/services';

export interface UseNutritionCheckinsParams {
  /** Nutrition goal id to load check-ins for. When null/undefined, no fetch. */
  nutritionGoalId: string | null | undefined;
  visible?: boolean;
}

export interface UseNutritionCheckinsResult {
  checkins: NutritionCheckin[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook for nutrition check-ins of a given goal. Reactive to DB changes.
 */
export function useNutritionCheckins({
  nutritionGoalId,
  visible = true,
}: UseNutritionCheckinsParams): UseNutritionCheckinsResult {
  const [checkins, setCheckins] = useState<NutritionCheckin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!nutritionGoalId || !visible) {
      setCheckins([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const list = await NutritionCheckinService.getByGoalId(nutritionGoalId);
      setCheckins(list);
    } catch (err) {
      console.error('Error loading nutrition check-ins:', err);
      setCheckins([]);
    } finally {
      setIsLoading(false);
    }
  }, [nutritionGoalId, visible]);

  useEffect(() => {
    if (!nutritionGoalId || !visible) {
      setCheckins([]);
      setIsLoading(false);
      return;
    }

    refresh();

    const query = database
      .get<NutritionCheckin>('nutrition_checkins')
      .query(
        Q.where('nutrition_goal_id', nutritionGoalId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('checkin_date', Q.asc)
      );

    const subscription = query.observe().subscribe({
      next: (list) => setCheckins(list),
      error: (err) => {
        console.error('Error observing nutrition check-ins:', err);
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [nutritionGoalId, visible, refresh]);

  return {
    checkins,
    isLoading,
    refresh,
  };
}
