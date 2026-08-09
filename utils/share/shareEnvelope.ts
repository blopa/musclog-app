import { getShareKindSpec, type MusclogShareKind } from './shareKinds';

export const MUSCLOG_SHARE_ENVELOPE_VERSION = 1;
export const SHARE_ASSET_REF_PREFIX = 'share-asset:';

const MAX_SHARE_ROWS = 2_000;
const MAX_SHARE_ASSET_BYTES = 4 * 1024 * 1024;

export type ShareRow = Record<string, unknown>;

export interface ShareAsset {
  mime: string;
  width: number;
  height: number;
  base64: string;
}

export interface MealShareNutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MealShareIngredient {
  name: string;
  amount: number;
  unit: 'g' | 'serving' | 'portion';
  portionName?: string;
  calories: number;
}

export interface MealShareSummary {
  name: string;
  description?: string;
  nutritionBasis: 'per_recipe' | 'per_serving' | 'per_gram';
  recipeServingsCount?: number;
  servingGrams?: number;
  preparedWeightGrams?: number;
  totals: MealShareNutrients;
  hasImage: boolean;
  ingredients: MealShareIngredient[];
}

interface ShareEnvelopeBase {
  /** Never add `_exportVersion` here: old builds would treat the payload as a restorable dump. */
  _musclogShare: number;
  kind: MusclogShareKind;
  kindVersion: number;
  createdAtMs: number;
  records: Record<string, ShareRow[]>;
  rootTable: string;
  rootId: string;
  assets?: Record<string, ShareAsset>;
}

export interface MealShareEnvelope extends ShareEnvelopeBase {
  kind: 'meal';
  summary: MealShareSummary;
}

export type MusclogShareEnvelope = MealShareEnvelope;

export type MusclogShareErrorCode =
  'not-a-share' | 'unsupported-envelope' | 'unsupported-kind' | 'malformed' | 'too-large';

export class MusclogShareError extends Error {
  constructor(
    readonly code: MusclogShareErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'MusclogShareError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function malformed(message: string): never {
  throw new MusclogShareError('malformed', message);
}

/**
 * An absent optional field arrives as an explicit `null`, not as a missing key: WatermelonDB reads
 * an unset optional column back as `null` (never `undefined`, whatever the model's `?:` typing
 * says), and `JSON.stringify` keeps that null. Every optional field here is therefore read through
 * this, which also DELETES the key — so the object handed back really matches the declared
 * `?: number` / `?: string` types instead of smuggling nulls past the `as` cast at the end.
 *
 * Builders should not emit those nulls in the first place (`buildMealShareEnvelope` does not), but
 * v2.11.0 shipped one that did, and its share payloads failed the whole meal-share receive with a
 * "sent by a newer version of Musclog" error. Reading null as absent is what lets a phone on this
 * build receive from a phone still on that one, so keep it even once no such sender is left.
 */
function readOptional(container: Record<string, unknown>, key: string): unknown {
  if (container[key] === null) {
    delete container[key];
  }
  return container[key];
}

function validateMealSummary(value: unknown): asserts value is MealShareSummary {
  if (!isRecord(value)) {
    malformed('Share summary is missing');
  }

  if (
    typeof value.name !== 'string' ||
    (readOptional(value, 'description') !== undefined && typeof value.description !== 'string') ||
    !['per_recipe', 'per_serving', 'per_gram'].includes(String(value.nutritionBasis)) ||
    typeof value.hasImage !== 'boolean' ||
    !Array.isArray(value.ingredients) ||
    value.ingredients.length === 0 ||
    !isRecord(value.totals)
  ) {
    malformed('Meal share summary has an invalid shape');
  }

  for (const key of ['recipeServingsCount', 'servingGrams', 'preparedWeightGrams']) {
    if (readOptional(value, key) !== undefined && !isFiniteNumber(value[key])) {
      malformed(`Meal share summary has an invalid ${key}`);
    }
  }

  for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber']) {
    if (!isFiniteNumber(value.totals[key])) {
      malformed(`Meal share summary has an invalid total for ${key}`);
    }
  }

