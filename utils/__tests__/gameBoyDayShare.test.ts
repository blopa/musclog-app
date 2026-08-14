import commonFoundationFoods from '@/data/common_foundation_foods.json';
import gameBoyOpticalProtocol from '@/data/gameBoyOpticalProtocol.json';
import usdaFoundationFoods from '@/data/usda_foundation_foods.json';
import {
  gameBoyDayShareToEnvelope,
  isGameBoyDayShareJson,
  parseGameBoyDayShare,
} from '@/utils/optical/gameBoyDayShare';
import { GameBoyExportError } from '@/utils/optical/gameBoyExport';
import { GAME_BOY_CUSTOM_FOOD_BASE } from '@/utils/optical/gameBoyFoodMapping';
import { parseIncomingShareJson } from '@/utils/share/parseIncomingShare';
import { MusclogShareError } from '@/utils/share/shareEnvelope';

/**
 * Musclog GB's `SHARE DAY`.
 *
 * The cartridge cannot say most of what a diary entry needs — no time of day, no meal type, no
 * barcode, and only 16 characters of a food's name — so what these tests pin is how the receiver
 * makes up the difference without inventing anything: identity comes from the frozen food index,
 * content from the seed row the app already ships, and the parts that genuinely are unknown are
 * filled with one honest default (local noon, `other`) and declared in the summary.
 */

// A day the cartridge could plausibly stamp: 2026-08-14 is day 9722 since 2000-01-01.
const SHARED_DAY = 9722;
const NOW = Date.UTC(2026, 7, 14, 9, 0, 0);

/**
 * Indices are taken from the frozen contract, never from a position in the seed files: the
 * generator quarantines invalid rows, so the cartridge's index space is the FILTERED order and
 * `usdaFoundationFoods[n]` is not index `n`.
 */
const FOOD_EXTERNAL_IDS: string[] = gameBoyOpticalProtocol.foodExternalIds;
const seedFor = (index: number) =>
  [...usdaFoundationFoods, ...commonFoundationFoods].find(
    (row) => row.external_id === FOOD_EXTERNAL_IDS[index]
  ) as Record<string, string>;

/** The first bundled food, which the app's own seeding also creates from the same source row. */
const BUNDLED_INDEX = 0;
const BUNDLED_SEED = seedFor(BUNDLED_INDEX);
/** A common-set food: bundled on the cartridge, and NOT seeded by the app. */
const COMMON_INDEX = FOOD_EXTERNAL_IDS.findIndex((id) => id.startsWith('common:'));

const compactFixture = () => ({
  _gameBoyShare: 1,
  day: SHARED_DAY,
  foods: [
    // Names arrive truncated to 16 characters, which is exactly why the index carries identity.
    [BUNDLED_INDEX, 'Lettuce, leaf, g', 20, 8, 0, 42, 8],
    [GAME_BOY_CUSTOM_FOOD_BASE + 3, 'GRANNYS STEW', 210, 180, 70, 120, 20],
  ],
  kind: 'day',
  logs: [
    [BUNDLED_INDEX, 150],
    [GAME_BOY_CUSTOM_FOOD_BASE + 3, 300],
  ],
});

describe('parseGameBoyDayShare', () => {
  it('accepts the cartridge payload', () => {
    expect(parseGameBoyDayShare(compactFixture()).day).toBe(SHARED_DAY);
  });

  it('rejects a schema version this build does not know as "the sender is newer"', () => {
    const payload = { ...compactFixture(), _gameBoyShare: 99 };

    // Distinct from `malformed` on purpose: this is the one failure where telling the user to
    // update the app is the right advice.
    expect(() => parseGameBoyDayShare(payload)).toThrow(GameBoyExportError);
    expect(() => parseGameBoyDayShare(payload)).toThrow(/Unsupported/);
  });

  it.each([
    ['a log pointing at a food it never sent', { logs: [[404, 100]] }],
    ['no entries at all', { logs: [] }],
    ['a repeated food index', { foods: [...compactFixture().foods, compactFixture().foods[0]] }],
    ['an unknown field', { extra: 1 }],
  ])('rejects %s', (_label, patch) => {
    expect(() => parseGameBoyDayShare({ ...compactFixture(), ...patch })).toThrow(
      GameBoyExportError
    );
  });
});

