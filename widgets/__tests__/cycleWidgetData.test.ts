import { CycleRepository } from '@/database/repositories/CycleRepository';
import { SettingsService } from '@/database/services/SettingsService';

import { loadCycleWidgetInputs } from '../cycleWidgetData';

let mockSettings: Record<string, unknown> = {};

jest.mock('@/database/database-instance', () => ({
  database: { withChangesForTables: jest.fn() },
}));
jest.mock('@/database/repositories/CycleRepository', () => ({
  CycleRepository: { cycles: jest.fn() },
  readContexts: jest.fn(),
  readCycleConfig: jest.fn(),
  readPeriods: jest.fn(),
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    get: jest.fn(async (definition: { key: string }) => mockSettings[definition.key]),
  },
}));
jest.mock('@/constants/settingDefinitions', () => ({
  SETTINGS: {
    appLockMode: { key: 'lock' },
    cycleNotificationStyle: { key: 'style' },
    cycleShowPredictions: { key: 'predictions' },
    cycleShowFertility: { key: 'fertility' },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = { lock: 'off', style: 'detailed' };
});

it.each([
  ['the default discreet style', { lock: 'off', style: 'discreet' }],
  ['the cycle lock', { lock: 'cycle', style: 'detailed' }],
  ['the whole-app lock', { lock: 'app', style: 'detailed' }],
])('never reads the encrypted records under %s', async (_name, settings) => {
  mockSettings = settings;
  const result = await loadCycleWidgetInputs();
  expect(result.cycle).toBeNull();
  expect(CycleRepository.cycles).not.toHaveBeenCalled();
});

it('reports no cycle when none is active', async () => {
  (CycleRepository.cycles as jest.Mock).mockReturnValue({
    fetch: async () => [{ id: 'paused', isActive: false }],
  });
  const result = await loadCycleWidgetInputs();
  expect(result).toEqual({ lockMode: 'off', style: 'detailed', cycle: null });
  expect(SettingsService.get).toHaveBeenCalled();
});
