export type MusclogShareKind = 'food' | 'meal' | 'nutritionDay';

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
 * A table whose incoming rows carry plaintext for columns this app stores encrypted, and the
 * transform that puts them back. Named per table rather than per column because the encrypted
 * columns of one record are one unit — `nutrition_logs` keeps a whole macro snapshot behind
 * `encryptNutritionLogSnapshot`, not six independently encrypted fields.
 *
 * The builder is the other half of the contract: it must write the SAME plaintext shape the
 * strategy reads. `database/share/importShareEnvelope.ts` owns the transforms.
 */
export type ShareEncryptStrategy = 'nutrition-log-snapshot';

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
  /**
   * The one row the share is ABOUT, or `null` for a kind that has none.
   *
   * A food share is a food and a meal share is a meal, so both name a table here and their envelope
   * carries a `rootId` pointing into it. A day of eating is not a row — there is no `days` table,
   * and inventing a synthetic root would mean either writing a record the user never asked for or
   * anointing one arbitrary log as the day's representative. `null` says that plainly, and the
   * parser then REQUIRES the envelope to omit `rootTable`/`rootId` rather than accepting a root
   * nobody will use.
   */
  rootTable: null | string;
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
   * dropped by `planShareImport` before a row reaches WatermelonDB's raw-record sanitizer.
   *
   * This is a security boundary, not tidiness. A share arrives over a camera from a phone we do
   * not control, so it may only control the columns this share kind deliberately exposes.
   * `prepareCreateFromDirtyRaw` then applies the actual table schema as a second boundary; it never
   * assigns incoming keys as JavaScript properties on the model instance.
   *
   * Unknown columns are dropped silently rather than rejected: the two phones in a transfer can be
   * months apart in app version, and a column this build has never heard of is the expected shape
   * of that, not an attack. `id` is always kept — it is the row's identity, remapped by the plan.
   *
   * Pinned against the real schema by `database/share/__tests__/importShareEnvelope.test.ts`, so a
   * new column cannot be silently unshareable and a removed one cannot linger here.
   */
  columns: Record<string, readonly string[]>;
  /**
   * Columns holding plaintext that this app stores encrypted, per table. Applied by the importer
   * after the plan is built and before the rows are written, so the allowlist above still names the
   * plain column (`logged_calories`), not a second encrypted one.
   */
  encrypt?: Record<string, ShareEncryptStrategy>;
  /**
   * Columns whose value is an opaque local grouping id rather than a foreign key: every DISTINCT
   * incoming value is replaced by one freshly generated id, shared by the rows that carried it.
   *
   * `nutrition_logs.group_id` is the case — it ties the five logs of one AI-detected meal together
   * but points at no table this share carries (it may be a `meals` id on the sender). Passing it
   * through unchanged would let a received day collide with an unrelated local group; dropping it
   * would scatter one meal into five diary rows.
   */
  regeneratedColumns?: Record<string, readonly string[]>;
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
  /**
   * The table whose existing rows a "replace" import retires, for the kinds that offer that choice.
   *
   * Named here rather than inlined in the importer for the same reason `dedupe` and `encrypt` are:
   * `database/share/importShareEnvelope.ts` drives every per-table decision off this spec and never
   * writes a table name of its own. Rows of this table are matched by CALENDAR DAY, so it must
   * carry `date` + `timezone`; the importer derives the days from the incoming rows themselves.
   *
   * Absent means the kind cannot be replaced — importing it only ever adds.
   */
  replaceable?: string;
}

/**
 * A kind that IS one record. Builders read `rootTable` straight into the envelope, so the narrower
 * type is what keeps `rootTable: string` on a `FoodShareEnvelope` provable instead of asserted.
 */
export interface RootedShareKindSpec extends ShareKindSpec {
  rootTable: string;
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

export const MEAL_SHARE_SPEC: RootedShareKindSpec = {
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
export const FOOD_SHARE_SPEC: RootedShareKindSpec = {
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

/**
 * One calendar day of the food diary: the day's `nutrition_logs`, plus the food graph they point
 * at. What Musclog GB's `SHARE DAY` sends, and what the app's diary sends for a day.
 *
 * Deliberately NOT modelled as a meal (which is what `buildLoggedMealShare` does for a diary
 * section): a meal share saves a recipe into My Meals, while this restores what was eaten, on the
 * day it was eaten, into the receiver's diary. That difference is the whole feature — a day is
 * carried as logs, with their amounts, meal types and consumed times intact.
 *
 * `nutrition_logs.date` + `timezone` travel unchanged, and that is what pins the entries to the
 * right calendar day on a receiver in another timezone: `utcNormalizedDayKey` re-applies the stored
 * offset, so the day never shifts. No date is rewritten on import.
 */
export const NUTRITION_DAY_SHARE_SPEC: ShareKindSpec = {
  // A day carries no photo: the diary rows have none of their own, and their foods' pictures are
  // not what the user asked to send. The store is inert with no asset columns pointing at it.
  assetColumns: {},
  assetStore: 'food',
  columns: {
    food_food_portions: FOOD_FOOD_PORTION_COLUMNS,
    food_portions: FOOD_PORTION_COLUMNS,
    foods: FOOD_COLUMNS,
    nutrition_logs: [
      'food_id',
      'type',
      'amount',
      'portion_id',
      // Plaintext on the wire, re-encrypted with THIS device's key on import — see `encrypt`.
      'logged_food_name',
      'logged_calories',
      'logged_protein',
      'logged_carbs',
      'logged_fat',
      'logged_fiber',
      'logged_micros_json',
      'logged_nutriscore',
      'logged_ecoscore',
      'logged_nova_group',
      'snapshot_basis',
      'group_id',
      'logged_meal_name',
      'date',
      'timezone',
      ...TIMESTAMP_COLUMNS,
    ],
    // `external_id` is deliberately absent: it is the Health Connect / integration sync key, so
    // importing another device's would make this phone's next sync treat a received log as its own
    // previously-synced record and skip or overwrite the real one.
  },
  dedupe: {
    food_portions: 'portion-identity',
    foods: 'food-identity',
    // Logs are never matched against existing ones. Whether a day that already has entries gets
    // added to or replaced is the receiver's explicit choice on the preview screen, not something
    // inferred row by row — two identical entries in one day are a normal thing to eat twice.
    nutrition_logs: 'create',
  },
  dropWhenParentReused: { food_food_portions: 'food_id' },
  encrypt: { nutrition_logs: 'nutrition-log-snapshot' },
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
    nutrition_logs: {
      food_id: 'foods',
      portion_id: 'food_portions',
    },
  },
  kind: 'nutritionDay',
  kindVersion: 1,
  pruneUnreferenced: ['food_portions'],
  regeneratedColumns: { nutrition_logs: ['group_id'] },
  replaceable: 'nutrition_logs',
  rootTable: null,
  // Dependency order. Keep this a subsequence of RESTORE_ORDER.
  tables: ['foods', 'food_portions', 'food_food_portions', 'nutrition_logs'],
};

export const SHARE_KINDS: Readonly<Record<MusclogShareKind, ShareKindSpec>> = {
  food: FOOD_SHARE_SPEC,
  meal: MEAL_SHARE_SPEC,
  nutritionDay: NUTRITION_DAY_SHARE_SPEC,
};

export function getShareKindSpec(kind: string): ShareKindSpec | undefined {
  return Object.hasOwn(SHARE_KINDS, kind) ? SHARE_KINDS[kind as MusclogShareKind] : undefined;
}
