/**
 * Helpers for encrypting/decrypting database field values.
 * Numbers and dates are serialized to string before encrypt, parsed after decrypt.
 */

import {
  decryptDatabaseValue,
  encrypt,
  encryptDatabaseValue,
  getEncryptionKey,
} from '@/utils/encryption';

export type NutritionLogSnapshotPlain = {
  loggedFoodName?: string;
  loggedCalories: number;
  loggedProtein: number;
  loggedCarbs: number;
  loggedFat: number;
  loggedFiber: number;
  loggedMicros?: Record<string, number | undefined>;
};

export type NutritionLogSnapshotExportFields = {
  logged_food_name: string;
  logged_calories: number;
  logged_protein: number;
  logged_carbs: number;
  logged_fat: number;
  logged_fiber: number;
  logged_micros_json: string;
  _decrypted: true;
};

function parsePlainMicrosJson(value: unknown): Record<string, number> | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  if (typeof value === 'object') {
    const out: Record<string, number> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (typeof raw === 'number' && !Number.isNaN(raw)) {
        out[key] = raw;
      }
    }

    return Object.keys(out).length > 0 ? out : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }

    const out: Record<string, number> = {};
    for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof raw === 'number' && !Number.isNaN(raw)) {
        out[key] = raw;
      }
    }

    return Object.keys(out).length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

export function readPlainNutritionLogSnapshotRow(
  row: Record<string, unknown>
): NutritionLogSnapshotPlain {
  return {
    loggedFoodName: row.logged_food_name != null ? String(row.logged_food_name) : undefined,
    loggedCalories: Number(row.logged_calories ?? 0),
    loggedProtein: Number(row.logged_protein ?? 0),
    loggedCarbs: Number(row.logged_carbs ?? 0),
    loggedFat: Number(row.logged_fat ?? 0),
    loggedFiber: Number(row.logged_fiber ?? 0),
    loggedMicros: parsePlainMicrosJson(row.logged_micros_json),
  };
}

export async function decryptNutritionLogSnapshotRow(
  row: Record<string, unknown>
): Promise<NutritionLogSnapshotPlain> {
  const [
    loggedFoodName,
    loggedCalories,
    loggedProtein,
    loggedCarbs,
    loggedFat,
    loggedFiber,
    micros,
  ] = await Promise.all([
    decryptOptionalString(row.logged_food_name as string | undefined),
    decryptNumber(row.logged_calories as string | undefined),
    decryptNumber(row.logged_protein as string | undefined),
    decryptNumber(row.logged_carbs as string | undefined),
    decryptNumber(row.logged_fat as string | undefined),
    decryptNumber(row.logged_fiber as string | undefined),
    decryptJson(row.logged_micros_json as string | undefined),
  ]);

  return {
    loggedFoodName: loggedFoodName || undefined,
    loggedCalories,
    loggedProtein,
    loggedCarbs,
    loggedFat,
    loggedFiber,
    loggedMicros: Object.keys(micros).length > 0 ? micros : undefined,
  };
}

export function nutritionLogSnapshotToExportFields(
  snapshot: NutritionLogSnapshotPlain
): NutritionLogSnapshotExportFields {
  return {
    logged_food_name: snapshot.loggedFoodName ?? '',
    logged_calories: snapshot.loggedCalories,
    logged_protein: snapshot.loggedProtein,
    logged_carbs: snapshot.loggedCarbs,
    logged_fat: snapshot.loggedFat,
    logged_fiber: snapshot.loggedFiber,
    logged_micros_json: snapshot.loggedMicros ? JSON.stringify(snapshot.loggedMicros) : '',
    _decrypted: true,
  };
}

export async function readSavedForLaterGroupNote(row: Record<string, unknown>): Promise<string> {
  if (row._decrypted === true) {
    return row.note != null ? String(row.note) : '';
  }

  return decryptOptionalString(row.note as string | undefined);
}

/** Encrypt a string (optional). Empty/undefined returns ''. */
export async function encryptOptionalString(value: string | undefined | null): Promise<string> {
  if (value === undefined || value === null) {
    return '';
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }

  return encryptDatabaseValue(trimmed);
}

/** Decrypt to string. Empty cipher returns ''. */
export async function decryptOptionalString(cipher: string | undefined | null): Promise<string> {
  if (!cipher || !String(cipher).trim()) {
    return '';
  }

  return decryptDatabaseValue(cipher);
}

