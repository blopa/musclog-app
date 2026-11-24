// Cheap, deterministic checks on the numbers an AI meal estimate returns, so an ingredient whose
// figures cannot all be true is estimated once more instead of being logged as it came. Pure and
// relative-import-only. Carbs here are the AI's NET carbs (`FOOD_SOURCE_CARBS_CONVENTION.ai`), so the
// energy the macros add up to is `4·protein + 4·carbs + 9·fat + 2·fiber`, the same note the macro
// prompt gives the model. Numbers that came from the person's own food database are never checked:
// they are authoritative.

export type MacroProblem =
  /** A value is negative or not a number, or the grams are not above zero. */
  | 'invalidValue'
  /** Energy is stated but the macros are all (nearly) zero. */
  | 'energyWithoutMacros'
  /** The macros carry real energy but the stated energy is (nearly) zero. */
  | 'macrosWithoutEnergy'
  /** Stated energy and the energy the macros add up to differ by more than a rounded estimate would. */
  | 'energyMismatch'
  /** Protein, carbs, fat and fiber together weigh more than the ingredient. */
  | 'massExceedsGrams'
  /** More energy per gram than pure fat has. */
  | 'impossibleDensity';

export type CheckableIngredient = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  grams: number;
};

/** Energy below this is rounding noise, not a claim. */
const NEGLIGIBLE_KCAL = 20;
/** Energy and macros may differ by this share, or `ENERGY_SLACK_KCAL`, whichever is larger. */
const ENERGY_TOLERANCE_SHARE = 0.25;
const ENERGY_SLACK_KCAL = 30;
/** Macro mass may exceed the grams by this share plus `MASS_SLACK_G` for rounding. */
const MASS_TOLERANCE_SHARE = 0.05;
const MASS_SLACK_G = 1;
/** Pure fat is 9 kcal/g; the slack covers rounding of small amounts. */
const MAX_KCAL_PER_GRAM = 9.5;
const DENSITY_SLACK_KCAL = 5;

export function macroEnergyKcal(ingredient: CheckableIngredient): number {
  return (
    4 * ingredient.protein + 4 * ingredient.carbs + 9 * ingredient.fat + 2 * (ingredient.fiber ?? 0)
  );
}

/** Every reason the ingredient's numbers cannot all be right; empty when they hang together. */
export function ingredientMacroProblems(ingredient: CheckableIngredient): MacroProblem[] {
  const values = [
    ingredient.kcal,
    ingredient.protein,
    ingredient.carbs,
    ingredient.fat,
    ingredient.fiber ?? 0,
    ingredient.grams,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0) || ingredient.grams <= 0) {
    return ['invalidValue'];
  }

  const fiber = ingredient.fiber ?? 0;
  const macroMass = ingredient.protein + ingredient.carbs + ingredient.fat + fiber;
  const computed = macroEnergyKcal(ingredient);
  const larger = Math.max(ingredient.kcal, computed);
  const problems: MacroProblem[] = [];

  if (ingredient.kcal >= NEGLIGIBLE_KCAL && macroMass < 0.5) {
    problems.push('energyWithoutMacros');
  } else if (computed >= NEGLIGIBLE_KCAL && ingredient.kcal <= 1) {
    problems.push('macrosWithoutEnergy');
  } else if (
    larger >= 2 * ENERGY_SLACK_KCAL &&
    Math.abs(ingredient.kcal - computed) >
      Math.max(ENERGY_TOLERANCE_SHARE * larger, ENERGY_SLACK_KCAL)
  ) {
    problems.push('energyMismatch');
  }

  if (macroMass > ingredient.grams * (1 + MASS_TOLERANCE_SHARE) + MASS_SLACK_G) {
    problems.push('massExceedsGrams');
  }

  if (ingredient.kcal > MAX_KCAL_PER_GRAM * ingredient.grams + DENSITY_SLACK_KCAL) {
    problems.push('impossibleDensity');
  }

  return problems;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const nonNegative = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);

/**
 * The last resort for numbers that still cannot all be true after a re-estimate: a model can
 * repeat an impossible answer, and the review must never show figures that contradict each other.
 * Macros that weigh more than the ingredient are scaled down to its grams, then the energy follows
 * the macros (the more detailed claim); macros that are all zero leave the energy alone, since
 * nothing can be invented. This makes the figures agree, not true: the person still checks them.
 * A consistent ingredient is returned as the same object.
 */
export function reconcileIngredientMacros<T extends CheckableIngredient>(ingredient: T): T {
  if (ingredientMacroProblems(ingredient).length === 0) {
    return ingredient;
  }

  if (!Number.isFinite(ingredient.grams) || ingredient.grams <= 0) {
    return ingredient;
  }

  let protein = nonNegative(ingredient.protein);
  let carbs = nonNegative(ingredient.carbs);
  let fat = nonNegative(ingredient.fat);
  let fiber = nonNegative(ingredient.fiber ?? 0);
  let kcal = nonNegative(ingredient.kcal);

  const macroMass = protein + carbs + fat + fiber;
  if (macroMass > ingredient.grams) {
    const scale = ingredient.grams / macroMass;
    protein *= scale;
    carbs *= scale;
    fat *= scale;
    fiber *= scale;
  }

  if (protein + carbs + fat + fiber >= 0.5) {
    kcal = Math.round(macroEnergyKcal({ ...ingredient, kcal, protein, carbs, fat, fiber }));
  }

  return {
    ...ingredient,
    kcal,
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
    fiber: ingredient.fiber === undefined ? undefined : round1(fiber),
  };
}
