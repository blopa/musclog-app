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
 *   all carbs (incl. fiber) are counted at 4 kcal/g. 21 CFR 101.9(c)(6):
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
 *   Resolved as {@link 'off-mixed'}: prefer OFF's explicit `carbohydrates-total` nutriment when
 *   present; otherwise assume the EU/net convention (OFF is EU-dominant) and add fiber. US OFF
 *   products lacking `carbohydrates-total` are the known-imperfect case (over-counted by fiber).
 * - **Musclog REST API** — scraped from EU (Dutch) supermarkets (Albert Heijn, Lidl, Jumbo, Aldi,
 *   Dirk, Plus, Vomar); the scrapers map the Dutch label "Koolhydraten" (available carbohydrate,
 *   fiber-excluded) → `carbs` and "Voedingsvezel"/"Vezels" → `fiber`. So Musclog follows the EU/`net`
 *   convention. Source repo: ah_scraper (`ah.js`, `jumbo.js`, `lidl.js`, … map `Koolhydraten`→carbs).
 */

/** Canonical carbohydrate convention a food source reports its `carbs` value in. */
export type CarbsConvention = 'total' | 'net' | 'off-mixed';

/** Food sources the app ingests carbs from. */
export type FoodSourceForCarbs = 'usda' | 'openfood' | 'musclog';

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
};

export interface RawCarbsInput {
  /** The source's primary carbohydrate value. */
  carbs: number;
  /** The source's fiber value. */
  fiber: number;
  /** Open Food Facts only: the `carbohydrates-total` nutriment, when the API provides it. */
  offCarbsTotal?: number;
}

const nonNegative = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;

const isFinitePositiveOrZero = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

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
      // Prefer OFF's explicit total when present and self-consistent (handles US products and
      // products where OFF computed a normalized total).
      // TODO: maybe we can infer this by calculating total calories and check the difference and see if the carbs includes fibers or not
      if (isFinitePositiveOrZero(input.offCarbsTotal) && input.offCarbsTotal >= carbs) {
        return nonNegative(input.offCarbsTotal);
      }

      // OFF is EU-dominant → treat `carbohydrates` as net and add fiber to reach total.
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