/** Encrypt a number (including 0). */
export async function encryptNumber(value: number): Promise<string> {
  const text = String(value);
  if (text === '' || (text !== '0' && Number.isNaN(Number(text)))) {
    return '';
  }

  const key = await getEncryptionKey();
  return encrypt(text, key);
}

/** Decrypt to number. Returns 0 if empty or invalid. Handles legacy plaintext in DB. */
export async function decryptNumber(cipher: string | undefined | null): Promise<number> {
  if (!cipher || String(cipher).trim() === '') {
    return 0;
  }
  const trimmed = String(cipher).trim();
  // Try decrypt first (encrypted payload)
  const decrypted = await decryptDatabaseValue(cipher);
  if (decrypted && decrypted.trim()) {
    const n = parseFloat(decrypted);
    if (!Number.isNaN(n)) {
      return n;
    }
  }

  // Legacy: value may be stored as plain number string (e.g. after schema migration)
  const asNum = parseFloat(trimmed);
  return Number.isNaN(asNum) ? 0 : asNum;
}

/** Encrypt a date (timestamp number). */
export async function encryptDate(value: number): Promise<string> {
  return encryptNumber(value);
}

/** Decrypt to date (timestamp). Handles legacy plaintext. */
export async function decryptDate(cipher: string | undefined | null): Promise<number> {
  return decryptNumber(cipher);
}

/** Encrypt JSON object (e.g. micros) as string. */
export async function encryptJson(
  value: Record<string, number | undefined> | undefined | null
): Promise<string> {
  if (value === undefined || value === null || Object.keys(value).length === 0) {
    return '';
  }

  const text = JSON.stringify(value);
  return encryptDatabaseValue(text);
}

/** Decrypt and parse JSON object. Returns {} if empty or invalid. Handles legacy plain JSON. */
export async function decryptJson(
  cipher: string | undefined | null
): Promise<Record<string, number>> {
  if (!cipher || String(cipher).trim() === '') {
    return {};
  }

  const trimmed = String(cipher).trim();
  const tryParse = (s: string): Record<string, number> => {
    try {
      const parsed = JSON.parse(s);
      if (typeof parsed !== 'object' || parsed === null) {
        return {};
      }
      const out: Record<string, number> = {};
      for (const k of Object.keys(parsed)) {
        const v = parsed[k];
        if (typeof v === 'number' && !Number.isNaN(v)) {
          out[k] = v;
        }
      }
      return out;
    } catch {
      return {};
    }
  };

  const decrypted = await decryptDatabaseValue(cipher);
  if (decrypted && decrypted.trim()) {
    return tryParse(decrypted);
  }

  return tryParse(trimmed);
}

/** Batch-encrypt nutrition log snapshot for create/update. */
export async function encryptNutritionLogSnapshot(plain: NutritionLogSnapshotPlain): Promise<{
  loggedFoodName: string;
  loggedCalories: string;
  loggedProtein: string;
  loggedCarbs: string;
  loggedFat: string;
  loggedFiber: string;
  loggedMicrosJson: string;
}> {
  const [
    loggedFoodName,
    loggedCalories,
    loggedProtein,
    loggedCarbs,
    loggedFat,
    loggedFiber,
    loggedMicrosJson,
  ] = await Promise.all([
    encryptOptionalString(plain.loggedFoodName),
    encryptNumber(plain.loggedCalories),
    encryptNumber(plain.loggedProtein),
    encryptNumber(plain.loggedCarbs),
    encryptNumber(plain.loggedFat),
    encryptNumber(plain.loggedFiber),
    encryptJson(plain.loggedMicros),
  ]);

  return {
    loggedFoodName,
    loggedCalories,
    loggedProtein,
    loggedCarbs,
    loggedFat,
    loggedFiber,
    loggedMicrosJson,
  };
}

/** Batch-encrypt user_metrics value and unit. Note is now stored separately (not encrypted). Date is stored plain (not encrypted). */
export async function encryptUserMetricFields(plain: {
  value: number;
  unit?: string;
  date: number;
}): Promise<{ value: string; unit: string }> {
  const [value, unit] = await Promise.all([
    encryptNumber(plain.value),
    encryptOptionalString(plain.unit),
  ]);

  return { value, unit: unit || '' };
}
