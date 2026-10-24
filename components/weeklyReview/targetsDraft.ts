import type { NutritionTargets } from '@/database/services/NutritionTargetService';
import { goalCaloriesFromMacros } from '@/utils/carbsConvention';
import { getDecimalSeparator, parseStrictLocalizedNumber } from '@/utils/localizedDecimalInput';

export const TARGET_FIELDS = ['totalCalories', 'protein', 'carbs', 'fats', 'fiber'] as const;
export type TargetField = (typeof TARGET_FIELDS)[number];
export type TargetsDraft = Record<TargetField, string>;

/**
 * How far the calorie target may sit from what the macros add up to before the editor says so.
 * The app's own recommendations do not add up exactly — fiber is set on top of a split that already
 * spends the calories — so a tight bound would flag every untouched recommendation.
 */
export const MACRO_CALORIE_MISMATCH_SHARE = 0.05;

const formatField = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 1 }).format(value);

/** The editor's text fields for a set of targets, in the locale's own notation. */
export function targetsDraftFrom(targets: NutritionTargets, locale: string): TargetsDraft {
  return Object.fromEntries(
    TARGET_FIELDS.map((field) => [field, formatField(targets[field], locale)])
  ) as TargetsDraft;
}

export type TargetsDraftReading = {
  /** The targets to save, or `null` while any field is invalid. */
  targets: NutritionTargets | null;
  /** Fields that cannot be saved as typed: not a number, or a calorie target of zero. */
  invalid: TargetField[];
  /** What the macros add up to (goal convention), when all four read. */
  macroCalories: number | null;
  /** The calorie target and the macros describe noticeably different days. */
  mismatch: boolean;
};

/**
 * Reads the editor's draft. Strict on purpose: the lenient decimal parser turns an emptied field
 * into 0 and "2.300" into 2,3 for a comma locale, and these numbers become the user's targets.
 */
export function readTargetsDraft(draft: TargetsDraft, locale: string): TargetsDraftReading {
  const separator = getDecimalSeparator(locale);
  const values = Object.fromEntries(
    TARGET_FIELDS.map((field) => [field, parseStrictLocalizedNumber(draft[field], separator)])
  ) as Record<TargetField, number | null>;
  const invalid = TARGET_FIELDS.filter(
    (field) => values[field] == null || (field === 'totalCalories' && values[field] <= 0)
  );
  const { protein, carbs, fats, fiber, totalCalories } = values;
  const macroCalories =
    protein != null && carbs != null && fats != null && fiber != null
      ? Math.round(goalCaloriesFromMacros({ protein, carbs, fats, fiber }))
      : null;
  const mismatch =
    macroCalories != null &&
    totalCalories != null &&
    totalCalories > 0 &&
    Math.abs(macroCalories - totalCalories) > totalCalories * MACRO_CALORIE_MISMATCH_SHARE;

  return {
    targets: invalid.length ? null : (values as NutritionTargets),
    invalid,
    macroCalories,
    mismatch,
  };
}
