/**
 * Single source of truth for carbohydrate convention math.
 *
 * Carbohydrate labelling differs by region/source, and the app must normalize every food source to
 * ONE canonical convention before storing it. The canonical convention here — matching AGENTS.md
 * ("Carbs vs fiber convention") and {@link inferCaloriesFromMacrosPer100g} — is **total carbohydrate
 * including fiber** (the US/FDA "Total Carbohydrate"). Digestible/net carbs are then `total − fiber`.
 *
 * Per-source conventions (verified against the source standards, June 2026):
 *
 * - **US / Canada (FDA)** — "Total Carbohydrate" is computed *by subtraction* and **includes fiber**;
 *   the app normalizes this label shape to total carbs before applying its own energy convention.
 *   21 CFR 101.9(c)(6):
 *   https://www.ecfr.gov/current/title-21/section-101.9
 * - **USDA FoodData Central** — `Carbohydrate, by difference` (nutrient 1005/205) =
 *   `100 − (water + protein + fat + ash + alcohol)`, so it **includes fiber** → already `total`.
 *   https://fdc.nal.usda.gov/
 * - **EU (Reg. 1169/2011, Annex I)** — the declared "carbohydrate" means *available* carbohydrate and
 *   **excludes fiber** (fiber is a separate declared nutrient, counted at 2 kcal/g) → `net`;
 *   total = carbs + fiber. https://eur-lex.europa.eu/eli/reg/2011/1169/oj
 *   Plain-language US-vs-EU comparison:
 *   https://blog.trustwell.com/how-carbs-are-calculated-in-different-countries
 * - **Open Food Facts** — stores a single `carbohydrates` field copied from the package without
 *   recording the convention, so it is *mixed*: EU products are net, US/Canada products already total.
 *   https://github.com/openfoodfacts/openfoodfacts-server/issues/5675
 *   Resolved as {@link 'off-mixed'} in three steps: (1) prefer OFF's explicit `carbohydrates-total`
 *   nutriment when present; (2) else reconcile the stated label energy against both interpretations
 *   (they differ by exactly `4 × fiber` kcal/100g) and keep `carbs` as-is only when the energy
 *   clearly fits the total interpretation; (3) else assume the EU/net convention (OFF is EU-dominant)
 *   and add fiber. Step 2 is heuristic (label rounding, Atwater-factor variance, polyols), so it is
 *   deliberately conservative — it never deviates from the net default without strong evidence.
 * - **Musclog REST API** — scraped from EU (Dutch) supermarkets (Albert Heijn, Lidl, Jumbo, Aldi,
 *   Dirk, Plus, Vomar); the scrapers map the Dutch label "Koolhydraten" (available carbohydrate,
 *   fiber-excluded) → `carbs` and "Voedingsvezel"/"Vezels" → `fiber`. So Musclog follows the EU/`net`
 *   convention. Source repo: ah_scraper (`ah.js`, `jumbo.js`, `lidl.js`, … map `Koolhydraten`→carbs).
 */

import {
  CALORIES_FOR_ALCOHOL,
  CALORIES_FOR_CARBS,
  CALORIES_FOR_FAT,
  CALORIES_FOR_FIBER,
  CALORIES_FOR_PROTEIN,
} from '@/constants/nutrition';

/** Canonical carbohydrate convention a food source reports its `carbs` value in. */
export type CarbsConvention = 'total' | 'net' | 'off-mixed';

/** Food sources the app ingests carbs from. */
export type FoodSourceForCarbs = 'usda' | 'openfood' | 'musclog' | 'ai';

/**
 * Convention each ingested source reports `carbs` in. Change an entry here (one line) if a source's
 * upstream convention ever changes — e.g. if the Musclog API starts serving US (total) data.
 */
export const FOOD_SOURCE_CARBS_CONVENTION: Record<FoodSourceForCarbs, CarbsConvention> = {
  // USDA "Carbohydrate, by difference" already includes fiber. No transform today, but routed through
  // the helper so it has an explicit, future-proof entry point if normalization is ever needed.
  usda: 'total',
  // Open Food Facts is mixed (EU net vs US total); resolved per product.
  openfood: 'off-mixed',
  // Musclog scrapes EU (Dutch) supermarket labels → available carbohydrate (fiber-excluded).
  musclog: 'net',
  // LLM macro estimates: the prompt's energy note (kcal = 4·carbs + 2·fiber, see utils/prompts.ts)
  // is the net convention, so the model returns net carbs. Normalize to total before storing.
  ai: 'net',
};

/**
 * Carbs convention for values typed by the user in manual food entry. The user picks, in settings,
 * whether their "carbs" field already includes fiber (total, the US/FDA label default) or excludes
 * it (net, the EU label default). See INCLUDE_FIBER_IN_CARBS_SETTING_TYPE.
 */
export function manualEntryCarbsConvention(includesFiber: boolean): CarbsConvention {
  return includesFiber ? 'total' : 'net';
}

export interface RawCarbsInput {
  /** The source's primary carbohydrate value. */
  carbs: number;
  /** The source's fiber value. */
  fiber: number;
  /** Open Food Facts only: the `carbohydrates-total` nutriment, when the API provides it. */
  offCarbsTotal?: number;
  /**
   * Open Food Facts only: the source's **stated** label energy + co-macros, used to disambiguate net
   * vs total carbs by energy reconciliation when `offCarbsTotal` is absent. Pass the value printed on
   * the label — never an energy you inferred from macros, or the check becomes circular.
   */
  energyReconciliation?: {
    statedKcalPer100g: number;
    protein: number;
    fat: number;
    alcohol?: number;
  };
}

