import {
  buildNutritionDayShareEnvelope,
  buildNutritionDaySharePayload,
  nutritionDayShareKey,
} from '@/database/share/buildNutritionDayShare';
import {
  OPTICAL_EXPORT_VERSION_SHARE,
  OPTICAL_PAYLOAD_KIND_SHARE,
} from '@/utils/optical/container';
import { MusclogShareError, parseShareEnvelope } from '@/utils/share/shareEnvelope';

/**
 * Sending one day of the diary from the app.
 *
 * The day builder differs from every other kind in two ways that are easy to get wrong and
 * invisible until the other phone shows the wrong thing, so both are pinned end to end through
 * `JSON.stringify` + `parseShareEnvelope`: the encrypted macro snapshot has to leave as PLAINTEXT
 * (the receiver cannot read this device's key), and each entry's own `date`/`timezone` has to
 * survive untouched, because that pair — not the summary — is what files it on the right calendar
 * day for a receiver in another timezone.
 */

// `shareRecords` reaches utils/file for the thumbnail path a day share never takes; the real module
// pulls in an ESM-only native package that Jest cannot load.
jest.mock('@/utils/file', () => ({ createThumbnail: jest.fn() }));

jest.mock('@/database/encryptionHelpers', () => ({
  decryptNutritionLogSnapshotRow: jest.fn(async (row: Record<string, unknown>) => ({
    loggedCalories: Number(String(row.logged_calories).replace('enc:', '')),
    loggedCarbs: 10,
    loggedFat: 3,
    loggedFiber: 1,
    loggedFoodName: 'Oats',
    loggedMicros: undefined,
    loggedProtein: 5,
  })),
  nutritionLogSnapshotToExportFields: jest.requireActual('@/database/encryptionHelpers')
    .nutritionLogSnapshotToExportFields,
}));

const DAY_MS = new Date(2026, 7, 14, 8, 30).getTime();

function portion(id: string, name: string) {
  return {
    _raw: { deleted_at: null, gram_weight: 40, id, name, source: 'basic' },
    deletedAt: undefined,
    gramWeight: 40,
    id,
    name,
    ownerId: undefined,
    ownerType: undefined,
  };
}

function food(id: string, name: string) {
  return {
    _raw: {
      calories: 380,
      carbs: 66,
      deleted_at: null,
      fat: 7,
      fiber: 10,
      id,
      image_url: 'file:///food_images/local.jpg',
      name,
      nutrition_basis: 'per_100g',
      protein: 13,
    },
    deletedAt: undefined,
    // No default portion link on this food; `foodPortions.fetch` is what the builder asks for.
    foodPortions: { fetch: jest.fn(async () => []) },
    id,
    name,
    resolvedNutritionBasis: 'per_100g',
  };
}

interface LogOptions {
  id?: string;
  amount?: number;
  date?: number;
  type?: string;
  groupId?: string;
  portionRecord?: ReturnType<typeof portion>;
  deletedFood?: boolean;
}

function log(options: LogOptions = {}) {
  const linkedFood = food('food-oats', 'Oats');
  const linkedPortion = options.portionRecord;
  return {
    _raw: {
      amount: options.amount ?? 80,
      created_at: 5,
      date: options.date ?? DAY_MS,
      deleted_at: null,
      food_id: 'food-oats',
      // Ciphertext, as it sits in the database — the builder must not ship this.
      logged_calories: 'enc:380',
      logged_carbs: 'enc:66',
      logged_fat: 'enc:7',
      logged_fiber: 'enc:10',
      logged_food_name: 'enc:Oats',
      logged_protein: 'enc:13',
      snapshot_basis: 'per_100g',
      timezone: '+02:00',
      type: options.type ?? 'breakfast',
      updated_at: 5,
      ...(options.groupId ? { group_id: options.groupId } : undefined),
      ...(linkedPortion ? { portion_id: linkedPortion.id } : undefined),
      id: options.id ?? 'log-1',
    },
    amount: options.amount ?? 80,
    deletedAt: undefined,
    food: options.deletedFood ? Promise.resolve({ deletedAt: 12 }) : Promise.resolve(linkedFood),
    getNutrients: jest.fn(async () => ({
      alcohol: 0,
      calories: 304,
      carbs: 52.8,
      fat: 5.6,
      fiber: 8,
      protein: 10.4,
    })),
    id: options.id ?? 'log-1',
    portion: Promise.resolve(linkedPortion),
    portionId: linkedPortion?.id,
    type: options.type ?? 'breakfast',
  } as any;
}

