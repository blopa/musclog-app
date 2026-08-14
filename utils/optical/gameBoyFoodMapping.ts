/**
 * Cartridge food index → the bundled food the app already knows.
 *
 * The Game Boy identifies a logged food by its position in the global bundled table (USDA rows
 * first, the common set appended after them), exactly the way it identifies an exercise by its
 * position in the frozen `exerciseSlugs` list. That position is identity on two wires at once: a
 * `.sav` stores it, and `SHARE DAY` sends it. `data/gameBoyOpticalProtocol.json` freezes the
 * `external_id` at each position, and `gameboy/tools/gen-foundation-foods.mjs` fails the build if a
 * regenerated table would change one.
 *
 * Why this matters more for foods than it did for exercises: the cartridge only keeps 16 characters
 * of a food's name (`FF_NAME_VISIBLE`), so "Lettuce, leaf, green, raw" reaches the receiver as
 * "Lettuce, leaf, g". Matching that against the receiver's catalogue by name would miss every
 * bundled food and grow a second, worse-named copy of it on every share. Resolving the index to an
 * `external_id` instead lets the importer's food dedupe take its FIRST branch — the same
 * `external_id` the receiver's own seeding wrote — and the food is reused rather than recreated.
 *
 * A food the frozen list does not cover comes from a cartridge newer than this build. That is not
 * an error: the sender always includes the food's own tuple alongside the index, so the importer
 * falls back to it (see `utils/optical/gameBoyDayShare.ts`).
 */

import commonFoundationFoods from '@/data/common_foundation_foods.json';
import gameBoyOpticalProtocol from '@/data/gameBoyOpticalProtocol.json';
import usdaFoundationFoods from '@/data/usda_foundation_foods.json';
import {
  type FoundationFoodSeed,
  type FoundationFoodSeedRow,
  parseFoundationFoodSeed,
} from '@/utils/foundationFoodSeed';

/** Mirrors `CUSTOM_FOOD_BASE` in `gameboy/src/data/custom_foods.h`. */
export const GAME_BOY_CUSTOM_FOOD_BASE = 0x8000;

const FOOD_EXTERNAL_IDS: readonly string[] = gameBoyOpticalProtocol.foodExternalIds;

let seedsByExternalId: Map<string, FoundationFoodSeed> | undefined;

/**
 * Built on first use rather than at module load: a receiver that never scans a Game Boy share
 * should not pay for parsing 500-odd seed rows, and the two JSON files are only reachable from
 * here.
 *
 * The first row wins for a repeated `external_id`. The USDA set ships a handful of positions that
 * describe one underlying food under two `description`s (e.g. 578455, "Egg, whole, raw, frozen,
 * pasteurized" and "Eggs, Grade A, Large"); their macros are identical, so either row rebuilds the
 * same food.
 */
function seedIndex(): Map<string, FoundationFoodSeed> {
  if (!seedsByExternalId) {
    seedsByExternalId = new Map();
    for (const row of [
      ...usdaFoundationFoods,
      ...commonFoundationFoods,
    ] as FoundationFoodSeedRow[]) {
      const seed = parseFoundationFoodSeed(row);
      if (seed.externalId && !seedsByExternalId.has(seed.externalId)) {
        seedsByExternalId.set(seed.externalId, seed);
      }
    }
  }
  return seedsByExternalId;
}

/** A cartridge food the user created on the Game Boy, which no bundled table can describe. */
export function isCartridgeCustomFoodIndex(index: number): boolean {
  return index >= GAME_BOY_CUSTOM_FOOD_BASE;
}

/** The frozen `external_id` at a cartridge index, or `undefined` for a custom or unknown food. */
export function externalIdForCartridgeFoodIndex(index: number): string | undefined {
  return FOOD_EXTERNAL_IDS[index] || undefined;
}

/**
 * The full bundled food at a cartridge index — identity AND content, so a receiver that has never
 * seeded this food (the common set is not part of the app's own seeding) still creates it with its
 * real name and micros instead of the cartridge's truncated label.
 */
export function catalogueFoodForCartridgeIndex(index: number): FoundationFoodSeed | undefined {
  const externalId = externalIdForCartridgeFoodIndex(index);
  return externalId ? seedIndex().get(externalId) : undefined;
}
