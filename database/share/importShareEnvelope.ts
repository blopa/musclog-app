import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { dayRangeClauses } from '@/database/dayKeyQuery';
import {
  encryptNutritionLogSnapshot,
  readPlainNutritionLogSnapshotRow,
} from '@/database/encryptionHelpers';
import Food from '@/database/models/Food';
import FoodPortion from '@/database/models/FoodPortion';
import type NutritionLog from '@/database/models/NutritionLog';
import { prepareLocalCreateFromRaw } from '@/database/prepareLocalCreateFromRaw';
import { dayKeyRange, utcNormalizedDayKey } from '@/utils/calendarDate';
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
  type ShareEncryptStrategy,
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
  /** The record the share was about, for kinds that are about one — see `ShareKindSpec.rootTable`. */
  rootId?: string;
  reused: ReusedShareRow[];
  /** Rows this import soft-deleted to make room, per table. Only `'replace'` produces any. */
  replaced: number;
}

/**
 * What to do when the receiver already has entries on the day a `nutritionDay` share covers.
 *
 * There is no safe default, which is why the receive screen asks: `'add'` on a day that was already
 * logged double-counts it, and `'replace'` on a day the user has since edited by hand throws that
 * work away. Both are legitimate — re-importing a cartridge day you already scanned wants
 * `'replace'`, adding a friend's lunch to your own day wants `'add'`.
 */
export type NutritionDayImportMode = 'add' | 'replace';

