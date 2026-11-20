import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { restoreDatabase } from '@/database/importDb';
import { prepareLocalCreateFromRaw } from '@/database/prepareLocalCreateFromRaw';

jest.mock('@/widgets/resetWidgets', () => ({ resetWidgets: jest.fn(async () => {}) }));
jest.mock('@/database/database-instance', () => ({
  database: {
    adapter: {},
    batch: jest.fn(async () => {}),
    get: () => ({
      prepareCreate: (build: (record: Record<string, unknown>) => void) => {
        const record: Record<string, unknown> = { _raw: {} };
        build(record);
        return record;
      },
      query: () => ({ fetch: async () => [] }),
    }),
    unsafeResetDatabase: jest.fn(async () => {}),
    write: async (work: () => Promise<void>) => work(),
  },
}));
jest.mock('@/database/schemaToZod', () => ({
  validateExportDump: (data: unknown) => ({ data, success: true }),
}));
jest.mock('@/database/prepareLocalCreateFromRaw', () => ({
  prepareLocalCreateFromRaw: jest.fn(() => ({})),
}));
jest.mock('@/database/preMigrationBackup', () => ({
  createPreRestoreBackup: jest.fn(async () => {}),
}));
jest.mock('@/database/dbDurability', () => ({ updateNutritionLogCountBaseline: jest.fn() }));
jest.mock('@/database/dbReady', () => ({ waitForBootMigrations: jest.fn(async () => {}) }));
jest.mock('@/database/services/AppExerciseCatalogueService', () => ({
  AppExerciseCatalogueService: { sync: jest.fn(async () => {}) },
}));
jest.mock('@/database/services/ExerciseService', () => ({
  ExerciseService: { backfillExerciseSources: jest.fn(async () => {}) },
}));
jest.mock('@/database/services/FoodPortionService', () => ({
  FoodPortionService: { backfillPortionSources: jest.fn(async () => {}) },
}));
jest.mock('@/database/services/MuscleService', () => ({
  MuscleService: {
    backfillExerciseMuscles: jest.fn(async () => {}),
    seedMuscles: jest.fn(async () => ({})),
  },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { setUseMusclogFreeTier: jest.fn(async () => {}) },
}));
jest.mock('@/utils/app', () => ({ reloadApp: jest.fn(async () => {}) }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/utils/musclogGatewayAvailability', () => ({ isMusclogGatewayAvailable: () => true }));

const DUMP = JSON.stringify({
  _async_storage_: {},
  _exportPlatform: 'android',
  _exportVersion: 26,
  settings: [
    { id: 'hosted-1', type: 'use_hosted_ai', value: 'true' },
    { id: 'claude-1', type: 'enable_claude', value: 'true' },
  ],
});

describe('restoreDatabase and use_hosted_ai', () => {
  it('never restores a use_hosted_ai row, but keeps other settings', async () => {
    await restoreDatabase(DUMP);

    const restoredTypes = jest
      .mocked(prepareLocalCreateFromRaw)
      .mock.calls.map((call) => (call[1] as { type?: string }).type);
    expect(restoredTypes).not.toContain('use_hosted_ai');
    expect(restoredTypes).toContain('enable_claude');
  });

  it('calls the restore guard in the settings branch of importDb', () => {
    const source = readFileSync(join(__dirname, '..', 'importDb.ts'), 'utf8').replace(/\s+/g, ' ');
    expect(source).toContain('isRestoreForcedOffSetting');
    expect(source).toContain(
      "tableName === 'settings' && isRestoreForcedOffSetting(String(raw.type))"
    );
  });
});
