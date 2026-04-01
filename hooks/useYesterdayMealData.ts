import { useEffect, useState } from 'react';

import { type MealType } from '../database/models';
import NutritionLog from '../database/models/NutritionLog';
import { NutritionService } from '../database/services';
import {
  localCalendarDayDate,
  localDayKeyPlusCalendarDays,
  localDayStartMs,
} from '../utils/calendarDate';

export type YesterdayMealData = {
  logs: NutritionLog[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  items: { name: string; calories: number }[];
};

export interface UseYesterdayMealDataParams {
  visible: boolean;
  mealType: MealType | null | undefined;
  /** Date we're logging for (e.g. today). Used to hide the block if this meal type already has items for that date. */
  logDate?: Date;
}

/**
 * Loads yesterday's meal logs for the given meal type (e.g. breakfast, lunch).
 * Used by the "Same as yesterday" card in FoodSearchModal.
 * Also returns whether the selected meal type has any items tracked for logDate (today);
 * the card should only show when there are none.
 */
export function useYesterdayMealData({ visible, mealType, logDate }: UseYesterdayMealDataParams): {
  yesterdayMealData: YesterdayMealData | null;
  isLoadingYesterday: boolean;
  hasItemsTrackedForSelectedDate: boolean;
} {
  const [yesterdayMealData, setYesterdayMealData] = useState<YesterdayMealData | null>(null);
  const [isLoadingYesterday, setIsLoadingYesterday] = useState(false);
  const [hasItemsTrackedForSelectedDate, setHasItemsTrackedForSelectedDate] = useState(false);

  useEffect(() => {
    if (!visible || !mealType) {
      setYesterdayMealData(null);
      setHasItemsTrackedForSelectedDate(false);
      return;
    }

    let mounted = true;
    setIsLoadingYesterday(true);
    const baseDay = localCalendarDayDate(logDate ?? new Date());
    const yesterdayDay = new Date(localDayKeyPlusCalendarDays(localDayStartMs(baseDay), -1));

    const doTask = async () => {
      try {
        const [logs, todayLogs] = await Promise.all([
          NutritionService.getNutritionLogsForMeal(yesterdayDay, mealType),
          NutritionService.getNutritionLogsForMeal(baseDay, mealType),
        ]);

        if (mounted) {
          setHasItemsTrackedForSelectedDate(todayLogs.length > 0);
        }

        if (!mounted || logs.length === 0) {
          if (mounted) {
            setYesterdayMealData(null);
          }
          return;
        }

        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        const items: { name: string; calories: number }[] = [];
        for (const log of logs) {
          const [name, nutrients] = await Promise.all([log.getDisplayName(), log.getNutrients()]);
          totalCalories += nutrients.calories;
          totalProtein += nutrients.protein;
          totalCarbs += nutrients.carbs;
          totalFat += nutrients.fat;
          items.push({ name, calories: Math.round(nutrients.calories) });
        }

        if (mounted) {
          setYesterdayMealData({
            logs,
            totalCalories: Math.round(totalCalories),
            totalProtein: Math.round(totalProtein),
            totalCarbs: Math.round(totalCarbs),
            totalFat: Math.round(totalFat),
            items,
          });
        }
      } catch (err) {
        console.error('Error loading yesterday meal:', err);
        if (mounted) {
          setYesterdayMealData(null);
          setHasItemsTrackedForSelectedDate(false);
        }
      } finally {
        if (mounted) {
          setIsLoadingYesterday(false);
        }
      }
    };

    doTask();

    return () => {
      mounted = false;
    };
  }, [visible, mealType, logDate]);

  return { yesterdayMealData, isLoadingYesterday, hasItemsTrackedForSelectedDate };
}
