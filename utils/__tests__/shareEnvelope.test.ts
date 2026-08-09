import { RESTORE_ORDER } from '@/constants/exportImport';
import { schema } from '@/database/schema';
import {
  MUSCLOG_SHARE_ENVELOPE_VERSION,
  MusclogShareError,
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

      expect(spec.tables.includes(spec.rootTable)).toBe(true);
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