describe('buildNutritionDayShareEnvelope', () => {
  it('sends the macro snapshot in the clear so the receiver can re-encrypt it', async () => {
    const { envelope } = await buildNutritionDayShareEnvelope([log()], { dayKey: '2026-08-14' });
    const wire = parseShareEnvelope(JSON.stringify(envelope));
    const [row] = wire.records.nutrition_logs;

    // The stored value is ciphertext under THIS device's key, which means nothing on the other
    // phone. `NUTRITION_DAY_SHARE_SPEC.encrypt` is the other half of this handoff.
    expect(row.logged_calories).toBe(380);
    expect(row.logged_food_name).toBe('Oats');
    expect(String(row.logged_calories)).not.toContain('enc:');
  });

  it('preserves each entry’s consumed time, timezone and meal type', async () => {
    const { envelope } = await buildNutritionDayShareEnvelope([log({ type: 'dinner' })], {
      dayKey: '2026-08-14',
    });
    const [row] = envelope.records.nutrition_logs;

    expect(row.date).toBe(DAY_MS);
    expect(row.timezone).toBe('+02:00');
    expect(row.type).toBe('dinner');
    expect(envelope.summary.entries[0].mealType).toBe('dinner');
    // Only a Game Boy has to admit it has no times.
    expect(envelope.summary.timesUnknown).toBeUndefined();
  });

  it('carries no root row, no photos and no ingredient pictures', async () => {
    const { envelope, photo } = await buildNutritionDayShareEnvelope([log()], {
      dayKey: '2026-08-14',
    });

    expect(photo).toBe('none');
    expect(envelope).not.toHaveProperty('rootId');
    expect(envelope).not.toHaveProperty('rootTable');
    // A sender-local file path means nothing on the other phone.
    expect(envelope.records.foods[0].image_url).toBeUndefined();
    expect(() => parseShareEnvelope(JSON.stringify(envelope))).not.toThrow();
  });

  it('totals the whole day from each entry’s real nutrients', async () => {
    const { envelope } = await buildNutritionDayShareEnvelope([log(), log({ id: 'log-2' })], {
      dayKey: '2026-08-14',
    });

    expect(envelope.summary.entries).toHaveLength(2);
    expect(envelope.summary.totals.calories).toBeCloseTo(608, 5);
    expect(envelope.summary.totals.protein).toBeCloseTo(20.8, 5);
  });

  it('drops the portion reference when the portion cannot travel', async () => {
    const mealOwned = portion('portion-bowl', 'Bowl');
    mealOwned.ownerType = 'meal' as any;
    mealOwned.ownerId = 'meal-1' as any;

    const { envelope } = await buildNutritionDayShareEnvelope([log({ portionRecord: mealOwned })], {
      dayKey: '2026-08-14',
    });

    // A meal-owned portion has no owner in this envelope to point at; keeping the reference would
    // fail the import on a foreign key that cannot resolve.
    expect(envelope.records.food_portions).toHaveLength(0);
    expect(envelope.records.nutrition_logs[0].portion_id).toBeUndefined();
  });

  it('refuses a day with nothing sendable, with a code the UI can translate', async () => {
    // Matched on the code, never the English text — the send screen renders whatever is thrown.
    await expect(
      buildNutritionDayShareEnvelope([log({ deletedFood: true })], { dayKey: '2026-08-14' })
    ).rejects.toThrow(MusclogShareError);
    await expect(
      buildNutritionDayShareEnvelope([], { dayKey: '2026-08-14' })
    ).rejects.toMatchObject({ code: 'no-ingredients' });
  });

  it('declares itself a share, never a restorable database', async () => {
    const payload = await buildNutritionDaySharePayload([log()], { dayKey: '2026-08-14' });

    expect(payload.payloadKind).toBe(OPTICAL_PAYLOAD_KIND_SHARE);
    expect(payload.exportVersion).toBe(OPTICAL_EXPORT_VERSION_SHARE);
    expect(JSON.parse(payload.json)).not.toHaveProperty('_exportVersion');
  });
});

describe('nutritionDayShareKey', () => {
  it('names the day the user is looking at, in local time', () => {
    expect(nutritionDayShareKey(new Date(2026, 7, 14, 23, 30))).toBe('2026-08-14');
  });
});