/**
 * kcal tolerance for the OFF energy reconciliation. The two interpretations differ by exactly
 * `4 × fiber` kcal/100g, so the winner must beat the loser by more than this margin (covering label
 * rounding and Atwater-factor variance) before we override the EU/net default.
 */
const OFF_ENERGY_RECONCILIATION_TOLERANCE_KCAL = 3;

const nonNegative = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;

const isFinitePositiveOrZero = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * For an ambiguous Open Food Facts product, reconcile the stated label energy against both
 * interpretations of `carbs` and return whichever the energy supports — or `null` when the evidence
 * is missing or inconclusive. Conservative by design: only returns `'total'` when the total
 * interpretation fits clearly better, so genuine EU/net products keep the safe default.
 */
function offEnergyConventionHint(input: RawCarbsInput): 'total' | 'net' | null {
  const reconcile = input.energyReconciliation;
  if (!reconcile) {
    return null;
  }

  const statedKcal = nonNegative(reconcile.statedKcalPer100g);
  const fiber = nonNegative(input.fiber);
  // With no stated energy or no fiber, the two interpretations are mathematically indistinguishable.
  if (statedKcal <= 0 || fiber <= 0) {
    return null;
  }

  const carbs = nonNegative(input.carbs);
  const base =
    CALORIES_FOR_PROTEIN * nonNegative(reconcile.protein) +
    CALORIES_FOR_FAT * nonNegative(reconcile.fat) +
    CALORIES_FOR_ALCOHOL * nonNegative(reconcile.alcohol) +
    CALORIES_FOR_FIBER * fiber;

  // If `carbs` already includes fiber (total), only carbs−fiber are digestible at 4 kcal/g.
  const energyIfTotal = base + CALORIES_FOR_CARBS * digestibleCarbs(carbs, fiber);
  // If `carbs` excludes fiber (net), all of carbs are digestible and fiber is additive (in `base`).
  const energyIfNet = base + CALORIES_FOR_CARBS * carbs;

  const errTotal = Math.abs(statedKcal - energyIfTotal);
  const errNet = Math.abs(statedKcal - energyIfNet);

  if (errTotal + OFF_ENERGY_RECONCILIATION_TOLERANCE_KCAL < errNet) {
    return 'total';
  }

  if (errNet + OFF_ENERGY_RECONCILIATION_TOLERANCE_KCAL < errTotal) {
    return 'net';
  }

  return null;
}

/**
 * Normalize a source's reported carbohydrate value to the canonical **total** (fiber-inclusive)
 * convention. Always non-negative.
 */
export function totalCarbsFromSource(convention: CarbsConvention, input: RawCarbsInput): number {
  const carbs = nonNegative(input.carbs);
  const fiber = nonNegative(input.fiber);

  switch (convention) {
    case 'total':
      return carbs;
    case 'net':
      return carbs + fiber;
    case 'off-mixed': {
      // 1. Prefer OFF's explicit total when present and self-consistent (handles US products and
      //    products where OFF computed a normalized total).
      if (isFinitePositiveOrZero(input.offCarbsTotal) && input.offCarbsTotal >= carbs) {
        return nonNegative(input.offCarbsTotal);
      }

      // 2. Otherwise reconcile the stated label energy: if it clearly matches the "carbs already
      //    include fiber" interpretation, the value is already total — don't add fiber again.
      if (offEnergyConventionHint(input) === 'total') {
        return carbs;
      }

      // 3. OFF is EU-dominant → treat `carbohydrates` as net and add fiber to reach total.
      return carbs + fiber;
    }
  }
}

/**
 * Normalize a food source's `carbs` to the canonical **total** convention. Preferred entry point for
 * ingestion mappers — it looks the source's convention up in {@link FOOD_SOURCE_CARBS_CONVENTION} so
 * call sites stay declarative and a convention change is a one-line edit.
 */
export function totalCarbsForFoodSource(source: FoodSourceForCarbs, input: RawCarbsInput): number {
  return totalCarbsFromSource(FOOD_SOURCE_CARBS_CONVENTION[source], input);
}

/**
 * Digestible (net) carbs derived from canonical **total** carbs — used for energy inference and for
 * the carbs progress bar (so it compares like-for-like against the net carbs goal). Always
 * non-negative.
 */
export function digestibleCarbs(totalCarbs: unknown, fiber: unknown): number {
  return Math.max(0, nonNegative(totalCarbs) - nonNegative(fiber));
}

/** An AI-estimated meal ingredient: absolute macros for a `grams` portion (`kcal` or `calories`). */
export interface AiIngredientMacros {
  grams: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  calories?: number;
  kcal?: number;
}

/** Per-100g macros for an AI ingredient, carbs already normalized to the canonical total. */
export interface AiIngredientMacrosPer100g {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/**
 * Normalize an AI-estimated ingredient's absolute macros to per-100g, converting carbs from the LLM's
 * net convention to the app's canonical total (see {@link FOOD_SOURCE_CARBS_CONVENTION}.ai). The
 * single entry point every AI ingestion path must use so the carbs conversion can't be forgotten;
 * callers apply their own rounding/clamping. Carbs is the only field clamped (by the convention
 * helper); the rest are returned raw.
 */
export function aiIngredientMacrosPer100g(
  ingredient: AiIngredientMacros
): AiIngredientMacrosPer100g {
  const per100g = (value: number): number => (value / ingredient.grams) * 100;
  const fiber = per100g(ingredient.fiber ?? 0);

  return {
    calories: per100g(ingredient.calories ?? ingredient.kcal ?? 0),
    protein: per100g(ingredient.protein),
    carbs: totalCarbsForFoodSource('ai', { carbs: per100g(ingredient.carbs), fiber }),
    fat: per100g(ingredient.fat),
    fiber,
  };
}
