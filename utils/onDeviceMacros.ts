/**
 * Pure helpers for the on-device model's meal estimates. A tiny model returns energy that
 * contradicts its own macros, so it is asked for a label per 100 g, which is scaled and made
 * consistent here; fiber comes from an optional second text request.
 */
import { median } from 'simple-statistics';

import { clampNonNegative, macroEnergyKcal } from './mealPlausibility';
import { roundToDecimalPlaces } from './roundDecimal';

export { clampNonNegative };

export type OnDeviceMacroIngredient = {
  name: string;
  grams: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type OnDeviceEstimatedIngredient = OnDeviceMacroIngredient & {
  kcal: number;
  fiber: number;
};

/**
 * Fiber is tracked unless its position in the nutrition display setting (index 3 of carbs, protein,
 * fats, fiber, alcohol) is exactly '0', the same rule the daily summary card uses.
 */
export function isFiberTracked(nutritionDisplay: string): boolean {
  return nutritionDisplay.charAt(3) !== '0';
}

/** A nutrition-facts label per 100 g, as the on-device model writes it. */
export type OnDeviceLabel = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

/**
 * Several per-100 g labels for one food (the High and Tokenmaxxing thinking levels) made into one:
 * each figure is the median of what the labels said, after `clampNonNegative`, and the name is the
 * first label's. One label is returned as it is; none gives undefined.
 */
export function medianLabel(labels: OnDeviceLabel[]): OnDeviceLabel | undefined {
  if (labels.length <= 1) {
    return labels[0];
  }

  const middle = (values: number[]): number => median(values.map(clampNonNegative));

  return {
    name: labels[0].name,
    kcal: middle(labels.map((label) => label.kcal)),
    protein: middle(labels.map((label) => label.protein)),
    carbs: middle(labels.map((label) => label.carbs)),
    fat: middle(labels.map((label) => label.fat)),
  };
}

/**
 * Scales a per-100 g label to `grams`. The model's energy wins: its macro ratios split it, so
 * the figures add up. Without energy it is computed from the macros; with nothing, all zero.
 * Carbs still include fiber here; `withLabelFiber` takes fiber out.
 */
export function fromLabelPer100g(label: OnDeviceLabel, grams: number): OnDeviceEstimatedIngredient {
  const weight = clampNonNegative(grams);
  const factor = weight / 100;
  let kcal = clampNonNegative(label.kcal) * factor;
  let protein = clampNonNegative(label.protein) * factor;
  let carbs = clampNonNegative(label.carbs) * factor;
  let fat = clampNonNegative(label.fat) * factor;
  const fromMacros = 4 * protein + 4 * carbs + 9 * fat;

  if (kcal > 0 && fromMacros > 0) {
    const ratio = kcal / fromMacros;
    protein *= ratio;
    carbs *= ratio;
    fat *= ratio;
  } else if (kcal === 0 && fromMacros > 0) {
    kcal = fromMacros;
  }

  return {
    name: label.name,
    grams: weight,
    protein: roundToDecimalPlaces(protein, 1),
    carbs: roundToDecimalPlaces(carbs, 1),
    fat: roundToDecimalPlaces(fat, 1),
    fiber: 0,
    kcal: Math.round(kcal),
  };
}

/**
 * Adds fiber from a per-100 g label: scaled to the grams, capped at the carbs (label carbs
 * include fiber), taken out of them (the app's AI carbs are net) and the energy recomputed.
 */
export function withLabelFiber(
  ingredient: OnDeviceEstimatedIngredient,
  fiberPer100g: unknown
): OnDeviceEstimatedIngredient {
  const fiber = roundToDecimalPlaces(
    Math.min((clampNonNegative(fiberPer100g) * ingredient.grams) / 100, ingredient.carbs),
    1
  );
  const carbs = roundToDecimalPlaces(Math.max(0, ingredient.carbs - fiber), 1);

  return {
    ...ingredient,
    fiber,
    carbs,
    kcal: Math.round(macroEnergyKcal({ ...ingredient, carbs, fiber })),
  };
}
