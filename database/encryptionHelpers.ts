/**
 * Helpers for encrypting/decrypting database field values.
 * Numbers and dates are serialized to string before encrypt, parsed after decrypt.
 */

import {
  decryptDatabaseValue,
  encrypt,
  encryptDatabaseValue,
  getEncryptionKey,
} from '../utils/encryption';

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
  console.log('encryptNumber - input value:', value, 'as text:', text);
  if (text === '' || (text !== '0' && Number.isNaN(Number(text)))) {
    console.log('encryptNumber - returning empty string for:', text);
    return '';
  }
  const key = await getEncryptionKey();
  const result = encrypt(text, key);
  console.log('encryptNumber - encrypted result for', text, ':', result);
  return result;
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
export async function encryptNutritionLogSnapshot(plain: {
  loggedFoodName?: string;
  loggedCalories: number;
  loggedProtein: number;
  loggedCarbs: number;
  loggedFat: number;
  loggedFiber: number;
  loggedMicros?: Record<string, number | undefined>;
}): Promise<{
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

/** Batch-encrypt user_metrics value and unit. Date is stored plain (not encrypted). */
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
