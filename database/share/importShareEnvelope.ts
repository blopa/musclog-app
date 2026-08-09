import { Q } from '@nozbe/watermelondb';

import { assignRawColumns } from '@/database/assignRawColumns';
import { database } from '@/database/database-instance';
import Food from '@/database/models/Food';
import FoodPortion from '@/database/models/FoodPortion';
import { deleteMealImage, saveBase64MealImage } from '@/utils/file';
import { type MusclogShareEnvelope, type ShareRow } from '@/utils/share/shareEnvelope';
import {
  planShareImport,
  type ReusedShareRow,
  type ShareImportResolutions,
} from '@/utils/share/shareImportPlan';
import {
  getShareKindSpec,
  type ShareDedupeStrategy,
  type ShareKindSpec,
} from '@/utils/share/shareKinds';

const MACRO_COLUMNS = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
const IDENTITY_EPSILON = 1e-6;

export interface ShareImportResult {
  kind: MusclogShareEnvelope['kind'];
  rootId: string;
  reused: ReusedShareRow[];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
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

function incomingPortionSource(row: ShareRow): 'basic' | 'custom' {
  return row.source === 'custom' ? 'custom' : 'basic';
}

async function resolvePortion(row: ShareRow): Promise<FoodPortion | undefined> {
  if (row.scope === 'private' || stringValue(row.owner_type)) {
    return undefined;
  }
  const name = stringValue(row.name);
  if (!name) {
    return undefined;
  }

  const candidates = await database
    .get<FoodPortion>('food_portions')
    .query(Q.where('name', name), Q.where('deleted_at', Q.eq(null)))
    .fetch();
  return candidates.find(
    (portion) =>
      (portion.gramWeight ?? null) === (row.gram_weight ?? null) &&
      portion.resolvedKind === incomingPortionKind(row) &&
      portion.resolvedSource === incomingPortionSource(row)
  );
}

/**
 * The query behind each `ShareKindSpec.dedupe` strategy. Adding a strategy means adding an entry
 * here and naming it in a kind's spec — the loop below never learns a table name.
 */
const DEDUPE_RESOLVERS: Record<
  Exclude<ShareDedupeStrategy, 'create'>,
  (row: ShareRow) => Promise<{ id: string } | undefined>
> = {
  'food-identity': resolveFood,
  'portion-identity': resolvePortion,
};

async function buildResolutions(
  spec: ShareKindSpec,
  records: Record<string, ShareRow[]>
): Promise<ShareImportResolutions> {
  const resolutions: ShareImportResolutions = {};

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
      const match = await resolve(row);
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

  const resolvedAssets: Record<string, string | undefined> = {};
  const writtenAssetUris: string[] = [];
  for (const [assetId, asset] of Object.entries(envelope.assets ?? {})) {
    try {
      const uri = await saveBase64MealImage(asset.base64);
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
    await Promise.all(writtenAssetUris.map((uri) => deleteMealImage(uri)));
    throw error;
  }
}
