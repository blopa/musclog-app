import { differenceInCalendarDays } from 'date-fns';

import type { EatingPhase, Gender, LiftingExperience } from '@/database/models';
import type NutritionGoal from '@/database/models/NutritionGoal';
import { SettingsService, UserMetricService, UserService } from '@/database/services';

import { localDayClosedRangeMaxMs, localDayStartMs } from './calendarDate';
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
  tdee: number;
}

export interface DynamicGoalTrajectoryInput {
  tdee: number;
  bmr: number;
  eatingPhase: EatingPhase;
  currentWeightKg: number;
  targetWeightKg: number;
  remainingDays: number;
  gender: Gender;
  liftingExperience?: LiftingExperience;
  bodyFatPercent?: number;
  disableMinimumCalories: boolean;
}

/**
 * Derive the daily calories that best match a target weight by a target date while respecting
 * the selected phase bounds and minimum-calorie safety floor.
 */
export function resolveGoalTrajectoryCalories({
  tdee,
  bmr,
  eatingPhase,
  currentWeightKg,
  targetWeightKg,
  remainingDays,
  gender,
  liftingExperience,
  bodyFatPercent,
  disableMinimumCalories,
}: DynamicGoalTrajectoryInput): number {
  if (!Number.isFinite(tdee) || tdee <= 0 || remainingDays <= 0) {
    return Math.round(Math.max(0, tdee));
  }

  const minCalories = disableMinimumCalories ? 0 : getMinCalories(gender, bmr);
  const phaseLowerBound =
    eatingPhase === 'bulk' ? Math.max(minCalories, Math.ceil(tdee)) : minCalories;
  let phaseUpperBound =
    eatingPhase === 'cut'
      ? Math.max(phaseLowerBound, Math.floor(tdee))
      : Math.max(phaseLowerBound, Math.ceil(tdee) + 2000);

  const projectWeightForCalories = (dailyCalories: number): number =>
    currentWeightKg +
    computeWeightChangeFromCalorieDelta((dailyCalories - tdee) * remainingDays, currentWeightKg, {
      bodyFatPercent,
      liftingExperience,
      gender,
    });

  if (eatingPhase !== 'cut') {
    while (projectWeightForCalories(phaseUpperBound) < targetWeightKg && phaseUpperBound < 8000) {
      phaseUpperBound += 250;
    }
  }

  let low = phaseLowerBound;
  let high = phaseUpperBound;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (projectWeightForCalories(mid) < targetWeightKg) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const candidates = [Math.max(phaseLowerBound, low - 1), low, phaseUpperBound]
    .filter((value, index, values) => value <= phaseUpperBound && values.indexOf(value) === index)
    .map((value) => ({
      calories: value,
      delta: Math.abs(projectWeightForCalories(value) - targetWeightKg),
    }))
    .sort((a, b) => a.delta - b.delta);

  return Math.round(candidates[0]?.calories ?? tdee);
}

// Deduplicate concurrent requests for the same goal/day without caching stale results
// across later metric or nutrition-log updates.
const inFlight = new Map<string, Promise<ResolvedMacros | null>>();

type DynamicGoalLike = {
  eatingPhase: EatingPhase;
  targetWeight?: number | null;
  targetDate?: number | null;
};

async function resolveDynamicGoalLike(
  goal: DynamicGoalLike,
  date: Date
): Promise<ResolvedMacros | null> {
  const asOfDayMs = localDayStartMs(date);
  const asOfMetricMaxMs = localDayClosedRangeMaxMs(date);
  const normalizedTargetWeight = normalizeNutritionGoalTargetWeight(goal.targetWeight);
  const hasExplicitTrajectoryTarget = normalizedTargetWeight != null && goal.targetDate != null;

  const [
    user,
    weightMetric,
    heightMetric,
    bodyFatMetric,
    historicalParams,
    disableMinimumCalories,
    useBfForCalculations,
  ] = await Promise.all([
    UserService.getCurrentUser(),
    UserMetricService.getLatestOnOrBefore('weight', asOfMetricMaxMs),
    UserMetricService.getLatestOnOrBefore('height', asOfMetricMaxMs),
    UserMetricService.getLatestOnOrBefore('body_fat', asOfMetricMaxMs),
    hasExplicitTrajectoryTarget
      ? Promise.resolve(null)
      : getHistoricalNutritionParams({ asOfDate: date, useWeeklyAverages: true }),
    SettingsService.getDisableMinimumCalories(),
    SettingsService.getUseBfForCalculations(),
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

  let rawBodyFatPercent: number | undefined;
  if (bodyFatMetric) {
    const d = await bodyFatMetric.getDecrypted();
    rawBodyFatPercent = d.value;
  }

  const bodyFatPercent = useBfForCalculations ? rawBodyFatPercent : undefined;

  const activityLevel = Math.max(1, Math.min(5, user.activityLevel ?? 2)) as 1 | 2 | 3 | 4 | 5;
  const gender = user.gender ?? 'other';
  const fitnessGoal = user.fitnessGoal ?? 'general';
  const liftingExperience = user.liftingExperience ?? 'intermediate';

  const effectiveHistoricalParams = useBfForCalculations
    ? (historicalParams ?? {})
    : {
        ...historicalParams,
        historicalInitialFatPercent: undefined,
        historicalFinalFatPercent: undefined,
      };

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
    disableMinimumCalories,
    ...effectiveHistoricalParams,
  });

  let targetCalories = Math.round(basePlan.targetCalories);
  const remainingDays =
    goal.targetDate != null
      ? differenceInCalendarDays(new Date(goal.targetDate), new Date(asOfDayMs))
      : 0;

  if (normalizedTargetWeight != null && remainingDays > 0) {
    targetCalories = resolveGoalTrajectoryCalories({
      tdee: basePlan.tdee,
      bmr: basePlan.bmr,
      eatingPhase: goal.eatingPhase,
      currentWeightKg: weightKg,
      targetWeightKg: normalizedTargetWeight,
      remainingDays,
      gender,
      liftingExperience,
      bodyFatPercent,
      disableMinimumCalories,
    });
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
    tdee: Math.round(basePlan.tdee),
  };
}

export async function resolveDynamicGoalPreview(
  goal: DynamicGoalLike,
  date: Date
): Promise<ResolvedMacros | null> {
  return resolveDynamicGoalLike(goal, date);
}

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

  const request = resolveDynamicGoalLike(goal, date);

  inFlight.set(requestKey, request);

  try {
    return await request;
  } finally {
    inFlight.delete(requestKey);
  }
}
