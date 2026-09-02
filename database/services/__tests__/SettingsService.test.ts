import {
  ENABLE_FASTED_DAY_SETTING_TYPE,
  NAV_SLOT_1_SETTING_TYPE,
  NAV_SLOT_2_SETTING_TYPE,
  NAV_SLOT_3_SETTING_TYPE,
  OPENAI_API_KEY_SETTING_TYPE,
  REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE,
  SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE,
  THEME_SETTING_TYPE,
  UNITS_SETTING_TYPE,
} from '@/constants/settings';
import { database } from '@/database/database-instance';
import { SettingsService } from '@/database/services/SettingsService';
import { decryptDatabaseValue } from '@/utils/encryption';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(async (callback: () => Promise<void>) => callback()),
  },
}));

// Reversible stand-ins for the real AES helpers: `encryptOptionalString` produces a
// value that only `decryptDatabaseValue` can read back, and decryption of anything
// that was never encrypted returns '' — exactly the contract the legacy-plaintext
// fallback and the boot migration branch on.
jest.mock('@/database/encryptionHelpers', () => ({
  encryptOptionalString: jest.fn(async (value: string | null | undefined) =>
    value && String(value).trim() ? `enc(${String(value).trim()})` : ''
  ),
}));

jest.mock('@/utils/encryption', () => ({
  decryptDatabaseValue: jest.fn(async (cipher: string | undefined) => {
    const match = /^enc\((.*)\)$/.exec(cipher ?? '');
    return match ? match[1] : '';
  }),
}));

jest.mock('@/utils/units', () => ({ getDefaultUnits: jest.fn(() => 'metric') }));

type SettingRow = {
  id: string;
  type: string;
  value: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  update: (callback: (row: SettingRow) => void) => Promise<void>;
};

const mockDatabase = database as jest.Mocked<typeof database>;

/**
 * A minimal in-memory `settings` table so get/set round-trips exercise the real
 * upsert logic rather than a chain of assertion-only mocks.
 */
function installSettingsTable(seed: Partial<SettingRow>[] = []) {
  const rows: SettingRow[] = [];
  let nextId = 1;

  const makeRow = (fields: Partial<SettingRow>): SettingRow => {
    const row: SettingRow = {
      id: fields.id ?? `setting-${nextId++}`,
      type: fields.type ?? '',
      value: fields.value ?? '',
      createdAt: fields.createdAt ?? 0,
      updatedAt: fields.updatedAt ?? 0,
      deletedAt: fields.deletedAt ?? null,
      update: async (callback) => {
        callback(row);
      },
    };
    return row;
  };

  for (const fields of seed) {
    rows.push(makeRow(fields));
  }

  const collection = {
    query: (...clauses: { field: string; condition: unknown }[]) => ({
      fetch: async () => {
        const typeClause = clauses.find((clause) => clause.field === 'type');
        return rows.filter(
          (row) => row.deletedAt == null && (!typeClause || row.type === typeClause.condition)
        );
      },
    }),
    create: async (callback: (row: SettingRow) => void) => {
      const row = makeRow({});
      callback(row);
      rows.push(row);
      return row;
    },
  };

  mockDatabase.get.mockReturnValue(collection as any);
  return rows;
}

const valuesFor = (rows: SettingRow[], type: string) =>
  rows.filter((row) => row.type === type && row.deletedAt == null).map((row) => row.value);

