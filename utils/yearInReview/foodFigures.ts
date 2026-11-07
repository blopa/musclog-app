import type { Units } from '@/constants/settings';
import { kgToDisplay } from '@/utils/unitConversion';

/**
 * The comparisons the food posters make. Pure, and unit-free on purpose: "about 7 bowling balls" is
 * the same sentence in kilograms and in pounds, so only the figure beside it follows the account's
 * units. The masses are rough, everyday sizes (the copy says "about").
 */

/**
 * Protein in one cooked chicken breast. A product choice: roasted chicken breast is about 31 g of
 * protein per 100 g (USDA FoodData Central), and a medium cooked breast is around 130 g.
 */
export const PROTEIN_PER_CHICKEN_BREAST_G = 40;

/**
 * Objects a year of protein is weighed against, lightest first. A bag of whey is a 1 kg bag that is
 * about 80% protein, so it counts as 0.8 kg of the thing being weighed: protein, not powder.
 */
export const PROTEIN_COMPARISONS = [
  { id: 'wheyBag', massKg: 0.8 },
  { id: 'cat', massKg: 4.5 },
  { id: 'bowlingBall', massKg: 7.3 },
  { id: 'barbell', massKg: 20 },
] as const;

export type ProteinComparisonId = (typeof PROTEIN_COMPARISONS)[number]['id'];

/**
 * A comparison needs about two of the object ("about 1 cat" is not one). Slightly under 2, so the
 * rounded count of 2 is never more than a seventh off: 1.5 barbells is not "about 2".
 */
const MIN_COMPARISON_RATIO = 1.75;

/** The heaviest object that still makes at least two, so the count stays a readable number. */
export function proteinComparison(
  proteinG: number
): { id: ProteinComparisonId; count: number } | null {
  const massKg = proteinG / 1000;
  let pick: { id: ProteinComparisonId; count: number } | null = null;
  for (const object of PROTEIN_COMPARISONS) {
    const ratio = massKg / object.massKg;
    if (ratio >= MIN_COMPARISON_RATIO) {
      pick = { id: object.id, count: Math.round(ratio) };
    }
  }

  return pick;
}

/** How many chicken breasts hold this much protein, rounded; `0` for less than one. */
export function chickenBreastsOf(proteinG: number): number {
  return Math.round(proteinG / PROTEIN_PER_CHICKEN_BREAST_G);
}

/** A mass of food macros in the account's weight unit, unrounded: the poster rounds it. */
export function macroMassInUnits(grams: number, units: Units): number {
  return kgToDisplay(grams / 1000, units);
}

/** Past this a figure drops its decimal: "142 kg" reads cleaner than "141.8 kg". */
const WHOLE_NUMBER_FROM = 100;

/** Decimals to show for a mass figure: one under 100, none above. */
export function massFractionDigits(display: number): 0 | 1 {
  return display >= WHOLE_NUMBER_FROM ? 0 : 1;
}
