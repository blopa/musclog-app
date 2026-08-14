import { RESTORE_ORDER } from '@/constants/exportImport';
import { schema } from '@/database/schema';
import {
  type FoodShareEnvelope,
  MUSCLOG_SHARE_ENVELOPE_VERSION,
  MusclogShareError,
  type NutritionDayShareEnvelope,
  parseShareEnvelope,
  type MealShareEnvelope,
} from '@/utils/share/shareEnvelope';
import { SHARE_KINDS } from '@/utils/share/shareKinds';

const mealShare = (): MealShareEnvelope => ({
  _musclogShare: MUSCLOG_SHARE_ENVELOPE_VERSION,
  assets: {
    mealImage: { base64: 'AQIDBA==', height: 300, mime: 'image/jpeg', width: 400 },
  },
  createdAtMs: 1_754_000_000_000,
  kind: 'meal',
  kindVersion: 1,
  records: {
    food_food_portions: [],
    food_portions: [],
    foods: [{ id: 'food-1', name: 'Rice' }],
    meal_food_portions: [],
    meal_foods: [{ amount: 100, food_id: 'food-1', id: 'meal-food-1', meal_id: 'meal-1' }],
    meals: [{ id: 'meal-1', name: 'Rice bowl' }],
  },
  rootId: 'meal-1',
  rootTable: 'meals',
  summary: {
    hasImage: true,
    ingredients: [{ amount: 100, calories: 130, name: 'Rice', unit: 'g' }],
    name: 'Rice bowl',
    nutritionBasis: 'per_recipe',
    totals: { calories: 130, carbs: 28, fat: 0.3, fiber: 0.4, protein: 2.7 },
  },
});

const foodShare = (): FoodShareEnvelope => ({
  _musclogShare: MUSCLOG_SHARE_ENVELOPE_VERSION,
  createdAtMs: 1_754_000_000_000,
  kind: 'food',
  kindVersion: 1,
  records: {
    food_food_portions: [
      { food_id: 'food-1', food_portion_id: 'portion-1', id: 'link-1', is_default: true },
    ],
    food_portions: [{ gram_weight: 30, id: 'portion-1', name: 'Scoop' }],
    foods: [{ id: 'food-1', name: 'Whey' }],
  },
  rootId: 'food-1',
  rootTable: 'foods',
  summary: {
    hasImage: false,
    name: 'Whey',
    nutrients: { calories: 380, carbs: 6, fat: 7, fiber: 0, protein: 76 },
    nutritionBasis: 'per_100g',
    portions: [{ gramWeight: 30, isDefault: true, name: 'Scoop' }],
  },
});

const dayShare = (): NutritionDayShareEnvelope => ({
  _musclogShare: MUSCLOG_SHARE_ENVELOPE_VERSION,
  createdAtMs: 1_754_000_000_000,
  kind: 'nutritionDay',
  kindVersion: 1,
  records: {
    food_food_portions: [],
    food_portions: [],
    foods: [{ id: 'food-1', name: 'Rice' }],
    nutrition_logs: [
      {
        amount: 150,
        date: 1_754_000_000_000,
        food_id: 'food-1',
        id: 'log-1',
        timezone: '+02:00',
        type: 'lunch',
      },
    ],
  },
  summary: {
    dayKey: '2026-08-14',
    entries: [{ amount: 150, calories: 195, mealType: 'lunch', name: 'Rice', unit: 'g' }],
    totals: { calories: 195, carbs: 42, fat: 0.5, fiber: 0.6, protein: 4 },
  },
});

