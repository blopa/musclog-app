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
const QUERY_VALUE_BATCH_SIZE = 500;

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

async function removeAssetUris(
  assetStore: { remove: (uri: string) => Promise<void> },
  uris: string[]
): Promise<void> {
  await Promise.allSettled(uris.map((uri) => assetStore.remove(uri)));
}

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

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function batches<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += QUERY_VALUE_BATCH_SIZE) {
    result.push(values.slice(index, index + QUERY_VALUE_BATCH_SIZE));
  }
  return result;
}

async function activeFoodsWhereAny(column: string, values: string[]): Promise<Food[]> {
  return (
    await Promise.all(
      batches(values).map((batch) =>
        database
          .get<Food>('foods')
          .query(Q.where(column, Q.oneOf(batch)), Q.where('deleted_at', Q.eq(null)))
          .fetch()
      )
    )
  ).flat();
}

function indexBy<T>(items: T[], getKey: (item: T) => string | undefined): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) {
      continue;
    }
    const matches = index.get(key);
    if (matches) {
      matches.push(item);
    } else {
      index.set(key, [item]);
    }
  }
  return index;
}

async function resolveFoods(rows: ShareRow[]): Promise<Record<string, string>> {
  const externalIds = uniqueStrings(rows.map((row) => stringValue(row.external_id)));
  const barcodes = uniqueStrings(rows.map((row) => stringValue(row.barcode)));
  const names = uniqueStrings(rows.map((row) => stringValue(row.name)));
  const [externalMatches, barcodeMatches, nameMatches] = await Promise.all([
    activeFoodsWhereAny('external_id', externalIds),
    activeFoodsWhereAny('barcode', barcodes),
    activeFoodsWhereAny('name', names),
  ]);
  const byExternalId = indexBy(externalMatches, (food) => food.externalId);
  const byBarcode = indexBy(barcodeMatches, (food) => food.barcode);
  const byName = indexBy(nameMatches, (food) => food.name);
  const resolutions: Record<string, string> = {};

  for (const row of rows) {
    const sourceId = stringValue(row.id);
    if (!sourceId) {
      continue;
    }
    const externalId = stringValue(row.external_id);
    const barcode = stringValue(row.barcode);
    const name = stringValue(row.name);
    const brand = stringValue(row.brand);
    const match =
      byExternalId.get(externalId ?? '')?.find((food) => foodBasisMatches(food, row)) ??
      byBarcode.get(barcode ?? '')?.find((food) => foodBasisMatches(food, row)) ??
      byName
        .get(name ?? '')
        ?.find(
          (food) =>
            stringValue(food.brand) === brand &&
            foodBasisMatches(food, row) &&
            foodMacrosMatch(food, row)
        );
    if (match) {
      resolutions[sourceId] = match.id;
    }
  }

  return resolutions;
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

async function resolvePortions(
  rows: ShareRow[],
  context: ShareDedupeContext
): Promise<Record<string, string>> {
  const globalNames = uniqueStrings(
    rows.filter((row) => !stringValue(row.owner_type)).map((row) => stringValue(row.name))
  );
  const ownerLocalIds = uniqueStrings(
    rows
      .filter((row) => stringValue(row.owner_type) === 'food')
      .map((row) => context.reusedLocalId('foods', stringValue(row.owner_id)))
  );
  const [globalMatches, ownedMatches] = await Promise.all([
    Promise.all(
      batches(globalNames).map((batch) =>
        activePortionsWhere(Q.where('name', Q.oneOf(batch)), Q.where('owner_id', Q.eq(null)))
      )
    ).then((matches) => matches.flat()),
    Promise.all(
      batches(ownerLocalIds).map((batch) =>
        activePortionsWhere(Q.where('owner_type', 'food'), Q.where('owner_id', Q.oneOf(batch)))
      )
    ).then((matches) => matches.flat()),
  ]);
  const globalsByName = indexBy(globalMatches, (portion) => portion.name);
  const ownedByOwnerId = indexBy(ownedMatches, (portion) => portion.ownerId);
  const resolutions: Record<string, string> = {};

  for (const row of rows) {
    const sourceId = stringValue(row.id);
    const name = stringValue(row.name);
    if (!sourceId || !name) {
      continue;
    }
    const ownerType = stringValue(row.owner_type);
    const candidates = !ownerType
      ? globalsByName.get(name)
      : ownerType === 'food'
        ? ownedByOwnerId.get(context.reusedLocalId('foods', stringValue(row.owner_id)) ?? '')
        : undefined;
    const match = candidates?.find((portion) => portionIdentityMatches(portion, row));
    if (match) {
      resolutions[sourceId] = match.id;
    }
  }

  return resolutions;
}

/**
 * The query behind each `ShareKindSpec.dedupe` strategy. Adding a strategy means adding an entry
 * here and naming it in a kind's spec — the loop below never learns a table name.
 */
const DEDUPE_RESOLVERS: Record<
  Exclude<ShareDedupeStrategy, 'create'>,
  (rows: ShareRow[], context: ShareDedupeContext) => Promise<Record<string, string>>
> = {
  'food-identity': resolveFoods,
  'portion-identity': resolvePortions,
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
    const rows = (records[table] ?? []).filter(
      (row) => row.deleted_at == null && row._status !== 'deleted' && typeof row.id === 'string'
    );
    resolutions[table] = await DEDUPE_RESOLVERS[strategy](rows, context);
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
  const writtenAssetUriSet = new Set(writtenAssetUris);

  let committed: { result: ShareImportResult; usedAssetUris: Set<string> };
  try {
    committed = await database.write(async () => {
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
      const usedAssetUris = new Set<string>();
      for (const { row, table } of plan.creates) {
        for (const column of spec.assetColumns[table] ?? []) {
          const value = row[column];
          if (typeof value === 'string' && writtenAssetUriSet.has(value)) {
            usedAssetUris.add(value);
          }
        }
      }
      return {
        result: { kind: envelope.kind, reused: plan.reused, rootId: plan.rootId },
        usedAssetUris,
      };
    });
  } catch (error) {
    await removeAssetUris(assetStore, writtenAssetUris);
    throw error;
  }

  await removeAssetUris(
    assetStore,
    writtenAssetUris.filter((uri) => !committed.usedAssetUris.has(uri))
  );
  return committed.result;
}
