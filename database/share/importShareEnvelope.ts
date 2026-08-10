import { Q } from '@nozbe/watermelondb';

import { assignRawColumns } from '@/database/assignRawColumns';
import { database } from '@/database/database-instance';
import Food from '@/database/models/Food';
import FoodPortion from '@/database/models/FoodPortion';
import {
  deleteFoodImage,
  deleteMealImage,
  saveBase64ImageToFile,
  saveBase64MealImage,
} from '@/utils/file';
import { type MusclogShareEnvelope, type ShareRow } from '@/utils/share/shareEnvelope';
import {
  planShareImport,
  type ReusedShareRow,
  type ShareImportResolutions,
} from '@/utils/share/shareImportPlan';
import {
  getShareKindSpec,
  type ShareAssetStore,
  type ShareDedupeStrategy,
  type ShareKindSpec,
} from '@/utils/share/shareKinds';

const MACRO_COLUMNS = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
const IDENTITY_EPSILON = 1e-6;

/**
 * Where a received photo is written, and how it is taken back if the write that follows fails. The
 * kind picks the store (`ShareKindSpec.assetStore`) so a shared food's photo lands beside the app's
 * other food photos rather than in the meals directory.
 */
const ASSET_STORES: Record<
  ShareAssetStore,
  { save: (base64: string) => Promise<string>; remove: (uri: string) => Promise<void> }
> = {
  food: { remove: deleteFoodImage, save: saveBase64ImageToFile },
  meal: { remove: deleteMealImage, save: saveBase64MealImage },
};

export interface ShareImportResult {
  kind: MusclogShareEnvelope['kind'];
  rootId: string;
  reused: ReusedShareRow[];
}

/**
 * What a dedupe resolver may know about the rows resolved before it. Populated table by table in
 * `spec.tables` order, which is why that list is documented as dependency order: a portion can only
 * ask whether its owning food was reused because `foods` is resolved first.
 */