  for (const ingredient of value.ingredients) {
    if (
      !isRecord(ingredient) ||
      typeof ingredient.name !== 'string' ||
      !isFiniteNumber(ingredient.amount) ||
      !['g', 'serving', 'portion'].includes(String(ingredient.unit)) ||
      (readOptional(ingredient, 'portionName') !== undefined &&
        typeof ingredient.portionName !== 'string') ||
      !isFiniteNumber(ingredient.calories)
    ) {
      malformed('Meal share summary has an invalid ingredient');
    }
  }
}

function decodedBase64Bytes(base64: string): number {
  const compact = base64.replace(/\s/g, '');
  if (!compact || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    malformed('Share asset contains invalid base64');
  }
  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0;
  return (compact.length / 4) * 3 - padding;
}

function validateAssets(value: unknown): asserts value is Record<string, ShareAsset> | undefined {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    malformed('Share assets must be an object');
  }

  let totalBytes = 0;
  for (const asset of Object.values(value)) {
    if (
      !isRecord(asset) ||
      typeof asset.mime !== 'string' ||
      !isFiniteNumber(asset.width) ||
      !isFiniteNumber(asset.height) ||
      typeof asset.base64 !== 'string'
    ) {
      malformed('Share asset has an invalid shape');
    }
    totalBytes += decodedBase64Bytes(asset.base64);
    if (totalBytes > MAX_SHARE_ASSET_BYTES) {
      throw new MusclogShareError('too-large', 'Share assets exceed the 4 MB limit');
    }
  }
}

export function parseShareEnvelope(json: string): MusclogShareEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new MusclogShareError('malformed', 'Share payload is not valid JSON');
  }

  if (!isRecord(parsed)) {
    throw new MusclogShareError('not-a-share', 'Payload is not a Musclog share envelope');
  }

  if (!Number.isInteger(parsed._musclogShare) || Number(parsed._musclogShare) < 1) {
    throw new MusclogShareError('not-a-share', 'Payload is not a Musclog share envelope');
  }
  if (Number(parsed._musclogShare) > MUSCLOG_SHARE_ENVELOPE_VERSION) {
    throw new MusclogShareError('unsupported-envelope', 'Share envelope is from a newer app');
  }
  if (Object.hasOwn(parsed, '_exportVersion')) {
    malformed('A share envelope cannot also be a database export');
  }

  if (typeof parsed.kind !== 'string') {
    malformed('Share kind is missing');
  }
  const spec = getShareKindSpec(parsed.kind);
  if (!spec) {
    throw new MusclogShareError('unsupported-kind', 'Share kind is not supported');
  }
  if (!Number.isInteger(parsed.kindVersion) || Number(parsed.kindVersion) < 1) {
    malformed('Share kind version is invalid');
  }
  if (Number(parsed.kindVersion) > spec.kindVersion) {
    throw new MusclogShareError('unsupported-kind', 'Share kind is from a newer app');
  }

  if (
    typeof parsed.createdAtMs !== 'number' ||
    !Number.isFinite(parsed.createdAtMs) ||
    parsed.rootTable !== spec.rootTable ||
    typeof parsed.rootId !== 'string' ||
    !parsed.rootId ||
    !isRecord(parsed.records)
  ) {
    malformed('Share envelope metadata is invalid');
  }

  let rowCount = 0;
  for (const [table, rows] of Object.entries(parsed.records)) {
    if (!spec.tables.includes(table) || !Array.isArray(rows)) {
      malformed(`Share records contain an unsupported table: ${table}`);
    }
    const ids = new Set<string>();
    for (const row of rows) {
      if (!isRecord(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) {
        malformed(`Share records contain an invalid ${table} row`);
      }
      ids.add(row.id);
      rowCount++;
      if (rowCount > MAX_SHARE_ROWS) {
        throw new MusclogShareError('too-large', 'Share contains more than 2000 rows');
      }
    }
  }

  const roots = parsed.records[spec.rootTable];
  if (!Array.isArray(roots) || roots.filter((row) => row.id === parsed.rootId).length !== 1) {
    malformed('Share root row is missing or duplicated');
  }

  validateAssets(readOptional(parsed, 'assets'));
  if (spec.kind === 'meal') {
    const mealFoods = parsed.records.meal_foods;
    if (!Array.isArray(mealFoods) || mealFoods.length === 0) {
      malformed('Meal share has no ingredients');
    }
    validateMealSummary(parsed.summary);
  }

  return parsed as unknown as MusclogShareEnvelope;
}
