import { Q } from '@nozbe/watermelondb';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { database } from '@/database/database-instance';
import { waitForDbReady } from '@/database/dbReady';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { SettingsService } from '@/database/services/SettingsService';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { hasWeeklyActivity } from '@/utils/weeklyReviewEmptyState';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';

export type WeeklyReviewStatus = {
  /** A completed week is waiting for a decision. */
  ready: boolean;
  reviewed: boolean;
  /** The day the following review becomes available. */
  next: number;
  /** The week under review, [start, end) as local day keys. */
  start: number;
  end: number;
};

/**
 * Whether the week holds anything to review: a finished workout, a food log or a weigh-in. An empty
 * week — a new install, or a week off — is not "ready", or the badge would never go away.
 */
export async function weekHadActivity(start: number, end: number): Promise<boolean> {
  return hasWeeklyActivity(await WeeklyReviewService.weekActivity(start, end));
}

export function useWeeklyReviewStatus() {
  const [status, setStatus] = useState<WeeklyReviewStatus | null>(null);
  const reload = useCallback(async () => {
    await waitForDbReady();
    const [weekday, goal, intuitive, reviews] = await Promise.all([
      SettingsService.getReviewWeekday(),
      NutritionGoalService.getCurrent(),
      SettingsService.getIntuitiveEatingMode(),
      WeeklyReviewService.history(),
    ]);
    const period = weeklyReviewPeriod(new Date(), weekday);
    const activity = await WeeklyReviewService.weekActivity(period.start, period.end);
    const hadWeek = hasWeeklyActivity(activity);
    const review = reviews.find(
      (row) => row.periodEnd === period.end && (row.nutritionGoalId ?? null) === (goal?.id ?? null)
    );
    // Someone who has never finished a workout is not asked to decide on training.
    const trainingDone =
      !activity.everWorkout ||
      reviews.some((row) => row.periodEnd === period.end && !!row.trainingReviewedAt);
    const reviewed = trainingDone && (!goal || intuitive || !!review?.nutritionReviewedAt);
    setStatus({
      ready: hadWeek && !reviewed,
      reviewed: hadWeek && reviewed,
      next: period.next,
      start: period.start,
      end: period.end,
    });
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