export interface ImportShareEnvelopeOptions {
  /** Required for a `nutritionDay` share; ignored by every other kind. */
  dayMode?: NutritionDayImportMode;
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

function uniqueStrings(values: (string | undefined)[]): string[] {
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

/**
 * The transform behind each `ShareKindSpec.encrypt` strategy: plaintext on the wire in, this
 * device's ciphertext out. Registry-shaped for the same reason `DEDUPE_RESOLVERS` is — the loop
 * that applies it never learns a table name.
 *
 * A share is written with the SENDER's encryption key, which the receiver does not have, so these
 * columns cross the wire in the clear and are re-encrypted here. That mirrors what a database
 * restore does with `nutrition_logs` (`database/importDb.ts`), and it is why the plaintext form is
 * the builder's responsibility rather than a raw `_raw` copy.
 */
const ENCRYPT_TRANSFORMS: Record<
  ShareEncryptStrategy,
  (row: ShareRow) => Promise<Record<string, unknown>>
> = {
  'nutrition-log-snapshot': async (row) => {
    const encrypted = await encryptNutritionLogSnapshot(readPlainNutritionLogSnapshotRow(row));
    return {
      logged_calories: encrypted.loggedCalories,
      logged_carbs: encrypted.loggedCarbs,
      logged_fat: encrypted.loggedFat,
      logged_fiber: encrypted.loggedFiber,
      logged_food_name: encrypted.loggedFoodName,
      logged_micros_json: encrypted.loggedMicrosJson,
      logged_protein: encrypted.loggedProtein,
    };
  },
};

/**
 * Re-encrypts the columns each table declares, BEFORE the writer opens.
 *
 * Deliberately not done inside the transaction with the rest of the row work: every value goes
 * through `getEncryptionKey()`, and WatermelonDB serialises writers — holding the write lock across
 * dozens of key reads and AES calls would block every other write in the app for no reason. Nothing
 * here reads the database, so there is no time-of-check window to protect.
 */
async function encryptShareRecords(
  spec: ShareKindSpec,
  records: Record<string, ShareRow[]>
): Promise<Record<string, ShareRow[]>> {
  if (!spec.encrypt) {
    return records;
  }

  const encrypted = { ...records };
  for (const [table, strategy] of Object.entries(spec.encrypt)) {
    const rows = records[table];
    if (!rows) {
      continue;
    }
    encrypted[table] = await Promise.all(
      rows.map(async (row) => ({ ...row, ...(await ENCRYPT_TRANSFORMS[strategy](row)) }))
    );
  }
  return encrypted;
}

/**
 * The receiver's own live logs on the calendar days a `nutritionDay` share covers.
 *
 * Day membership is decided the way every other day-bucketed read in the app decides it: by each
 * row's own stored `date` + `timezone` through `utcNormalizedDayKey`, with the widened DB bounds
 * from `dayRangeClauses` trimmed by `filterRecords`. Deriving the target day from the incoming rows
 * rather than from `summary.dayKey` keeps the rows that get removed and the rows that get written
 * in exact agreement — a summary is display metadata, and nothing destructive should hinge on it.
 */
async function existingLogsOnSharedDays(rows: ShareRow[]): Promise<NutritionLog[]> {
  const dayKeys = rows
    .map((row) =>
      typeof row.date === 'number'
        ? utcNormalizedDayKey(row.date, typeof row.timezone === 'string' ? row.timezone : undefined)
        : undefined
    )
    .filter((key): key is number => key !== undefined);
  if (dayKeys.length === 0) {
    return [];
  }

  // One range over min..max: a day share is a single day in practice, and a contiguous range is
  // one indexed query instead of one per day.
  const range = dayKeyRange(Math.min(...dayKeys), Math.max(...dayKeys));
  const shared = new Set(dayKeys);
  const candidates = await database
    .get<NutritionLog>('nutrition_logs')
    .query(...dayRangeClauses(range), Q.where('deleted_at', Q.eq(null)))
    .fetch();

  return range
    .filterRecords(candidates)
    .filter((log) => shared.has(utcNormalizedDayKey(log.date, log.timezone)));
}

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
  envelope: MusclogShareEnvelope,
  options: ImportShareEnvelopeOptions = {}
): Promise<ShareImportResult> {
  const spec = getShareKindSpec(envelope.kind);
  if (!spec) {
    throw new Error(`Unsupported share kind: ${envelope.kind}`);
  }

  // Refuse rather than pick one: silently defaulting to `'add'` double-logs a re-scanned day, and
  // silently defaulting to `'replace'` deletes entries the user typed in themselves.
  if (envelope.kind === 'nutritionDay' && !options.dayMode) {
    throw new Error('A day share needs an explicit add-or-replace choice');
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
  const records = await encryptShareRecords(spec, envelope.records);

  let committed: { result: ShareImportResult; usedAssetUris: Set<string> };
  try {
    committed = await database.write(async () => {
      const now = Date.now();
      const resolutions = await buildResolutions(spec, records);
      const plan = planShareImport(spec, records, {
        assets: resolvedAssets,
        nowMs: now,
        resolutions,
        rootId: 'rootId' in envelope ? envelope.rootId : undefined,
      });

      // Read AND write inside the one writer: the rows to retire are chosen from the same
      // serialized transaction that inserts their replacements, so a second import cannot observe
      // the pre-delete state and leave both copies behind.
      const replacing =
        options.dayMode === 'replace'
          ? await existingLogsOnSharedDays(records.nutrition_logs ?? [])
          : [];

      const operations = [
        ...replacing.map((log) =>
          // Soft delete, stamped the way every model's own `markAsDeleted` stamps it. Prepared
          // rather than called, because a `@writer` cannot be invoked from inside an open writer.
          log.prepareUpdate((record) => {
            record.deletedAt = now;
            record.updatedAt = now;
          })
        ),
        ...plan.creates.map(({ row, table }) =>
          // `row` contains raw schema column names and reached here through `spec.columns`. The
          // allowlist is the trust boundary; WatermelonDB then sanitizes every value against the
          // collection schema without assigning attacker-controlled properties onto a model.
          prepareLocalCreateFromRaw(database.get(table), row)
        ),
      ];

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
        result: {
          kind: envelope.kind,
          replaced: replacing.length,
          reused: plan.reused,
          rootId: plan.rootId,
        },
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
