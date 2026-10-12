import { Q } from '@nozbe/watermelondb';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { database } from '@/database/database-instance';
import { waitForDbReady } from '@/database/dbReady';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { SettingsService } from '@/database/services/SettingsService';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';

export function useWeeklyReviewStatus() {
  const [status, setStatus] = useState<{ ready: boolean; reviewed: boolean; next: number } | null>(
    null
  );
  const reload = useCallback(async () => {
    await waitForDbReady();
    const [weekday, goal, intuitive, reviews] = await Promise.all([
      SettingsService.getReviewWeekday(),
      NutritionGoalService.getCurrent(),
      SettingsService.getIntuitiveEatingMode(),
      WeeklyReviewService.history(),
    ]);
    const period = weeklyReviewPeriod(new Date(), weekday);
    const review = reviews.find(
      (row) => row.periodEnd === period.end && (row.nutritionGoalId ?? null) === (goal?.id ?? null)
    );
    const reviewed =
      reviews.some((row) => row.periodEnd === period.end && !!row.trainingReviewedAt) &&
      (!goal || intuitive || !!review?.nutritionReviewedAt);
    setStatus({ ready: !reviewed, reviewed, next: period.next });
  }, []);
  useFocusEffect(
    useCallback(() => {
      reload().catch(() => setStatus(null));
    }, [reload])
  );
  useEffect(() => {
    let live = true;
    const subscriptions: { unsubscribe: () => void }[] = [];
    waitForDbReady()
      .then(() => {
        if (!live) {
          return;
        }
        for (const [table, columns] of [
          ['weekly_reviews', ['training_reviewed_at', 'nutrition_reviewed_at']],
          ['nutrition_goals', ['target_mode', 'effective_until']],
          ['settings', ['value']],
        ] as const) {
          subscriptions.push(
            database
              .get(table)
              .query(Q.where('deleted_at', Q.eq(null)))
              .observeWithColumns([...columns])
              .subscribe({
                next: () => {
                  reload().catch(() => setStatus(null));
                },
              })
          );
        }
      })
      .catch(() => {
        if (live) {
          setStatus(null);
        }
      });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reload().catch(() => setStatus(null));
      }
    });
    return () => {
      live = false;
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      appState.remove();
    };
  }, [reload]);
  return status;
}