describe('SettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockDatabase.write as jest.Mock).mockImplementation(async (callback: () => Promise<void>) =>
      callback()
    );
  });

  describe('units', () => {
    it('stores metric/imperial as the "0"/"1" flag the schema expects and reads it back', async () => {
      const rows = installSettingsTable();

      await SettingsService.setUnits('imperial');
      expect(valuesFor(rows, UNITS_SETTING_TYPE)).toEqual(['1']);
      expect(await SettingsService.getUnits()).toBe('imperial');

      await SettingsService.setUnits('metric');
      expect(valuesFor(rows, UNITS_SETTING_TYPE)).toEqual(['0']);
      expect(await SettingsService.getUnits()).toBe('metric');
    });

    it('upserts rather than appending a second row on every change', async () => {
      const rows = installSettingsTable();

      await SettingsService.setUnits('imperial');
      await SettingsService.setUnits('metric');

      expect(rows.filter((row) => row.type === UNITS_SETTING_TYPE)).toHaveLength(1);
    });

    it('falls back to the device-derived default when the user never chose', async () => {
      installSettingsTable();

      expect(await SettingsService.getUnits()).toBe('metric');
    });
  });

  describe('typed accessors', () => {
    // The fasting-day feature is opt-in: every calc site keeps its legacy behaviour
    // until the user turns it on, so the unset default must be false.
    it('defaults the fasting-day feature to off', async () => {
      installSettingsTable();

      expect(await SettingsService.getEnableFastedDay()).toBe(false);
    });

    it('round-trips a boolean through the string column', async () => {
      const rows = installSettingsTable();

      await SettingsService.setEnableFastedDay(true);

      expect(valuesFor(rows, ENABLE_FASTED_DAY_SETTING_TYPE)).toEqual(['true']);
      expect(await SettingsService.getEnableFastedDay()).toBe(true);

      await SettingsService.setEnableFastedDay(false);
      expect(await SettingsService.getEnableFastedDay()).toBe(false);
    });

    it('keeps opt-out defaults true when unset (foundation foods)', async () => {
      installSettingsTable();

      expect(await SettingsService.getSendFoundationFoodsToLlm()).toBe(true);
    });

    it('reads the most recently updated row when duplicates exist', async () => {
      installSettingsTable([
        { type: ENABLE_FASTED_DAY_SETTING_TYPE, value: 'false', updatedAt: 100 },
        { type: ENABLE_FASTED_DAY_SETTING_TYPE, value: 'true', updatedAt: 200 },
      ]);

      expect(await SettingsService.getEnableFastedDay()).toBe(true);
    });

    it('collapses duplicate rows on write, keeping the newest and soft-deleting the rest', async () => {
      const rows = installSettingsTable([
        { id: 'stale', type: ENABLE_FASTED_DAY_SETTING_TYPE, value: 'false', updatedAt: 100 },
        { id: 'newest', type: ENABLE_FASTED_DAY_SETTING_TYPE, value: 'false', updatedAt: 200 },
      ]);

      await SettingsService.setEnableFastedDay(true);

      expect(rows.find((row) => row.id === 'stale')?.deletedAt).not.toBeNull();
      expect(valuesFor(rows, ENABLE_FASTED_DAY_SETTING_TYPE)).toEqual(['true']);
      expect(await SettingsService.getEnableFastedDay()).toBe(true);
    });

    it('round-trips the theme preference and defaults to "system"', async () => {
      const rows = installSettingsTable();

      expect(await SettingsService.getThemePreference()).toBe('system');

      await SettingsService.setTheme('kinetic-shock');

      expect(valuesFor(rows, THEME_SETTING_TYPE)).toEqual(['kinetic-shock']);
      expect(await SettingsService.getThemePreference()).toBe('kinetic-shock');
    });

    it('maps legacy dark and light preferences to their named Kinetic themes', async () => {
      installSettingsTable([{ type: THEME_SETTING_TYPE, value: 'dark', updatedAt: 1 }]);

      expect(await SettingsService.getThemePreference()).toBe('kinetic-depth');

      installSettingsTable([{ type: THEME_SETTING_TYPE, value: 'light', updatedAt: 1 }]);

      expect(await SettingsService.getThemePreference()).toBe('kinetic-light');
    });

    it('returns null for the last water prompt day when unset or unparseable', async () => {
      installSettingsTable([
        { type: 'last_home_water_prompt_answered_day', value: 'not-a-number', updatedAt: 1 },
      ]);

      expect(await SettingsService.getLastHomeWaterPromptAnsweredDay()).toBeNull();
    });

    it('round-trips the last water prompt day as a number', async () => {
      installSettingsTable();

      await SettingsService.setLastHomeWaterPromptAnsweredDay(1_700_000_000_000);

      expect(await SettingsService.getLastHomeWaterPromptAnsweredDay()).toBe(1_700_000_000_000);
    });
  });

  describe('nav slots', () => {
    it('defaults each slot to its own destination', async () => {
      installSettingsTable();

      expect(await SettingsService.getNavSlot(1)).toBe('workouts');
      expect(await SettingsService.getNavSlot(2)).toBe('food');
      expect(await SettingsService.getNavSlot(3)).toBe('profile');
    });

    it('writes each slot to its own setting type', async () => {
      const rows = installSettingsTable();

      await SettingsService.setNavSlot(1, 'notes');
      await SettingsService.setNavSlot(3, 'progress');

      expect(valuesFor(rows, NAV_SLOT_1_SETTING_TYPE)).toEqual(['notes']);
      expect(valuesFor(rows, NAV_SLOT_3_SETTING_TYPE)).toEqual(['progress']);
      expect(await SettingsService.getNavSlot(2)).toBe('food');
    });

    // A two-write swap would briefly leave the nav bar showing the same destination twice.
    it('swaps two slots inside a single write block', async () => {
      const rows = installSettingsTable([
        { type: NAV_SLOT_1_SETTING_TYPE, value: 'workouts', updatedAt: 1 },
        { type: NAV_SLOT_2_SETTING_TYPE, value: 'food', updatedAt: 1 },
      ]);

      await SettingsService.swapNavSlots(1, 'food', 2, 'workouts');

      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(valuesFor(rows, NAV_SLOT_1_SETTING_TYPE)).toEqual(['food']);
      expect(valuesFor(rows, NAV_SLOT_2_SETTING_TYPE)).toEqual(['workouts']);
    });
  });

  describe('coach quick settings', () => {
    it('persists every field in one write so a partial update is impossible', async () => {
      const rows = installSettingsTable();

      await SettingsService.setCoachQuickSettings({
        useThinkingMode: true,
        sendFoundationFoodsToLlm: false,
        nutritionLogHistoryDays: '30',
        workoutHistoryDays: '7',
        useOcrBeforeAi: true,
      });

      expect(mockDatabase.write).toHaveBeenCalledTimes(1);
      expect(rows).toHaveLength(5);
      expect(await SettingsService.getUseThinkingMode()).toBe(true);
      expect(await SettingsService.getSendFoundationFoodsToLlm()).toBe(false);
      expect(await SettingsService.getNutritionLogHistoryDays()).toBe('30');
      expect(await SettingsService.getWorkoutHistoryDays()).toBe('7');
    });

    it('leaves the OCR setting untouched when the caller omits it', async () => {
      const rows = installSettingsTable();

      await SettingsService.setCoachQuickSettings({
        useThinkingMode: false,
        sendFoundationFoodsToLlm: true,
        nutritionLogHistoryDays: 'none',
        workoutHistoryDays: 'none',
      });

      expect(rows).toHaveLength(4);
      expect(rows.some((row) => row.type === 'use_ocr_before_ai')).toBe(false);
    });
  });

  describe('encrypted API keys', () => {
    it('never stores an API key in plaintext, and decrypts it on read', async () => {
      const rows = installSettingsTable();

      await SettingsService.setOpenAiApiKey('sk-secret');

      expect(valuesFor(rows, OPENAI_API_KEY_SETTING_TYPE)).toEqual(['enc(sk-secret)']);
      expect(await SettingsService.getOpenAiApiKey()).toBe('sk-secret');
    });

    it('falls back to the raw value for legacy plaintext rows written before encryption', async () => {
      installSettingsTable([
        { type: OPENAI_API_KEY_SETTING_TYPE, value: 'sk-legacy-plaintext', updatedAt: 1 },
      ]);

      expect(await SettingsService.getOpenAiApiKey()).toBe('sk-legacy-plaintext');
    });

    it('returns an empty string without attempting decryption when no key is stored', async () => {
      installSettingsTable();

      expect(await SettingsService.getOpenAiApiKey()).toBe('');
      expect(decryptDatabaseValue).not.toHaveBeenCalled();
    });
  });

  describe('migrateApiKeysToEncrypted', () => {
    it('re-saves a legacy plaintext key as ciphertext', async () => {
      const rows = installSettingsTable([
        { type: OPENAI_API_KEY_SETTING_TYPE, value: 'sk-legacy', updatedAt: 1 },
      ]);

      await SettingsService.migrateApiKeysToEncrypted();

      expect(valuesFor(rows, OPENAI_API_KEY_SETTING_TYPE)).toEqual(['enc(sk-legacy)']);
      expect(await SettingsService.getOpenAiApiKey()).toBe('sk-legacy');
    });

    // The migration is registered as a runOnce boot step, but it still has to be
    // idempotent: a second pass must not double-encrypt an already-migrated key.
    it('leaves an already-encrypted key untouched', async () => {
      const rows = installSettingsTable([
        { type: OPENAI_API_KEY_SETTING_TYPE, value: 'enc(sk-live)', updatedAt: 1 },
      ]);

      await SettingsService.migrateApiKeysToEncrypted();
      await SettingsService.migrateApiKeysToEncrypted();

      expect(valuesFor(rows, OPENAI_API_KEY_SETTING_TYPE)).toEqual(['enc(sk-live)']);
      expect(mockDatabase.write).not.toHaveBeenCalled();
    });

    it('opens no write at all when no keys are configured', async () => {
      installSettingsTable();

      await SettingsService.migrateApiKeysToEncrypted();

      expect(mockDatabase.write).not.toHaveBeenCalled();
      expect(decryptDatabaseValue).not.toHaveBeenCalled();
    });
  });

  describe('migrateRequireExportEncryptionDefault', () => {
    it('turns the setting on for users who never configured it', async () => {
      const rows = installSettingsTable();

      await SettingsService.migrateRequireExportEncryptionDefault();

      expect(valuesFor(rows, REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE)).toEqual(['true']);
    });

    // Safe to call on every boot: an explicit opt-out must survive the next launch.
    it('does not resurrect the default over an explicit opt-out', async () => {
      const rows = installSettingsTable([
        { type: REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE, value: 'false', updatedAt: 1 },
      ]);

      await SettingsService.migrateRequireExportEncryptionDefault();

      expect(valuesFor(rows, REQUIRE_EXPORT_ENCRYPTION_SETTING_TYPE)).toEqual(['false']);
      expect(mockDatabase.write).not.toHaveBeenCalled();
      expect(await SettingsService.getRequireExportEncryption()).toBe(false);
    });
  });

  describe('setSettingValues deduplication', () => {
    it('collapses repeated types in one batch to the last value, writing a single row', async () => {
      const rows = installSettingsTable();

      await SettingsService.setCoachQuickSettings({
        useThinkingMode: true,
        sendFoundationFoodsToLlm: true,
        nutritionLogHistoryDays: '7',
        workoutHistoryDays: '7',
      });

      expect(valuesFor(rows, SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE)).toEqual(['true']);
      expect(
        rows.filter((row) => row.type === SEND_FOUNDATION_FOODS_TO_LLM_SETTING_TYPE)
      ).toHaveLength(1);
    });
  });
});
