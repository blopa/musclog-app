import type { Gender } from '@/database/models';
import type { Units } from '@/constants/settings';
import {
  calculateBMR,
  calculateTDEE,
  getEffectiveKcalPerKgGoalChange,
  getMinCalories,
} from '@/utils/nutritionCalculator';
import { displayToCm, displayToKg } from '@/utils/unitConversion';

import { isInRange, isWholeInRange, parseToolNumber } from './toolNumbers';

/** The five activity levels the app's TDEE uses (ACTIVITY_MULTIPLIERS). */
export const CALORIE_ACTIVITY_LEVELS = [1, 2, 3, 4, 5] as const;

/**
 * Musclog product choice, not a measured error: the TDEE estimate is shown as a range of this share
 * either side of the target, because population estimates are uncertain.
 */
export const TDEE_RANGE_SHARE = 0.1;
/** Musclog product guideline: a pace above this share of body weight per week is flagged. */
export const PACE_WARNING_SHARE_PER_WEEK = 0.01;
/** Musclog product guideline: a deficit above this share of TDEE is flagged. */
export const DEFICIT_WARNING_SHARE_OF_TDEE = 0.25;

const MIN_AGE = 15;
const MAX_AGE = 100;
const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 250;
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 400;
const MS_PER_DAY = 86_400_000;

export interface CalorieDeficitInput {
  units: Units;
  sex: Gender;
  ageText: string;
  heightText: string;
  weightText: string;
  activityLevel: number;
  goalWeightText: string;
  /** ISO calendar date `YYYY-MM-DD`, or empty when not chosen yet. */
  goalDate: string;
  /** ISO calendar date `YYYY-MM-DD` for today, passed in so the model is testable. */
  today: string;
}

export type CalorieDeficitProblem =
  'age' | 'height' | 'weight' | 'goalWeight' | 'goalDate' | 'goalDateNotFuture';

export type CalorieDeficitWarning =
  'paceTooFast' | 'deficitTooLarge' | 'floorApplied' | 'floorAboveTdee' | 'noChange';

export interface CalorieDeficitPlan {
  direction: 'loss' | 'gain' | 'none';
  currentWeightKg: number;
  goalWeightKg: number;
  /** Goal minus current, in kg. Negative for a loss. */
  weightChangeKg: number;
  days: number;
  bmr: number;
  tdee: number;
  /** The app's minimum calorie floor for this sex and BMR. */
  minCalories: number;
  /** Energy per kg of weight change, from the app's own goal-change rule. */
  kcalPerKg: number;
  /** The daily deficit (loss) or surplus (gain) the goal date asks for, as a positive number. */
  requiredDailyChange: number;
  /** The daily calorie target after the floor is applied. */
  target: number;
  /** True when the floor moved the target up. */
  clamped: boolean;
  /** Days from today to the earliest date the floor allows, when clamped. */
  laterDays: number | null;
  laterDate: string | null;
  /** Weekly change for the goal date, in kg, signed like the weight change. */
  weeklyChangeKg: number;
  /** The required deficit as a share of TDEE. Zero when not a loss. */
  deficitShareOfTdee: number;
  /** The target with TDEE 10% lower and 10% higher, the honest range of the estimate. */
  rangeLow: number;
  rangeHigh: number;
  warnings: CalorieDeficitWarning[];
}

export type CalorieDeficitValidation =
  { ok: true; plan: CalorieDeficitPlan } | { ok: false; problem: CalorieDeficitProblem | null };

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses `YYYY-MM-DD` into a UTC midnight timestamp, or null for anything that is not a real day. */
export function parseIsoDay(value: string): number | null {
  const match = ISO_DAY.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return ms;
}

