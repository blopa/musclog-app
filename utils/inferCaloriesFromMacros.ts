import {
  CALORIES_FOR_ALCOHOL,
  CALORIES_FOR_CARBS,
  CALORIES_FOR_FAT,
  CALORIES_FOR_FIBER,
  CALORIES_FOR_PROTEIN,
} from '@/constants/nutrition';

import { roundToDecimalPlaces } from './roundDecimal';

/** Coerce API / DB values that may be strings (e.g. "0") into finite numbers for macro comparisons. */
export function toFiniteMacro(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** True if any of protein, carbs, fat, or fiber is non-zero (per 100g). */
export function hasAnyMacroValue(data: {
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
  fiber?: unknown;
}): boolean {
  return (
    Math.abs(toFiniteMacro(data.protein)) > 0 ||
    Math.abs(toFiniteMacro(data.carbs)) > 0 ||
    Math.abs(toFiniteMacro(data.fat)) > 0 ||
    Math.abs(toFiniteMacro(data.fiber)) > 0
  );
}

/**
 * US-style energy from macros (per 100g): total carbohydrate includes fiber; fiber is counted at 2 kcal/g.
 * digestible carbs = max(0, carbs − fiber). Alcohol contributes 7 kcal/g.
 */
export function inferCaloriesFromMacrosPer100g(
  protein: unknown,
  carbs: unknown,
  fat: unknown,
  fiber: unknown,
  alcohol?: unknown
): number {
  const p = Math.max(0, toFiniteMacro(protein));
  const c = Math.max(0, toFiniteMacro(carbs));
  const f = Math.max(0, toFiniteMacro(fat));
  const fib = Math.max(0, toFiniteMacro(fiber));
  const alc = Math.max(0, toFiniteMacro(alcohol));
  const digestibleCarbs = Math.max(0, c - fib);

  return (
    CALORIES_FOR_PROTEIN * p +
    CALORIES_FOR_CARBS * digestibleCarbs +
    CALORIES_FOR_FAT * f +
    CALORIES_FOR_FIBER * fib +
    CALORIES_FOR_ALCOHOL * alc
  );
}

export type NutritionalDataShape = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  saturatedFat: number;
  sodium: number;
  alcohol?: number;
  potassium?: number;
  magnesium?: number;
  zinc?: number;
};

export function applyInferredCaloriesFromMacrosIfNeeded(
  data: NutritionalDataShape
): NutritionalDataShape {
  const cal = toFiniteMacro(data.calories);
  if (cal > 0 || !hasAnyMacroValue(data)) {
    return data;
  }

  const inferred = inferCaloriesFromMacrosPer100g(
    data.protein,
    data.carbs,
    data.fat,
    data.fiber,
    data.alcohol
  );
  if (!Number.isFinite(inferred) || inferred <= 0) {
    return data;
  }

  return {
    ...data,
    calories: roundToDecimalPlaces(inferred, 2),
  };
}

/**
 * Rounded per-100g kcal for list/search UI: when energy is missing or zero, infer from macros if possible.
 */
export function resolveRoundedPer100gCaloriesForDisplay(input: {
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
  fiber?: unknown;
}): number {
  const cal = toFiniteMacro(input.calories);
  if (cal > 0) {
    return Math.round(cal);
  }

  if (!hasAnyMacroValue(input)) {
    return Math.round(cal);
  }

  const inferred = inferCaloriesFromMacrosPer100g(
    input.protein,
    input.carbs,
    input.fat,
    input.fiber
  );

  if (!Number.isFinite(inferred) || inferred <= 0) {
    return Math.round(cal);
  }

  return Math.round(inferred);
}
