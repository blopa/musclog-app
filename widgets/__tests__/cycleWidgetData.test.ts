import { CycleRepository } from '@/database/repositories/CycleRepository';
import { buildCycleSnapshot } from '@/utils/cycle/cycleSnapshot';

import { loadCycleWidgetInputs } from '../cycleWidgetData';

let mockLockScopes: string[] = [];

jest.mock('@/database/database-instance', () => ({
  database: { withChangesForTables: jest.fn() },
}));
jest.mock('@/database/repositories/CycleRepository', () => ({
  CycleRepository: { cycles: jest.fn(), periods: jest.fn(), contexts: jest.fn() },
  readContexts: jest.fn(async () => []),
  readCycleConfig: jest.fn(async () => ({})),
  readPeriods: jest.fn(async () => []),
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn(async () => mockLockScopes) },
}));
jest.mock('@/constants/settingDefinitions', () => ({
  SETTINGS: { appLockScopes: { key: 'lock' } },
}));
jest.mock('@/utils/cycle/cycleSnapshot', () => ({
  buildCycleSnapshot: jest.fn(() => ({ timeline: { elapsedDay: 12 } })),
}));

const activeCycle = () => {
  (CycleRepository.cycles as jest.Mock).mockReturnValue({
    fetch: async () => [{ id: 'c1', isActive: true }],
  });
  (CycleRepository.periods as jest.Mock).mockReturnValue({ fetch: async () => [] });
  (CycleRepository.contexts as jest.Mock).mockReturnValue({ fetch: async () => [] });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLockScopes = [];
});

it.each([
  ['the cycle lock', ['cycle']],
  ['the whole-app lock', ['app']],
])('never reads the encrypted records under %s', async (_name, lockScopes) => {
  mockLockScopes = lockScopes;
  activeCycle();
  expect(await loadCycleWidgetInputs()).toEqual({ lockScopes, elapsedDay: null });
  expect(CycleRepository.cycles).not.toHaveBeenCalled();
});

it('reads the day count with no lock, without computing predictions', async () => {
  activeCycle();
  expect(await loadCycleWidgetInputs()).toEqual({ lockScopes: [], elapsedDay: 12 });
  expect(buildCycleSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ showPredictions: false, showFertility: false })
  );
});

it('reports no day when no cycle is active', async () => {
  (CycleRepository.cycles as jest.Mock).mockReturnValue({
    fetch: async () => [{ id: 'paused', isActive: false }],
  });
  expect(await loadCycleWidgetInputs()).toEqual({ lockScopes: [], elapsedDay: null });
  expect(buildCycleSnapshot).not.toHaveBeenCalled();
});
