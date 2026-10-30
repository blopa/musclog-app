import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync } from 'expo-sqlite';

import { createPreRestoreBackup } from '@/database/preMigrationBackup';
import { restoreDatabase } from '@/database/importDb';
import { restoreLegacyV1Database } from '@/database/legacyV1Import';
import { seedDatabaseContents } from '@/database/seeders/prod';
import { MigrationService } from '@/database/services/MigrationService';
import { SettingsService } from '@/database/services/SettingsService';
import { reloadApp } from '@/utils/app';

const mockSteps: string[] = [];
const mockSourceSql: string[] = [];

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    closeAsync: jest.fn(async () => {
      mockSteps.push('close source');
    }),
    execAsync: jest.fn(async (sql: string) => {
      mockSourceSql.push(sql);
    }),
    prepareAsync: jest.fn(async (sql: string) => ({
      executeAsync: jest.fn(async () => {
        mockSourceSql.push(sql);
      }),
      finalizeAsync: jest.fn(async () => {}),
    })),
    withTransactionAsync: async (task: () => Promise<void>) => {
      await task();
      mockSteps.push('load source');
    },
  })),
}));
jest.mock('@/database/database-instance', () => ({
  database: {
    get: () => ({
      query: () => ({ fetch: async () => [{ syncId: 'migrated-user' }] }),
    }),
    unsafeResetDatabase: jest.fn(async () => {
      mockSteps.push('reset');
    }),
    write: async (work: () => Promise<void>) => work(),
  },
}));
jest.mock('@/database/seeders/prod', () => ({
  seedDatabaseContents: jest.fn(async () => {
    mockSteps.push('seed + migrate');
    return { success: true };
  }),
}));
jest.mock('@/database/services/MigrationService', () => ({
  MigrationService: jest.fn(),
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getLanguage: jest.fn(async () => 'pt-BR'),
    getUnits: jest.fn(async () => 'imperial'),
    setLanguage: jest.fn(async () => {}),
    setUnits: jest.fn(async () => {}),
  },
}));
jest.mock('@/database/preMigrationBackup', () => ({
  createPreRestoreBackup: jest.fn(async () => {
    mockSteps.push('backup');
  }),
}));
jest.mock('@/database/dbReady', () => ({
  waitForBootMigrations: jest.fn(async () => {
    mockSteps.push('wait for boot migrations');
  }),
}));
jest.mock('@/database/dbDurability', () => ({ updateNutritionLogCountBaseline: jest.fn() }));
jest.mock('@/database/schemaToZod', () => ({ validateExportDump: jest.fn() }));
jest.mock('@/widgets/resetWidgets', () => ({ resetWidgets: jest.fn(async () => {}) }));
jest.mock('@/utils/app', () => ({ reloadApp: jest.fn(async () => {}) }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

const LEGACY_DUMP = {
  Exercise: [{ id: 1, name: 'Squat' }],
  User: [{ id: 1, name: 'Ana' }],
};

describe('restoreLegacyV1Database', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSteps.length = 0;
    mockSourceSql.length = 0;
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
      await AsyncStorage.multiRemove([...keys]);
    }

    await AsyncStorage.multiSet([
      ['currentUserSyncId', 'local-user'],
      ['onboardingCompleted', 'true'],
    ]);
  });

  // Loading the file is the step that can reject a bad backup, so it happens while the
  // current data is still intact; the recovery point is taken before the reset.
  it('loads the backup, then backs up, then resets and migrates', async () => {
    await restoreLegacyV1Database(LEGACY_DUMP);

    expect(mockSteps).toEqual([
      'load source',
      'wait for boot migrations',
      'backup',
      'reset',
      'seed + migrate',
      'close source',
    ]);
    expect(mockSourceSql).toContain('CREATE TABLE "Exercise" ("id", "deletedAt", "name");');
    expect(MigrationService).toHaveBeenCalledWith(
      expect.objectContaining({ valuesEncrypted: false })
    );
    expect(reloadApp).toHaveBeenCalled();
  });

  it('selects the migrated user and keeps the device units and language', async () => {
    await restoreLegacyV1Database(LEGACY_DUMP);

    expect(await AsyncStorage.getItem('currentUserSyncId')).toBe('migrated-user');
    expect(await AsyncStorage.getItem('onboardingCompleted')).toBe('true');
    expect(SettingsService.setUnits).toHaveBeenCalledWith('imperial');
    expect(SettingsService.setLanguage).toHaveBeenCalledWith('pt-BR');
  });

  it('fails loudly when the migration fails, without selecting a user or reloading', async () => {
    jest
      .mocked(seedDatabaseContents)
      .mockResolvedValueOnce({ error: 'bad rows', success: false } as never);

    await expect(restoreLegacyV1Database(LEGACY_DUMP)).rejects.toThrow('bad rows');

    expect(await AsyncStorage.getItem('currentUserSyncId')).toBe('local-user');
    expect(mockSteps).toContain('close source');
    expect(reloadApp).not.toHaveBeenCalled();
  });
});

describe('restoreDatabase with a 1.x backup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSteps.length = 0;
  });

  // A 1.x dump has none of the 2.0 tables, so the 2.0 validation would reject it.
  it('routes it to the 1.x import instead of the 2.0 validation', async () => {
    const { validateExportDump } = jest.requireMock('@/database/schemaToZod');

    await restoreDatabase(JSON.stringify(LEGACY_DUMP));

    expect(validateExportDump).not.toHaveBeenCalled();
    expect(openDatabaseAsync).toHaveBeenCalledWith(':memory:');
    expect(createPreRestoreBackup).toHaveBeenCalled();
  });

  // 1.x wrapped the file with the same CryptoJS AES call, so a 1.x passphrase opens it.
  it('opens a passphrase-protected 1.x backup', async () => {
    const { encrypt } = jest.requireActual('@/utils/encryption');
    const encrypted = await encrypt(JSON.stringify(LEGACY_DUMP), 'hunter2');

    await restoreDatabase(encrypted, 'hunter2');

    expect(openDatabaseAsync).toHaveBeenCalledWith(':memory:');
  });
});
