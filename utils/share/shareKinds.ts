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
   * which owns the per-strategy queries.
   */
  dedupe: Record<string, ShareDedupeStrategy>;
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

export const MEAL_SHARE_SPEC: ShareKindSpec = {
  assetColumns: { meals: ['image_url'] },
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
