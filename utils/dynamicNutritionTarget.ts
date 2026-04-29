import { differenceInCalendarDays } from 'date-fns';

import type NutritionGoal from '@/database/models/NutritionGoal';
import { UserMetricService, UserService } from '@/database/services';

import { localDayStartMs } from './calendarDate';
import { getHistoricalNutritionParams } from './historicalNutritionParams';
import {
  calculateMacros,
  calculateNutritionPlan,
  computeWeightChangeFromCalorieDelta,
  eatingPhaseToWeightGoal,
  fiberFromCalories,
  getMinCalories,
} from './nutritionCalculator';
import { normalizeNutritionGoalTargetWeight } from './nutritionGoalHelpers';
import { storedHeightToCm, storedWeightToKg } from './unitConversion';

export interface ResolvedMacros {
  totalCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  isDynamic: true;
  usedEmpiricalData: boolean;
}

// Deduplicate concurrent requests for the same goal/day without caching stale results
// across later metric or nutrition-log updates.
const inFlight = new Map<string, Promise<ResolvedMacros | null>>();

/**
 * Resolves effective macros for a dynamic nutrition goal on a given day.
 * Returns null when called on a non-dynamic goal (caller should read goal fields directly).
 *
 * Uses the last 30 days of nutrition logs + weekly weight averages for empirical TDEE when available.
 * If the goal has a target weight and target date in the future, daily calories are adjusted to
 * follow that trajectory while still respecting the chosen eating phase and calorie safety floor.
 */
export async function resolveDailyMacros(
  goal: NutritionGoal,
  date: Date
): Promise<ResolvedMacros | null> {
  if (!goal.isDynamic) {
    return null;
  }

  const asOfDayMs = localDayStartMs(date);
  const requestKey = `${goal.id}:${goal.updatedAt}:${asOfDayMs}`;
  const existing = inFlight.get(requestKey);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const [user, weightMetric, heightMetric, bodyFatMetric, historicalParams] = await Promise.all([
      UserService.getCurrentUser(),
      UserMetricService.getLatestOnOrBefore('weight', asOfDayMs),
      UserMetricService.getLatestOnOrBefore('height', asOfDayMs),
      UserMetricService.getLatestOnOrBefore('body_fat', asOfDayMs),
      getHistoricalNutritionParams({ asOfDate: date, useWeeklyAverages: true }),
    ]);

    if (!user) {
      return null;
    }

    let weightKg = 70;
    if (weightMetric) {
      const d = await weightMetric.getDecrypted();
      weightKg = storedWeightToKg(d.value, d.unit);
    }

    let heightCm = 170;
    if (heightMetric) {
      const d = await heightMetric.getDecrypted();
      heightCm = storedHeightToCm(d.value, d.unit);
    }

    let bodyFatPercent: number | undefined;
    if (bodyFatMetric) {
      const d = await bodyFatMetric.getDecrypted();
      bodyFatPercent = d.value;
    }

    const activityLevel = Math.max(1, Math.min(5, user.activityLevel ?? 2)) as 1 | 2 | 3 | 4 | 5;
    const gender = user.gender ?? 'male';
    const fitnessGoal = user.fitnessGoal ?? 'general';
    const liftingExperience = user.liftingExperience ?? 'intermediate';

    const basePlan = calculateNutritionPlan({
      gender,
      weightKg,
      heightCm,
      age: user.getAge(),
      activityLevel,
      weightGoal: eatingPhaseToWeightGoal(goal.eatingPhase),
      fitnessGoal,
      liftingExperience,
      bodyFatPercent,
      ...(historicalParams ?? {}),
    });

    let targetCalories = Math.round(basePlan.targetCalories);
    const normalizedTargetWeight = normalizeNutritionGoalTargetWeight(goal.targetWeight);
    const remainingDays =
      goal.targetDate != null
        ? differenceInCalendarDays(new Date(goal.targetDate), new Date(asOfDayMs))
        : 0;

    if (normalizedTargetWeight != null && remainingDays > 0) {
      const tdee = basePlan.tdee;
      const minCalories = getMinCalories(gender, basePlan.bmr);
      const phaseLowerBound =
        goal.eatingPhase === 'bulk' ? Math.max(minCalories, Math.ceil(tdee)) : minCalories;
      let phaseUpperBound =
        goal.eatingPhase === 'cut'
          ? Math.max(phaseLowerBound, Math.floor(tdee))
          : Math.max(phaseLowerBound, Math.ceil(tdee) + 2000);

      const projectWeightForCalories = (dailyCalories: number): number =>
        weightKg +
        computeWeightChangeFromCalorieDelta((dailyCalories - tdee) * remainingDays, weightKg, {
          bodyFatPercent,
          liftingExperience,
          gender,
        });

      if (goal.eatingPhase !== 'cut') {
        while (
          projectWeightForCalories(phaseUpperBound) < normalizedTargetWeight &&
          phaseUpperBound < 8000
        ) {
          phaseUpperBound += 250;
        }
      }

      let low = phaseLowerBound;
      let high = phaseUpperBound;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (projectWeightForCalories(mid) < normalizedTargetWeight) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }

      const candidates = [Math.max(phaseLowerBound, low - 1), low, phaseUpperBound]
        .filter(
          (value, index, values) => value <= phaseUpperBound && values.indexOf(value) === index
        )
        .map((value) => ({
          calories: value,
          delta: Math.abs(projectWeightForCalories(value) - normalizedTargetWeight),
        }))
        .sort((a, b) => a.delta - b.delta);

      targetCalories = candidates[0]?.calories ?? targetCalories;
    }

    const macros = calculateMacros(targetCalories, fitnessGoal, {
      weightKg,
      bodyFatPercent,
    });

    return {
      totalCalories: Math.round(targetCalories),
      protein: Math.round(macros.protein),
      carbs: Math.round(macros.carbs),
      fats: Math.round(macros.fats),
      fiber: fiberFromCalories(targetCalories),
      isDynamic: true as const,
      usedEmpiricalData: historicalParams !== null,
    };
  })();

  inFlight.set(requestKey, request);

  try {
    return await request;
  } finally {
    inFlight.delete(requestKey);
  }
}
