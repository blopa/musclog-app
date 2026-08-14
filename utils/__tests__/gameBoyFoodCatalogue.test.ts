import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import commonFoundationFoods from '@/data/common_foundation_foods.json';
import gameBoyOpticalProtocol from '@/data/gameBoyOpticalProtocol.json';
import usdaFoundationFoods from '@/data/usda_foundation_foods.json';
import {
  catalogueFoodForCartridgeIndex,
  externalIdForCartridgeFoodIndex,
  GAME_BOY_CUSTOM_FOOD_BASE,
  isCartridgeCustomFoodIndex,
} from '@/utils/optical/gameBoyFoodMapping';

/**
 * The frozen food-identity contract.
 *
 * A food's position in the cartridge's global table is its identity on two wires at once: a `.sav`
 * stores a logged food as that index, and `SHARE DAY` sends the same index. So the list may only
 * grow, and it must stay aligned with the C tables the ROM actually ships — a table regenerated
 * without `foodExternalIds` following it would silently re-point every save file and every past
 * share at a different food.
 *
 * `gameboy/tools/gen-foundation-foods.mjs` fails the generator on a changed entry; this fails the
 * test suite if the two ever get out of step some other way.
 */
const FOOD_EXTERNAL_IDS: string[] = gameBoyOpticalProtocol.foodExternalIds;

function cCount(file: string, macro: string): number {
  const source = readFileSync(join(__dirname, '..', '..', 'gameboy/src/generated', file), 'utf8');
  const match = source.match(new RegExp(String.raw`#define ${macro} (\d+)u`));
  if (!match) {
    throw new Error(`Missing #define ${macro}`);
  }
  return Number(match[1]);
}

describe('Game Boy bundled food identity', () => {
  it('covers exactly the foods the ROM tables hold', () => {
    const bundled =
      cCount('foundation_foods.h', 'FOUNDATION_FOOD_COUNT') +
      cCount('common_foods.h', 'COMMON_FOOD_COUNT');

    expect(FOOD_EXTERNAL_IDS).toHaveLength(bundled);
  });

  it('names a real seed row at every index', () => {
    const seeds = new Set(
      [...usdaFoundationFoods, ...commonFoundationFoods].map((row) => row.external_id)
    );

    // The rebuilt food's name, barcode and micros all come from that row, so an id with no seed
    // behind it would import as a nameless husk.
    expect(FOOD_EXTERNAL_IDS.filter((id) => !seeds.has(id))).toEqual([]);
  });

  it('resolves an index to the same food the app would have seeded', () => {
    const seed = usdaFoundationFoods.find((row) => row.external_id === FOOD_EXTERNAL_IDS[0]);
    const resolved = catalogueFoodForCartridgeIndex(0);

    expect(resolved?.externalId).toBe(seed?.external_id);
    expect(resolved?.name).toBe(seed?.name);
    expect(resolved?.calories).toBe(Number(seed?.kcal));
  });

  it('resolves nothing for a custom or unknown index', () => {
    // A cartridge food the user typed in has no bundled identity, and an index past the end comes
    // from a newer cartridge. Both fall back to the tuple the cartridge sends alongside.
    expect(isCartridgeCustomFoodIndex(GAME_BOY_CUSTOM_FOOD_BASE + 4)).toBe(true);
    expect(externalIdForCartridgeFoodIndex(GAME_BOY_CUSTOM_FOOD_BASE + 4)).toBeUndefined();
    expect(catalogueFoodForCartridgeIndex(FOOD_EXTERNAL_IDS.length)).toBeUndefined();
  });

  it('keeps the USDA block ahead of the common block, the way food_db.c indexes them', () => {
    // food_db.c appends the common table after the USDA one behind a single index space; a list
    // built in the other order would map every index to the wrong dataset.
    const firstCommon = FOOD_EXTERNAL_IDS.findIndex((id) => id.startsWith('common:'));
    expect(firstCommon).toBeGreaterThan(0);
    expect(FOOD_EXTERNAL_IDS.slice(0, firstCommon).some((id) => id.startsWith('common:'))).toBe(
      false
    );
    expect(FOOD_EXTERNAL_IDS.slice(firstCommon).every((id) => id.startsWith('common:'))).toBe(true);
  });
});
