import {
  decryptDate,
  decryptJson,
  decryptNumber,
  decryptNutritionLogSnapshotRow,
  decryptOptionalString,
  encryptDate,
  encryptJson,
  encryptNumber,
  encryptNutritionLogSnapshot,
  encryptOptionalString,
  encryptUserMetricFields,
  type NutritionLogSnapshotPlain,
  nutritionLogSnapshotToExportFields,
  readPlainNutritionLogSnapshotRow,
  readSavedForLaterGroupNote,
} from '@/database/encryptionHelpers';

// Deterministic key so every round trip is reproducible; the AES itself stays real, which
// is the point — these helpers are the only thing standing between a weight/nutrition row
// and plaintext on disk.
jest.mock('@/utils/encryptionKeyStorage', () => ({
  getStoredEncryptionKey: jest.fn(async () => 'test-encryption-key'),
  storeEncryptionKey: jest.fn(async () => undefined),
  deleteStoredEncryptionKey: jest.fn(async () => undefined),
}));

/** The snake_case row shape the model/exporter hands to the decrypt path. */
const rowFromEncrypted = (encrypted: {
  loggedFoodName: string;
  loggedCalories: string;
  loggedProtein: string;
  loggedCarbs: string;
  loggedFat: string;
  loggedFiber: string;
  loggedMicrosJson: string;
}) => ({
  logged_food_name: encrypted.loggedFoodName,
  logged_calories: encrypted.loggedCalories,
  logged_protein: encrypted.loggedProtein,
  logged_carbs: encrypted.loggedCarbs,
  logged_fat: encrypted.loggedFat,
  logged_fiber: encrypted.loggedFiber,
  logged_micros_json: encrypted.loggedMicrosJson,
});

