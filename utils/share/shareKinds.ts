export type MusclogShareKind = 'food' | 'meal';

export type ShareForeignKeyTarget =
  | string
  | {
      polymorphic: {
        typeColumn: string;
        typeToTable: Record<string, string>;
      };
    };

export type ShareDedupeStrategy = 'create' | 'food-identity' | 'portion-identity';

/**
 * Which of the app's image directories a received asset is written to. One per kind rather than one
 * per table, because a kind's assets all describe the same thing — a meal share carries the meal's
 * photo, a food share the food's. Foods carried inside a meal share deliberately never bring an
 * embedded image (see `database/share/shareRecords.ts`), so no kind mixes the two.
 */
export type ShareAssetStore = 'food' | 'meal';

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
  assetStore: ShareAssetStore;
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

/**
 * The food graph both kinds carry. A meal share reaches it through its ingredients, a food share
 * IS it — so the allowlists, foreign keys and dedupe rules are written once here rather than
 * copied into each spec, where they could drift into two different ideas of what a food is.
 */
const FOOD_COLUMNS = [
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
] as const;

const FOOD_PORTION_COLUMNS = [
  'name',
  'gram_weight',
  'icon',
  'source',
  'kind',
  'scope',
  'owner_type',
  'owner_id',
  ...TIMESTAMP_COLUMNS,
] as const;

const FOOD_FOOD_PORTION_COLUMNS = [
  'food_id',
  'food_portion_id',
  'is_default',
  ...TIMESTAMP_COLUMNS,
] as const;

export const MEAL_SHARE_SPEC: ShareKindSpec = {
  assetColumns: { meals: ['image_url'] },
  assetStore: 'meal',
  columns: {
    food_food_portions: FOOD_FOOD_PORTION_COLUMNS,
    food_portions: FOOD_PORTION_COLUMNS,
    foods: FOOD_COLUMNS,
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

/**
 * One food and the portions linked to it — the same graph a meal share carries per ingredient,
 * rooted at the food instead of reached through it.
 *
 * `owner_id` discriminates to `foods` only: a meal-owned portion has no meaning in a share with no
 * meal in it, and the builder never emits one.
 */
export const FOOD_SHARE_SPEC: ShareKindSpec = {
  assetColumns: { foods: ['image_url'] },
  assetStore: 'food',
  columns: {
    food_food_portions: FOOD_FOOD_PORTION_COLUMNS,
    food_portions: FOOD_PORTION_COLUMNS,
    foods: FOOD_COLUMNS,
  },
  dedupe: {
    food_portions: 'portion-identity',
    foods: 'food-identity',
  },
  // A food the receiver already has keeps the portions it already has: the whole share collapses to
  // "you have this one", and nothing on this phone is modified.
  dropWhenParentReused: { food_food_portions: 'food_id' },
  forcedColumns: {
    food_portions: { source: 'custom' },
    foods: { is_favorite: false },
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
          typeToTable: { food: 'foods' },
        },
      },
    },
  },
  kind: 'food',
  kindVersion: 1,
  pruneUnreferenced: ['food_portions'],
  rootTable: 'foods',
  // Dependency order. Keep this a subsequence of RESTORE_ORDER.
  tables: ['foods', 'food_portions', 'food_food_portions'],
};

export const SHARE_KINDS: Readonly<Record<MusclogShareKind, ShareKindSpec>> = {
  food: FOOD_SHARE_SPEC,
  meal: MEAL_SHARE_SPEC,
};

export function getShareKindSpec(kind: string): ShareKindSpec | undefined {
  return Object.hasOwn(SHARE_KINDS, kind) ? SHARE_KINDS[kind as MusclogShareKind] : undefined;
}
