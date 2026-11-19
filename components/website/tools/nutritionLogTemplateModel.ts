import { inferCaloriesFromMacrosPer100g } from '@/utils/inferCaloriesFromMacros';

import { isInRange, parseToolNumber } from './toolNumbers';

export interface NutritionLogDownload {
  key: 'readyA4' | 'readyLetter' | 'per100A4' | 'per100Letter' | 'xlsx';
  /** The file in `public/downloads/`, written by `npm run generate-nutrition-log`. */
  file: string;
  /** Which sheet the file is: the macros already worked out, or the label's per 100 g numbers. */
  version: 'ready' | 'per100' | 'both';
}

/** The files the page offers. `scripts/generate-nutrition-log.js` writes exactly these names. */
export const NUTRITION_LOG_DOWNLOADS: readonly NutritionLogDownload[] = [
  { key: 'readyA4', file: 'musclog-nutrition-log-a4.pdf', version: 'ready' },
  { key: 'readyLetter', file: 'musclog-nutrition-log-letter.pdf', version: 'ready' },
  { key: 'per100A4', file: 'musclog-nutrition-log-per-100g-a4.pdf', version: 'per100' },
  { key: 'per100Letter', file: 'musclog-nutrition-log-per-100g-letter.pdf', version: 'per100' },
  { key: 'xlsx', file: 'musclog-nutrition-log.xlsx', version: 'both' },
];

/** Most a label can print per 100 g: a food has at most 100 g of anything in 100 g. */
const MAX_MACRO_PER_100G = 100;
/** Pure fat is about 900 kcal per 100 g, so no label goes above this. */
const MAX_KCAL_PER_100G = 900;
/** A day's food is never one item above this many grams. */
const MAX_GRAMS_EATEN = 5000;
/** Label rounding lets protein + carbs + fat read a hair above 100 g. */
const MACRO_SUM_TOLERANCE_G = 1;

export interface FoodPer100Input {
  kcalText: string;
  proteinText: string;
  carbsText: string;
  fatText: string;
  gramsText: string;
}

export type FoodPer100Problem = 'kcal' | 'protein' | 'carbs' | 'fat' | 'grams' | 'macrosTooHigh';

export interface FoodEaten {
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** True when the calories were estimated from the macros because the label's were left empty. */
  kcalEstimated: boolean;
}

export type FoodEatenValidation =
  { ok: true; result: FoodEaten } | { ok: false; problem: FoodPer100Problem | null };

/**
 * What the "per 100 g" sheet asks you to work out by hand: each per-100 g figure times the grams
 * eaten, divided by 100. Calories come from the label when typed; when left empty they are
 * estimated from the macros with the app's own energy rule, so the figure matches what a food
 * logged in Musclog would show.
 */
export function foodEatenFromPer100g(input: FoodPer100Input): FoodEatenValidation {
  const empty = [input.proteinText, input.carbsText, input.fatText, input.gramsText].some(
    (text) => text.trim() === ''
  );
  if (empty) {
    return { ok: false, problem: null };
  }

  const protein = parseToolNumber(input.proteinText);
  if (!isInRange(protein, 0, MAX_MACRO_PER_100G)) {
    return { ok: false, problem: 'protein' };
  }

  const carbs = parseToolNumber(input.carbsText);
  if (!isInRange(carbs, 0, MAX_MACRO_PER_100G)) {
    return { ok: false, problem: 'carbs' };
  }

  const fat = parseToolNumber(input.fatText);
  if (!isInRange(fat, 0, MAX_MACRO_PER_100G)) {
    return { ok: false, problem: 'fat' };
  }

  if (protein + carbs + fat > MAX_MACRO_PER_100G + MACRO_SUM_TOLERANCE_G) {
    return { ok: false, problem: 'macrosTooHigh' };
  }

  const grams = parseToolNumber(input.gramsText);
  if (!isInRange(grams, 0, MAX_GRAMS_EATEN)) {
    return { ok: false, problem: 'grams' };
  }

  const kcalTyped = input.kcalText.trim() !== '';
  const labelKcal = kcalTyped ? parseToolNumber(input.kcalText) : null;
  if (kcalTyped && !isInRange(labelKcal, 0, MAX_KCAL_PER_100G)) {
    return { ok: false, problem: 'kcal' };
  }

  const kcalPer100g = labelKcal ?? inferCaloriesFromMacrosPer100g(protein, carbs, fat, 0);
  const scale = grams / 100;

  return {
    ok: true,
    result: {
      grams,
      kcal: kcalPer100g * scale,
      protein: protein * scale,
      carbs: carbs * scale,
      fat: fat * scale,
      kcalEstimated: !kcalTyped,
    },
  };
}