describe('encryptionHelpers', () => {
  describe('strings', () => {
    it('round-trips a food name through real ciphertext', async () => {
      const cipher = await encryptOptionalString('Greek yoghurt 0%');

      expect(cipher).not.toContain('yoghurt');
      await expect(decryptOptionalString(cipher)).resolves.toBe('Greek yoghurt 0%');
    });

    it('trims before encrypting so padding never changes the stored value', async () => {
      const padded = await encryptOptionalString('  Oats  ');

      await expect(decryptOptionalString(padded)).resolves.toBe('Oats');
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty', ''],
      ['whitespace only', '   '],
    ])('stores %s as an empty column rather than ciphertext', async (_label, value) => {
      await expect(encryptOptionalString(value)).resolves.toBe('');
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty', ''],
    ])('decrypts %s back to an empty string', async (_label, value) => {
      await expect(decryptOptionalString(value)).resolves.toBe('');
    });
  });

  describe('numbers', () => {
    it('round-trips a fractional body-fat percentage without precision loss', async () => {
      const cipher = await encryptNumber(17.35);

      expect(cipher).not.toBe('17.35');
      await expect(decryptNumber(cipher)).resolves.toBe(17.35);
    });

    it('round-trips a negative value', async () => {
      const cipher = await encryptNumber(-1.5);

      await expect(decryptNumber(cipher)).resolves.toBe(-1.5);
    });

    // encryptNumber deliberately bypasses encryptDatabaseValue, which collapses anything
    // that parses as 0 to an empty column. A 0-kcal / 0 g macro must survive as a real
    // encrypted 0, not become an empty string that reads back as "no value".
    it('encrypts a genuine 0 instead of collapsing it to an empty column', async () => {
      const cipher = await encryptNumber(0);

      expect(cipher).not.toBe('');
      await expect(decryptNumber(cipher)).resolves.toBe(0);
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty', ''],
      ['whitespace only', '  '],
    ])('decrypts %s to 0', async (_label, value) => {
      await expect(decryptNumber(value)).resolves.toBe(0);
    });

    // Rows written before the encryption migration hold a bare number string; reading one
    // must yield the number, not 0, or a user's history would silently zero out.
    it('falls back to legacy plaintext numbers left by pre-encryption rows', async () => {
      await expect(decryptNumber('72.5')).resolves.toBe(72.5);
    });

    it('round-trips a timestamp through the date helpers', async () => {
      const timestamp = Date.UTC(2026, 0, 15, 9, 30);
      const cipher = await encryptDate(timestamp);

      expect(cipher).not.toBe(String(timestamp));
      await expect(decryptDate(cipher)).resolves.toBe(timestamp);
    });
  });

  describe('json (micros)', () => {
    it('round-trips a micros map', async () => {
      const micros = { iron: 2.4, sodium: 310, vitaminC: 0 };
      const cipher = await encryptJson(micros);

      expect(cipher).not.toContain('iron');
      await expect(decryptJson(cipher)).resolves.toEqual(micros);
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['an empty object', {}],
    ])('stores %s as an empty column', async (_label, value) => {
      await expect(encryptJson(value as any)).resolves.toBe('');
    });

    it('decrypts an empty column to an empty object', async () => {
      await expect(decryptJson('')).resolves.toEqual({});
      await expect(decryptJson(null)).resolves.toEqual({});
    });

    it('drops non-numeric entries rather than persisting them as micros', async () => {
      const cipher = await encryptJson({ iron: 2.4, calcium: undefined } as any);

      await expect(decryptJson(cipher)).resolves.toEqual({ iron: 2.4 });
    });

    it('falls back to legacy plain JSON left by pre-encryption rows', async () => {
      await expect(decryptJson('{"iron":2.4,"sodium":310}')).resolves.toEqual({
        iron: 2.4,
        sodium: 310,
      });
    });
  });

  describe('nutrition log snapshot', () => {
    const plain: NutritionLogSnapshotPlain = {
      loggedFoodName: 'Chicken breast',
      loggedCalories: 165,
      loggedProtein: 31,
      loggedCarbs: 0,
      loggedFat: 3.6,
      loggedFiber: 0,
      loggedMicros: { iron: 1.04 },
    };

    it('round-trips every macro field, including the zero ones', async () => {
      const encrypted = await encryptNutritionLogSnapshot(plain);

      await expect(decryptNutritionLogSnapshotRow(rowFromEncrypted(encrypted))).resolves.toEqual(
        plain
      );
    });

    it('stores every snapshot field as ciphertext rather than plaintext', async () => {
      const encrypted = await encryptNutritionLogSnapshot(plain);

      const plaintextByField: Record<keyof typeof encrypted, string> = {
        loggedFoodName: plain.loggedFoodName!,
        loggedCalories: String(plain.loggedCalories),
        loggedProtein: String(plain.loggedProtein),
        loggedCarbs: String(plain.loggedCarbs),
        loggedFat: String(plain.loggedFat),
        loggedFiber: String(plain.loggedFiber),
        loggedMicrosJson: JSON.stringify(plain.loggedMicros),
      };

      for (const [field, value] of Object.entries(encrypted) as [
        keyof typeof encrypted,
        string,
      ][]) {
        expect(value).not.toBe('');
        expect(value).not.toBe(plaintextByField[field]);
      }
    });

    it('normalizes an absent food name and absent micros to undefined on read', async () => {
      const encrypted = await encryptNutritionLogSnapshot({
        loggedCalories: 0,
        loggedProtein: 0,
        loggedCarbs: 0,
        loggedFat: 0,
        loggedFiber: 0,
      });

      const decrypted = await decryptNutritionLogSnapshotRow(rowFromEncrypted(encrypted));

      expect(decrypted.loggedFoodName).toBeUndefined();
      expect(decrypted.loggedMicros).toBeUndefined();
      expect(decrypted.loggedCalories).toBe(0);
    });
  });

  describe('readPlainNutritionLogSnapshotRow', () => {
    // Import/export rows arrive already decrypted; running them through the decrypt path
    // instead would corrupt them, so this reader must never touch the cipher helpers.
    it('reads an already-decrypted export row without decrypting', () => {
      expect(
        readPlainNutritionLogSnapshotRow({
          logged_food_name: 'Oats',
          logged_calories: 389,
          logged_protein: 16.9,
          logged_carbs: 66.3,
          logged_fat: 6.9,
          logged_fiber: 10.6,
          logged_micros_json: '{"iron":4.7}',
        })
      ).toEqual({
        loggedFoodName: 'Oats',
        loggedCalories: 389,
        loggedProtein: 16.9,
        loggedCarbs: 66.3,
        loggedFat: 6.9,
        loggedFiber: 10.6,
        loggedMicros: { iron: 4.7 },
      });
    });

    it('accepts numeric strings and missing macro columns, defaulting them to 0', () => {
      expect(
        readPlainNutritionLogSnapshotRow({ logged_calories: '250', logged_protein: 12 })
      ).toEqual({
        loggedFoodName: undefined,
        loggedCalories: 250,
        loggedProtein: 12,
        loggedCarbs: 0,
        loggedFat: 0,
        loggedFiber: 0,
        loggedMicros: undefined,
      });
    });

    it('accepts micros that were already parsed into an object', () => {
      expect(
        readPlainNutritionLogSnapshotRow({ logged_micros_json: { iron: 4.7, bogus: 'x' } })
          .loggedMicros
      ).toEqual({ iron: 4.7 });
    });

    it.each([
      ['empty', ''],
      ['malformed', '{not json'],
      ['a JSON scalar', '42'],
      ['all-non-numeric', '{"iron":"lots"}'],
    ])('returns undefined micros for %s json', (_label, value) => {
      expect(
        readPlainNutritionLogSnapshotRow({ logged_micros_json: value }).loggedMicros
      ).toBeUndefined();
    });
  });

  describe('nutritionLogSnapshotToExportFields', () => {
    // The `_decrypted: true` marker is what tells the import path to take the plain reader
    // instead of trying to decrypt export data with the new device's key.
    it('marks the row as decrypted and serializes micros back to a string', () => {
      expect(
        nutritionLogSnapshotToExportFields({
          loggedFoodName: 'Oats',
          loggedCalories: 389,
          loggedProtein: 16.9,
          loggedCarbs: 66.3,
          loggedFat: 6.9,
          loggedFiber: 10.6,
          loggedMicros: { iron: 4.7 },
        })
      ).toEqual({
        logged_food_name: 'Oats',
        logged_calories: 389,
        logged_protein: 16.9,
        logged_carbs: 66.3,
        logged_fat: 6.9,
        logged_fiber: 10.6,
        logged_micros_json: '{"iron":4.7}',
        _decrypted: true,
      });
    });

    it('writes empty columns for an absent name and absent micros', () => {
      const fields = nutritionLogSnapshotToExportFields({
        loggedCalories: 0,
        loggedProtein: 0,
        loggedCarbs: 0,
        loggedFat: 0,
        loggedFiber: 0,
      });

      expect(fields.logged_food_name).toBe('');
      expect(fields.logged_micros_json).toBe('');
    });

    it('survives an export round trip back through the plain reader', () => {
      const snapshot: NutritionLogSnapshotPlain = {
        loggedFoodName: 'Oats',
        loggedCalories: 389,
        loggedProtein: 16.9,
        loggedCarbs: 66.3,
        loggedFat: 6.9,
        loggedFiber: 10.6,
        loggedMicros: { iron: 4.7 },
      };

      expect(
        readPlainNutritionLogSnapshotRow(nutritionLogSnapshotToExportFields(snapshot))
      ).toEqual(snapshot);
    });
  });

  describe('readSavedForLaterGroupNote', () => {
    it('decrypts a stored note', async () => {
      const note = await encryptOptionalString('Half portion, ate at Nonna’s');

      await expect(readSavedForLaterGroupNote({ note })).resolves.toBe(
        'Half portion, ate at Nonna’s'
      );
    });

    // Double-decrypting an export row would throw or return garbage, so the marker wins.
    it('returns an already-decrypted note verbatim without decrypting again', async () => {
      await expect(
        readSavedForLaterGroupNote({ note: 'Half portion', _decrypted: true })
      ).resolves.toBe('Half portion');
    });

    it('reads a missing note as an empty string in both modes', async () => {
      await expect(readSavedForLaterGroupNote({ _decrypted: true })).resolves.toBe('');
      await expect(readSavedForLaterGroupNote({})).resolves.toBe('');
    });
  });

  describe('encryptUserMetricFields', () => {
    it('encrypts a weight value and its unit', async () => {
      const fields = await encryptUserMetricFields({
        value: 82.4,
        unit: 'kg',
        date: 1_700_000_000,
      });

      expect(fields.value).not.toBe('82.4');
      expect(fields.unit).not.toBe('kg');
      await expect(decryptNumber(fields.value)).resolves.toBe(82.4);
      await expect(decryptOptionalString(fields.unit)).resolves.toBe('kg');
    });

    // The date is deliberately NOT returned: user_metrics.date stays plaintext so calendar-day
    // queries can run in SQL. Returning an encrypted date here would invite storing it.
    it('returns only value and unit, leaving the queryable date out entirely', async () => {
      const fields = await encryptUserMetricFields({ value: 82.4, date: 1_700_000_000 });

      expect(Object.keys(fields).sort()).toEqual(['unit', 'value']);
    });

    it('stores an empty unit column when no unit is supplied', async () => {
      const fields = await encryptUserMetricFields({ value: 21.5, date: 1_700_000_000 });

      expect(fields.unit).toBe('');
    });

    it('encrypts a 0 measurement rather than blanking it', async () => {
      const fields = await encryptUserMetricFields({ value: 0, unit: '%', date: 1_700_000_000 });

      expect(fields.value).not.toBe('');
      await expect(decryptNumber(fields.value)).resolves.toBe(0);
    });
  });
});
