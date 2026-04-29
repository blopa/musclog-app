import type NutritionGoal from '@/database/models/NutritionGoal';
import { UserMetricService, UserService } from '@/database/services';

import { localDayStartMs } from './calendarDate';
import { getHistoricalNutritionParams } from './historicalNutritionParams';
import {
  calculateNutritionPlan,
  eatingPhaseToWeightGoal,
  fiberFromCalories,
} from './nutritionCalculator';
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

// Cache resolved macros per (goalId, localDayStartMs) for 5 minutes to avoid
// redundant DB reads when WatermelonDB subscriptions fire for unrelated changes.
const cache = new Map<string, { result: ResolvedMacros; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolves today's effective macros for a dynamic nutrition goal.
 * Returns null when called on a non-dynamic goal (caller should read goal fields directly).
 *
 * Uses the last 30 days of nutrition logs + weekly weight averages for empirical TDEE.
 * Falls back silently to formula TDEE (Mifflin-St Jeor × activity) when data is insufficient.
 */
export async function resolveDailyMacros(
  goal: NutritionGoal,
  date: Date
): Promise<ResolvedMacros | null> {
  if (!goal.isDynamic) {
    return null;
  }

  const asOfDayMs = localDayStartMs(date);
  const cacheKey = `${goal.id}:${asOfDayMs}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.result;
  }

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

  const plan = calculateNutritionPlan({
    gender: user.gender ?? 'male',
    weightKg,
    heightCm,
    age: user.getAge(),
    activityLevel,
    weightGoal: eatingPhaseToWeightGoal(goal.eatingPhase),
    fitnessGoal: user.fitnessGoal ?? 'general',
    liftingExperience: user.liftingExperience ?? 'intermediate',
    bodyFatPercent,
    ...(historicalParams ?? {}),
  });

  const result: ResolvedMacros = {
    totalCalories: Math.round(plan.targetCalories),
    protein: Math.round(plan.protein),
    carbs: Math.round(plan.carbs),
    fats: Math.round(plan.fats),
    fiber: fiberFromCalories(plan.targetCalories),
    isDynamic: true,
    usedEmpiricalData: historicalParams !== null,
  };

  cache.set(cacheKey, { result, ts: Date.now() });
  return result;
}
