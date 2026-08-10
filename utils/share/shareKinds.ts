export type MusclogShareKind = 'meal';

export type ShareForeignKeyTarget =
  | string
  | {
      polymorphic: {
        typeColumn: string;
        typeToTable: Record<string, string>;
      };
    };

export type ShareDedupeStrategy = 'create' | 'food-identity' | 'portion-identity';

export interface ShareKindSpec {
  kind: MusclogShareKind;
  kindVersion: number;
  rootTable: string;
  tables: readonly string[];
  foreignKeys: Record<string, Record<string, ShareForeignKeyTarget>>;
  /**
   * How a row of each table is matched against what the receiver already has. Tables left out
   * default to `'create'`. Read by `buildResolutions` in `database/share/importShareEnvelope.ts`,
   * which owns the per-strategy queries and the identity each one compares on.
   *
   * Resolution runs in `tables` order and a resolver may consult the tables resolved before it —
   * `'portion-identity'` asks whether a portion's owning food was reused — so that order is a
   * dependency for dedupe as much as it is for foreign keys.
   */
  dedupe: Record<string, ShareDedupeStrategy>;
  /**
   * The ONLY columns an incoming row may carry into the database, per table. Everything else is
   * dropped by `planShareImport` before a row can reach `assignRawColumns`.
   *
   * This is a security boundary, not tidiness. A share arrives over a camera from a phone we do
   * not control, and `assignRawColumns` writes `record[camelCase(key)] = value` for every key it
   * is handed — so without an allowlist a crafted payload could set `collection`, or shadow a
   * method like `markAsDeleted`, on the WatermelonDB model instance being built.
   *
   * Unknown columns are dropped silently rather than rejected: the two phones in a transfer can be
   * months apart in app version, and a column this build has never heard of is the expected shape
   * of that, not an attack. `id` is always kept — it is the row's identity, remapped by the plan.
   *
   * Pinned against the real schema by `database/share/__tests__/importShareEnvelope.test.ts`, so a
   * new column cannot be silently unshareable and a removed one cannot linger here.
   */
  columns: Record<string, readonly string[]>;
  assetColumns: Record<string, readonly string[]>;
  /**
   * table → the ONE foreign-key column naming its parent. A row is dropped when that parent
   * resolved to a record the receiver already had. Named explicitly rather than inferred from the
   * first key of `foreignKeys[table]`, which silently depended on object property order.
   */
  dropWhenParentReused: Record<string, string>;
  pruneUnreferenced: readonly string[];
  forcedColumns: Record<string, Record<string, unknown>>;
}

const TIMESTAMP_COLUMNS = ['created_at', 'updated_at'] as const;

export const MEAL_SHARE_SPEC: ShareKindSpec = {
  assetColumns: { meals: ['image_url'] },
  columns: {
    food_food_portions: ['food_id', 'food_portion_id', 'is_default', ...TIMESTAMP_COLUMNS],
    food_portions: [
      'name',
      'gram_weight',
      'icon',
      'source',
      'kind',
      'scope',
      'owner_type',
      'owner_id',
      ...TIMESTAMP_COLUMNS,
    ],
    foods: [
      'is_ai_generated',
      'name',
      'brand',
      'barcode',
      'description',
      'calories',
      'protein',
      'carbs',
      'fat',
      'fiber',
      'external_id',
      'nutriscore',
      'ecoscore',
      'nova_group',
      'micros_json',
      'labels_json',
      'is_favorite',
      'source',
      'image_url',
      'nutrition_basis',
      ...TIMESTAMP_COLUMNS,
    ],
    meal_food_portions: ['meal_id', 'food_portion_id', 'is_default', ...TIMESTAMP_COLUMNS],
    meal_foods: ['meal_id', 'food_id', 'amount', 'portion_id', ...TIMESTAMP_COLUMNS],
    meals: [
      'is_ai_generated',
      'name',
      'description',
      'image_url',
      'is_favorite',
      'prepared_weight_grams',
      'nutrition_basis',
      'recipe_servings_count',
      'default_portion_name',
      'serving_grams',
      ...TIMESTAMP_COLUMNS,
    ],
  },
  dedupe: {
    food_portions: 'portion-identity',
    foods: 'food-identity',
    meals: 'create',
  },
  // The receiver's own copy of a food already has whatever default portion it wants linked.
  dropWhenParentReused: { food_food_portions: 'food_id' },
  forcedColumns: {
    food_portions: { source: 'custom' },
    foods: { is_favorite: false },
    meals: { is_favorite: false },
  },
  foreignKeys: {
    food_food_portions: {
      food_id: 'foods',
      food_portion_id: 'food_portions',
    },
    food_portions: {
      owner_id: {
        polymorphic: {
          typeColumn: 'owner_type',
          typeToTable: { food: 'foods', meal: 'meals' },
        },
      },
    },
    meal_food_portions: {
      food_portion_id: 'food_portions',
      meal_id: 'meals',
    },
    meal_foods: {
      food_id: 'foods',
      meal_id: 'meals',
      portion_id: 'food_portions',
    },
  },
  kind: 'meal',
  kindVersion: 1,
  pruneUnreferenced: ['food_portions'],
  rootTable: 'meals',
  // Dependency order. Keep this a subsequence of RESTORE_ORDER.
  tables: [
    'foods',
    'food_portions',
    'meals',
    'food_food_portions',
    'meal_food_portions',
    'meal_foods',
  ],
};

export const SHARE_KINDS: Readonly<Record<MusclogShareKind, ShareKindSpec>> = {
  meal: MEAL_SHARE_SPEC,
};

export function getShareKindSpec(kind: string): ShareKindSpec | undefined {
  return Object.hasOwn(SHARE_KINDS, kind) ? SHARE_KINDS[kind as MusclogShareKind] : undefined;
}