/** Adds whole calendar days to an ISO day. Calendar arithmetic, so no DST drift. */
export function addIsoDays(isoDay: string, days: number): string {
  const ms = parseIsoDay(isoDay);
  if (ms === null) {
    return isoDay;
  }

  return new Date(ms + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * The calorie target for a goal weight and date, from the app's own TDEE, floor and kcal-per-kg
 * functions. `problem: null` means a field is still empty.
 */
export function calorieDeficitPlan(input: CalorieDeficitInput): CalorieDeficitValidation {
  if (
    input.ageText.trim() === '' ||
    input.heightText.trim() === '' ||
    input.weightText.trim() === '' ||
    input.goalWeightText.trim() === '' ||
    input.goalDate.trim() === ''
  ) {
    return { ok: false, problem: null };
  }

  const age = parseToolNumber(input.ageText);
  if (!isWholeInRange(age, MIN_AGE, MAX_AGE)) {
    return { ok: false, problem: 'age' };
  }

  const heightDisplay = parseToolNumber(input.heightText);
  const heightCm = heightDisplay === null ? null : displayToCm(heightDisplay, input.units);
  if (heightCm === null || !isInRange(heightCm, MIN_HEIGHT_CM, MAX_HEIGHT_CM)) {
    return { ok: false, problem: 'height' };
  }

  const weightDisplay = parseToolNumber(input.weightText);
  const currentWeightKg = weightDisplay === null ? null : displayToKg(weightDisplay, input.units);
  if (currentWeightKg === null || !isInRange(currentWeightKg, MIN_WEIGHT_KG, MAX_WEIGHT_KG)) {
    return { ok: false, problem: 'weight' };
  }

  const goalDisplay = parseToolNumber(input.goalWeightText);
  const goalWeightKg = goalDisplay === null ? null : displayToKg(goalDisplay, input.units);
  if (goalWeightKg === null || !isInRange(goalWeightKg, MIN_WEIGHT_KG, MAX_WEIGHT_KG)) {
    return { ok: false, problem: 'goalWeight' };
  }

  const goalMs = parseIsoDay(input.goalDate);
  const todayMs = parseIsoDay(input.today);
  if (goalMs === null || todayMs === null) {
    return { ok: false, problem: 'goalDate' };
  }

  const days = Math.round((goalMs - todayMs) / MS_PER_DAY);
  if (days < 1) {
    return { ok: false, problem: 'goalDateNotFuture' };
  }

  const bmr = calculateBMR(input.sex, currentWeightKg, heightCm, age);
  const tdee = calculateTDEE({ bmr, activityLevel: input.activityLevel });
  const minCalories = getMinCalories(input.sex, bmr);
  const weightChangeKg = goalWeightKg - currentWeightKg;
  const direction = weightChangeKg === 0 ? 'none' : weightChangeKg < 0 ? 'loss' : 'gain';

  const warnings: CalorieDeficitWarning[] = [];
  if (direction === 'none') {
    warnings.push('noChange');
    return {
      ok: true,
      plan: {
        direction,
        currentWeightKg,
        goalWeightKg,
        weightChangeKg,
        days,
        bmr,
        tdee,
        minCalories,
        kcalPerKg: 0,
        requiredDailyChange: 0,
        target: tdee,
        clamped: false,
        laterDays: null,
        laterDate: null,
        weeklyChangeKg: 0,
        deficitShareOfTdee: 0,
        rangeLow: tdee - TDEE_RANGE_SHARE * tdee,
        rangeHigh: tdee + TDEE_RANGE_SHARE * tdee,
        warnings,
      },
    };
  }

  const kcalPerKg = getEffectiveKcalPerKgGoalChange(
    direction === 'loss' ? 'lose' : 'gain',
    currentWeightKg,
    goalWeightKg,
    undefined,
    input.sex
  );
  if (kcalPerKg === null) {
    return { ok: false, problem: 'goalWeight' };
  }

  const totalKcal = kcalPerKg * Math.abs(weightChangeKg);
  const requiredDailyChange = totalKcal / days;
  const deficitShareOfTdee = direction === 'loss' && tdee > 0 ? requiredDailyChange / tdee : 0;

  let target = direction === 'loss' ? tdee - requiredDailyChange : tdee + requiredDailyChange;
  let clamped = false;
  let laterDays: number | null = null;
  let laterDate: string | null = null;

  if (direction === 'loss' && target < minCalories) {
    clamped = true;
    target = minCalories;
    warnings.push('floorApplied');
    const achievableDeficit = tdee - minCalories;
    if (achievableDeficit > 0) {
      laterDays = Math.ceil(totalKcal / achievableDeficit);
      laterDate = addIsoDays(input.today, laterDays);
    } else {
      warnings.push('floorAboveTdee');
    }
  }

  const weeklyChangeKg = (weightChangeKg / days) * 7;
  if (Math.abs(weeklyChangeKg) > PACE_WARNING_SHARE_PER_WEEK * currentWeightKg) {
    warnings.push('paceTooFast');
  }
  if (deficitShareOfTdee > DEFICIT_WARNING_SHARE_OF_TDEE) {
    warnings.push('deficitTooLarge');
  }

  return {
    ok: true,
    plan: {
      direction,
      currentWeightKg,
      goalWeightKg,
      weightChangeKg,
      days,
      bmr,
      tdee,
      minCalories,
      kcalPerKg,
      requiredDailyChange,
      target,
      clamped,
      laterDays,
      laterDate,
      weeklyChangeKg,
      deficitShareOfTdee,
      rangeLow: target - TDEE_RANGE_SHARE * tdee,
      rangeHigh: target + TDEE_RANGE_SHARE * tdee,
      warnings,
    },
  };
}