export interface ShareDedupeContext {
  /**
   * The receiver's existing record that an already-resolved row matched, or `undefined` when the
   * row will be created fresh. Never a generated id — `planShareImport` mints those later, so a
   * value here always names a record the receiver already had.
   */
  reusedLocalId: (table: string, sourceId: string | undefined) => string | undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function incomingFoodBasis(row: ShareRow): 'per_100g' | 'per_serving' {
  return row.nutrition_basis === 'per_serving' ? 'per_serving' : 'per_100g';
}

function foodBasisMatches(food: Food, row: ShareRow): boolean {
  return food.resolvedNutritionBasis === incomingFoodBasis(row);
}

function foodMacrosMatch(food: Food, row: ShareRow): boolean {
  return MACRO_COLUMNS.every((column) => {
    const incoming = Number(row[column]);
    return Number.isFinite(incoming) && Math.abs(food[column] - incoming) <= IDENTITY_EPSILON;
  });
}

async function activeFoodsWhere(column: string, value: string): Promise<Food[]> {
  return database
    .get<Food>('foods')
    .query(Q.where(column, value), Q.where('deleted_at', Q.eq(null)))
    .fetch();
}

async function resolveFood(row: ShareRow): Promise<Food | undefined> {
  const externalId = stringValue(row.external_id);
  if (externalId) {
    const match = (await activeFoodsWhere('external_id', externalId)).find((food) =>
      foodBasisMatches(food, row)
    );
    if (match) {
      return match;
    }
  }

  const barcode = stringValue(row.barcode);
  if (barcode) {
    const match = (await activeFoodsWhere('barcode', barcode)).find((food) =>
      foodBasisMatches(food, row)
    );
    if (match) {
      return match;
    }
  }

  const name = stringValue(row.name);
  if (!name) {
    return undefined;
  }
  const brand = stringValue(row.brand);
  return (await activeFoodsWhere('name', name)).find(
    (food) =>
      stringValue(food.brand) === brand && foodBasisMatches(food, row) && foodMacrosMatch(food, row)
  );
}

function incomingPortionKind(row: ShareRow): 'mass' | 'named' {
  return row.kind === 'named' ? 'named' : 'mass';
}

function incomingPortionScope(row: ShareRow): 'global' | 'private' {
  return row.scope === 'private' ? 'private' : 'global';
}

function portionSizeMatches(stored: null | number | undefined, incoming: unknown): boolean {
  const storedGrams = isFiniteNumber(stored) ? stored : undefined;
  const incomingGrams = isFiniteNumber(incoming) ? incoming : undefined;
  if (storedGrams === undefined || incomingGrams === undefined) {
    return storedGrams === incomingGrams;
  }
  return Math.abs(storedGrams - incomingGrams) <= IDENTITY_EPSILON;
}

/**
 * Name + size is the identity a user reasons about. `kind` and `scope` come along because a named
 * portion and a mass portion are not the same thing, and neither are a globally offered portion and
 * one private to a single item.
 *
 * `source` is deliberately NOT part of it: `MEAL_SHARE_SPEC.forcedColumns` stamps every imported
 * portion `custom`, so matching on it would make receiving the same meal twice duplicate every
 * `basic` portion the first receive had already localized.
 */
function portionIdentityMatches(portion: FoodPortion, row: ShareRow): boolean {
  return (
    portion.name === stringValue(row.name) &&
    portionSizeMatches(portion.gramWeight, row.gram_weight) &&
    portion.resolvedKind === incomingPortionKind(row) &&
    portion.resolvedScope === incomingPortionScope(row)
  );
}

async function activePortionsWhere(...clauses: Q.Clause[]): Promise<FoodPortion[]> {
  return database
    .get<FoodPortion>('food_portions')
    .query(...clauses, Q.where('deleted_at', Q.eq(null)))
    .fetch();
}

async function resolvePortion(
  row: ShareRow,
  context: ShareDedupeContext
): Promise<FoodPortion | undefined> {
  const name = stringValue(row.name);
  if (!name) {
    return undefined;
  }

  const ownerType = stringValue(row.owner_type);
  if (!ownerType) {
    const candidates = await activePortionsWhere(
      Q.where('name', name),
      Q.where('owner_id', Q.eq(null))
    );
    return candidates.find((portion) => portionIdentityMatches(portion, row));
  }

  // An owned portion only means anything under its owner, so it can be reused only when that owner
  // is a record the receiver ALREADY had. A meal-owned one never qualifies: the meal is the share's
  // root and is always created fresh, so there is no existing meal whose portions could be reused.
  if (ownerType !== 'food') {
    return undefined;
  }
  const ownerLocalId = context.reusedLocalId('foods', stringValue(row.owner_id));
  if (!ownerLocalId) {
    return undefined;
  }

  const candidates = await activePortionsWhere(
    Q.where('owner_type', 'food'),
    Q.where('owner_id', ownerLocalId)
  );
  return candidates.find((portion) => portionIdentityMatches(portion, row));
}

/**
 * The query behind each `ShareKindSpec.dedupe` strategy. Adding a strategy means adding an entry
 * here and naming it in a kind's spec — the loop below never learns a table name.
 */
const DEDUPE_RESOLVERS: Record<
  Exclude<ShareDedupeStrategy, 'create'>,
  (row: ShareRow, context: ShareDedupeContext) => Promise<{ id: string } | undefined>
> = {
  'food-identity': resolveFood,
  'portion-identity': resolvePortion,
};

async function buildResolutions(
  spec: ShareKindSpec,
  records: Record<string, ShareRow[]>
): Promise<ShareImportResolutions> {
  const resolutions: ShareImportResolutions = {};
  const context: ShareDedupeContext = {
    reusedLocalId: (table, sourceId) => (sourceId ? resolutions[table]?.[sourceId] : undefined),
  };

  for (const table of spec.tables) {
    const strategy = spec.dedupe[table] ?? 'create';
    if (strategy === 'create') {
      continue;
    }
    const resolve = DEDUPE_RESOLVERS[strategy];
    resolutions[table] = {};

    for (const row of records[table] ?? []) {
      if (row.deleted_at != null || row._status === 'deleted' || typeof row.id !== 'string') {
        continue;
      }
      const match = await resolve(row, context);
      if (match) {
        resolutions[table][row.id] = match.id;
      }
    }
  }

  return resolutions;
}

export async function importShareEnvelope(
  envelope: MusclogShareEnvelope
): Promise<ShareImportResult> {
  const spec = getShareKindSpec(envelope.kind);
  if (!spec) {
    throw new Error(`Unsupported share kind: ${envelope.kind}`);
  }

  const assetStore = ASSET_STORES[spec.assetStore];
  const resolvedAssets: Record<string, string | undefined> = {};
  const writtenAssetUris: string[] = [];
  for (const [assetId, asset] of Object.entries(envelope.assets ?? {})) {
    try {
      const uri = await assetStore.save(asset.base64);
      resolvedAssets[assetId] = uri;
      writtenAssetUris.push(uri);
    } catch {
      resolvedAssets[assetId] = undefined;
    }
  }

  try {
    return await database.write(async () => {
      const resolutions = await buildResolutions(spec, envelope.records);
      const plan = planShareImport(spec, envelope.records, {
        assets: resolvedAssets,
        nowMs: Date.now(),
        resolutions,
        rootId: envelope.rootId,
      });
      const operations = plan.creates.map(({ localId, row, table }) =>
        database.get(table).prepareCreate((record: any) => {
          record._raw.id = localId;
          assignRawColumns(record, row);
        })
      );

      await database.batch(...operations);
      return { kind: envelope.kind, reused: plan.reused, rootId: plan.rootId };
    });
  } catch (error) {
    await Promise.all(writtenAssetUris.map((uri) => assetStore.remove(uri)));
    throw error;
  }
}