describe('gameBoyDayShareToEnvelope', () => {
  it('resolves a bundled index to the food the receiver already has', () => {
    const envelope = gameBoyDayShareToEnvelope(parseGameBoyDayShare(compactFixture()), NOW);
    const food = envelope.records.foods.find((row) => row.external_id === BUNDLED_SEED.external_id);

    // Identity first: `external_id` is the importer's top dedupe branch, so this food is REUSED
    // rather than recreated under the cartridge's truncated label.
    expect(food).toBeDefined();
    expect(food?.name).toBe(BUNDLED_SEED.name);
    expect(food?.name).not.toBe('Lettuce, leaf, g');
    expect(food?.calories).toBe(Number(BUNDLED_SEED.kcal));
  });

  it('rebuilds a common-set food from the seed the app does not seed itself', () => {
    const seed = seedFor(COMMON_INDEX);
    const compact = {
      ...compactFixture(),
      foods: [[COMMON_INDEX, 'Pizza Margherit', 226, 91, 67, 336, 26]],
      logs: [[COMMON_INDEX, 200]],
    };

    const envelope = gameBoyDayShareToEnvelope(parseGameBoyDayShare(compact), NOW);
    const [food] = envelope.records.foods;
    expect(food.external_id).toBe(seed.external_id);
    expect(food.name).toBe(seed.name);
    expect(food.barcode).toBe(seed.barcode);
  });

  it('falls back to the cartridge tuple for a custom food, with no external id to borrow', () => {
    const envelope = gameBoyDayShareToEnvelope(parseGameBoyDayShare(compactFixture()), NOW);
    const custom = envelope.records.foods.find((row) => row.name === 'GRANNYS STEW');

    expect(custom).toBeDefined();
    expect(custom?.external_id).toBeUndefined();
    expect(custom?.source).toBe('gameboy');
    // Decigrams on the wire, grams in the database.
    expect(custom?.protein).toBe(18);
    expect(custom?.carbs).toBe(12);
  });

  it('falls back to the tuple for an index this build has never heard of', () => {
    const futureIndex = gameBoyOpticalProtocol.foodExternalIds.length + 50;
    const compact = {
      ...compactFixture(),
      foods: [[futureIndex, 'FUTURE FOOD', 100, 10, 20, 30, 5]],
      logs: [[futureIndex, 100]],
    };

    // A cartridge newer than this build is not a reason to refuse the transfer: the tuple it sent
    // alongside the index is exactly the fallback for this.
    const envelope = gameBoyDayShareToEnvelope(parseGameBoyDayShare(compact), NOW);
    expect(envelope.records.foods[0].name).toBe('FUTURE FOOD');
    expect(envelope.records.foods[0].external_id).toBeUndefined();
  });

  it('files every entry at local noon on the cartridge day, under Other', () => {
    const envelope = gameBoyDayShareToEnvelope(parseGameBoyDayShare(compactFixture()), NOW);

    for (const log of envelope.records.nutrition_logs) {
      const stamped = new Date(log.date as number);
      expect(stamped.getHours()).toBe(12);
      expect(stamped.getFullYear()).toBe(2026);
      expect(stamped.getMonth()).toBe(7);
      expect(stamped.getDate()).toBe(14);
      // The cartridge records no meal type; guessing one from position would invent data.
      expect(log.type).toBe('other');
      expect(log.timezone).toBeTruthy();
    }
    expect(envelope.summary.dayKey).toBe('2026-08-14');
    expect(envelope.summary.timesUnknown).toBe(true);
  });

  it('sends the per-100 g snapshot in the clear, scaled only at display time', () => {
    const envelope = gameBoyDayShareToEnvelope(parseGameBoyDayShare(compactFixture()), NOW);
    const [lettuce] = envelope.records.nutrition_logs;

    // `snapshot_basis: per_100g` means NutritionLog.getNutrients() scales by the logged grams, so
    // the stored numbers stay per 100 g — storing the scaled ones would double-count the amount.
    expect(lettuce.snapshot_basis).toBe('per_100g');
    expect(lettuce.amount).toBe(150);
    expect(lettuce.logged_calories).toBe(Number(BUNDLED_SEED.kcal));
    // The summary, by contrast, is what the user reads, so it IS scaled.
    expect(envelope.summary.entries[0].calories).toBeCloseTo(Number(BUNDLED_SEED.kcal) * 1.5, 5);
  });

  it('totals the day from the resolved macros, not the truncated tuple', () => {
    const envelope = gameBoyDayShareToEnvelope(parseGameBoyDayShare(compactFixture()), NOW);
    const expectedCalories = Number(BUNDLED_SEED.kcal) * 1.5 + 210 * 3;
    expect(envelope.summary.totals.calories).toBeCloseTo(expectedCalories, 5);
  });
});

describe('parseIncomingShareJson', () => {
  it('expands a cartridge day and validates it like any other sender', () => {
    const envelope = parseIncomingShareJson(JSON.stringify(compactFixture()));

    expect(envelope.kind).toBe('nutritionDay');
    // A day has no root row, and the parser rejects a rootless kind that claims one.
    expect(envelope).not.toHaveProperty('rootId');
  });

  it('reports an unknown cartridge version as "this phone is behind"', () => {
    const payload = JSON.stringify({ ...compactFixture(), _gameBoyShare: 99 });

    // The receive screen shows "sent by a newer version" for exactly these two codes; every other
    // failure is a broken payload, which is a different sentence.
    expect(() => parseIncomingShareJson(payload)).toThrow(
      expect.objectContaining({ code: 'unsupported-kind' })
    );
  });

  it('reports a broken cartridge payload as malformed', () => {
    const payload = JSON.stringify({ ...compactFixture(), logs: [[404, 100]] });

    expect(() => parseIncomingShareJson(payload)).toThrow(MusclogShareError);
    expect(() => parseIncomingShareJson(payload)).toThrow(
      expect.objectContaining({ code: 'malformed' })
    );
  });

  it('leaves an app-built envelope alone', () => {
    expect(isGameBoyDayShareJson({ _musclogShare: 1, kind: 'meal' })).toBe(false);
  });
});