function expectCode(fn: () => unknown, code: MusclogShareError['code']): void {
  try {
    fn();
    throw new Error('Expected share parsing to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(MusclogShareError);
    expect((error as MusclogShareError).code).toBe(code);
  }
}

describe('parseShareEnvelope', () => {
  it('round-trips a meal share including assets', () => {
    const share = mealShare();
    expect(parseShareEnvelope(JSON.stringify(share))).toEqual(share);
  });

  // v2.11.0's builder wrote WatermelonDB's `null` straight into the summary for every optional
  // measurement the meal did not set — which is most meals — and the receiver rejected the lot.
  // Reading null as absent is what lets a phone on this build receive from a phone still on that
  // one; stripping it is what keeps the returned envelope matching its `?: number` typing.
  it('reads an explicit null as an absent optional field', () => {
    const share = mealShare();
    const withNulls = {
      ...share,
      summary: {
        ...share.summary,
        description: null,
        ingredients: [{ ...share.summary.ingredients[0], portionName: null }],
        preparedWeightGrams: null,
        recipeServingsCount: null,
        servingGrams: null,
      },
    };

    const parsed = parseShareEnvelope(JSON.stringify(withNulls));

    expect(parsed).toEqual(share);
    expect(Object.hasOwn(parsed.summary, 'servingGrams')).toBe(false);
    expect(Object.hasOwn(parsed.summary.ingredients[0], 'portionName')).toBe(false);
  });

  it('round-trips a food share', () => {
    const share = foodShare();
    expect(parseShareEnvelope(JSON.stringify(share))).toEqual(share);
  });

  // Same treatment as the meal summary's optional measurements: WatermelonDB hands a builder
  // `null` for an unset optional column, and an explicit null must read as "not set" rather than
  // failing the whole receive.
  it('reads an explicit null as an absent optional food field', () => {
    const share = foodShare();
    const withNulls = {
      ...share,
      summary: {
        ...share.summary,
        brand: null,
        description: null,
        portions: [{ ...share.summary.portions[0], gramWeight: null }],
      },
    };

    const parsed = parseShareEnvelope(JSON.stringify(withNulls));

    expect(Object.hasOwn(parsed.summary, 'brand')).toBe(false);
    expect(parsed.kind).toBe('food');
  });

  it('rejects a food share whose summary is missing macros', () => {
    const share = foodShare();
    // @ts-expect-error deliberately malformed: a sender that dropped a macro
    delete share.summary.nutrients.protein;
    expectCode(() => parseShareEnvelope(JSON.stringify(share)), 'malformed');
  });

  // A kind this build has never heard of is the one case that really does mean "the other phone is
  // newer", so it must not fall through to the generic malformed message.
  it('rejects a kind this build does not know', () => {
    expectCode(
      () => parseShareEnvelope(JSON.stringify({ ...foodShare(), kind: 'workout' })),
      'unsupported-kind'
    );
  });

  it('rejects a database export as not-a-share', () => {
    expectCode(
      () => parseShareEnvelope(JSON.stringify({ _exportVersion: 24, meals: [] })),
      'not-a-share'
    );
  });

  it('rejects newer envelope and kind versions', () => {
    expectCode(
      () =>
        parseShareEnvelope(
          JSON.stringify({
            ...mealShare(),
            _musclogShare: MUSCLOG_SHARE_ENVELOPE_VERSION + 1,
          })
        ),
      'unsupported-envelope'
    );
    expectCode(
      () =>
        parseShareEnvelope(
          JSON.stringify({ ...mealShare(), kindVersion: SHARE_KINDS.meal.kindVersion + 1 })
        ),
      'unsupported-kind'
    );
  });

  it('round-trips a day share, which has no root row at all', () => {
    const parsed = parseShareEnvelope(JSON.stringify(dayShare()));

    expect(parsed.kind).toBe('nutritionDay');
    expect(parsed).not.toHaveProperty('rootId');
  });

  it('rejects a day share that claims a root nobody will read', () => {
    // Both directions are enforced: a rooted kind must name its root, a rootless one must not
    // smuggle one past a parser that would ignore it.
    const rooted = { ...dayShare(), rootId: 'log-1', rootTable: 'nutrition_logs' };
    expectCode(() => parseShareEnvelope(JSON.stringify(rooted)), 'malformed');
  });

  it('rejects a day share with no entries', () => {
    const empty = dayShare();
    empty.records.nutrition_logs = [];
    expectCode(() => parseShareEnvelope(JSON.stringify(empty)), 'malformed');
  });

  it('rejects a day summary with an invalid date or meal type', () => {
    const badDay = dayShare();
    badDay.summary.dayKey = '14/08/2026';
    expectCode(() => parseShareEnvelope(JSON.stringify(badDay)), 'malformed');

    const badMeal = dayShare();
    (badMeal.summary.entries[0] as { mealType: string }).mealType = 'brunch';
    expectCode(() => parseShareEnvelope(JSON.stringify(badMeal)), 'malformed');
  });

  it('rejects a missing root row', () => {
    const share = mealShare();
    share.records.meals = [];
    expectCode(() => parseShareEnvelope(JSON.stringify(share)), 'malformed');
  });

  it('bounds row and asset counts from the open optical channel', () => {
    const tooManyRows = mealShare();
    tooManyRows.records.foods = Array.from({ length: 2_001 }, (_, index) => ({
      id: `food-${index}`,
    }));
    expectCode(() => parseShareEnvelope(JSON.stringify(tooManyRows)), 'too-large');

    const oversizedAsset = mealShare();
    oversizedAsset.assets = {
      mealImage: {
        base64: `${'AAAA'.repeat(Math.ceil((4 * 1024 * 1024) / 3))}AAAA`,
        height: 1,
        mime: 'image/jpeg',
        width: 1,
      },
    };
    expectCode(() => parseShareEnvelope(JSON.stringify(oversizedAsset)), 'too-large');
  });
});

describe('share registry', () => {
  it('uses schema-backed tables and columns in restore dependency order', () => {
    for (const spec of Object.values(SHARE_KINDS)) {
      let previousRestoreIndex = -1;
      for (const table of spec.tables) {
        const restoreIndex = RESTORE_ORDER.indexOf(table);
        expect(restoreIndex).toBeGreaterThan(previousRestoreIndex);
        previousRestoreIndex = restoreIndex;

        const tableSchema = schema.tables[table];
        expect(tableSchema).toBeDefined();
        const columns = new Set(tableSchema.columnArray.map((column) => column.name));
        for (const [column, target] of Object.entries(spec.foreignKeys[table] ?? {})) {
          expect(columns.has(column)).toBe(true);
          if (typeof target !== 'string') {
            expect(columns.has(target.polymorphic.typeColumn)).toBe(true);
          }
        }
        for (const column of spec.assetColumns[table] ?? []) {
          expect(columns.has(column)).toBe(true);
        }
        for (const column of Object.keys(spec.forcedColumns[table] ?? {})) {
          expect(columns.has(column)).toBe(true);
        }
      }

      // A rootless kind (a day of eating) carries no root row at all; a rooted one must ship the
      // table its envelope points into.
      if (spec.rootTable !== null) {
        expect(spec.tables.includes(spec.rootTable)).toBe(true);
      }
      for (const table of [
        ...Object.keys(spec.dedupe),
        ...Object.keys(spec.dropWhenParentReused),
        ...spec.pruneUnreferenced,
      ]) {
        expect(spec.tables.includes(table)).toBe(true);
      }
      // The drop parent must name a real foreign key of its own table — it used to be inferred
      // from property order, so a reordered spec silently changed which parent was consulted.
      for (const [table, parentColumn] of Object.entries(spec.dropWhenParentReused)) {
        expect(Object.keys(spec.foreignKeys[table] ?? {})).toContain(parentColumn);
      }
      for (const tableForeignKeys of Object.values(spec.foreignKeys)) {
        for (const target of Object.values(tableForeignKeys)) {
          if (typeof target === 'string') {
            expect(spec.tables.includes(target)).toBe(true);
          } else {
            for (const polymorphicTarget of Object.values(target.polymorphic.typeToTable)) {
              expect(spec.tables.includes(polymorphicTarget)).toBe(true);
            }
          }
        }
      }
    }
  });
});
