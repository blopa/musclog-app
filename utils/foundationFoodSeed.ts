/**
 * What one row of the bundled food seed files (`data/usda_foundation_foods.json`,
 * `data/common_foundation_foods.json`) means.
 *
 * Two very different consumers read those files and must agree exactly on the answer: the
 * first-install seeder (`database/seeders/prod.ts`), which turns every USDA row into a `foods`
 * record, and the Game Boy day-share receiver (`utils/optical/gameBoyFoodMapping.ts`), which
 * rebuilds the same record for a food the cartridge referenced by index. A row parsed two ways is
 * a food that dedupes against itself — same `external_id`, different macros — so the parse lives
 * here once.
 *
 * **Carbs are already total (fiber included) in both files**, so nothing here re-normalizes them:
 * USDA's `Carbohydrate, by difference` includes fiber by definition, and
 * `scripts/build-common-foundation-foods.js` folds fiber back in when it converts the Open Food
 * Facts source. See the carbs convention rules in `AGENTS.md`.
 */

/** A seed row's numbers are strings in the JSON; every one of them is optional in practice. */
export type FoundationFoodSeedRow = Record<string, string | undefined>;

export interface FoundationFoodSeed {
  externalId: string;
  name: string;
  description: string;
  barcode?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micros: Record<string, number>;
}

/** The micro columns the seed files carry, and the `micros_json` key each one lands under. */
const SEED_MICRO_COLUMNS: Readonly<Record<string, string>> = {
  magnesium: 'magnesium',
  sodium: 'sodium',
  sugar: 'sugar',
  vitamin_c: 'vitaminC',
  vitamin_d: 'vitaminD',
};

function seedNumber(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseFoundationFoodSeed(row: FoundationFoodSeedRow): FoundationFoodSeed {
  const micros: Record<string, number> = {};
  for (const [column, key] of Object.entries(SEED_MICRO_COLUMNS)) {
    const value = seedNumber(row[column]);
    // Zero means "not measured" in these files, not "contains none of it" — storing it would show
    // a hard 0 g in the UI for every unmeasured nutrient.
    if (value > 0) {
      micros[key] = value;
    }
  }

  return {
    barcode: row.barcode || undefined,
    calories: seedNumber(row.kcal),
    carbs: seedNumber(row.carbs),
    description: row.description ?? '',
    externalId: String(row.external_id ?? ''),
    fat: seedNumber(row.fat),
    fiber: seedNumber(row.fiber),
    micros,
    name: row.name ?? '',
    protein: seedNumber(row.protein),
  };
}
