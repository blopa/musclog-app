import type NutritionLog from '@/database/models/NutritionLog';

const mockFind = jest.fn();
const mockWrite = jest.fn();
const mockReplace = jest.fn();
const mockDelete = jest.fn();
const mockGetSetting = jest.fn();
const mockRecordTakeover = jest.fn();

jest.mock('@/database/database-instance', () => ({
  database: {
    get: () => ({ find: (...args: unknown[]) => mockFind(...args) }),
    write: (fn: unknown) => mockWrite(fn),
  },
}));
jest.mock('@/database/services/SettingsService', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGetSetting(...args),
    recordHealthTakeover: (...args: unknown[]) => mockRecordTakeover(...args),
  },
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('../healthConnectNutrition', () => ({
  replaceNutritionLogInHealthConnect: (...args: unknown[]) => mockReplace(...args),
  deleteNutritionLogsFromHealthConnect: (...args: unknown[]) => mockDelete(...args),
}));

import { Platform } from 'react-native';

import { exportLogToHealthPlatform, removeLogsFromHealthPlatform } from '../nutritionHealthExport';

function makeLog(overrides: Record<string, unknown> = {}) {
  const log = {
    id: 'log-1',
    foodId: 'food-1',
    date: 1_700_000_000_000,
    type: 'lunch',
    externalId: undefined as string | undefined,
    getNutrients: async () => ({ calories: 300, protein: 20, carbs: 30, fat: 10, fiber: 5 }),
    getDecryptedSnapshot: async () => ({ loggedFoodName: 'Rice' }),
    update: jest.fn(async (fn: (r: Record<string, unknown>) => void) => fn(log)),
    ...overrides,
  };
  return log as unknown as NutritionLog & { update: jest.Mock };
}

describe('nutritionHealthExport', () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    mockFind.mockResolvedValue({ source: 'user' });
    mockGetSetting.mockResolvedValue({ ignoredRecordIds: [], ownedLogIds: [] });
    mockWrite.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true });
  });

  it('exports the log as it is now and stores the returned id', async () => {
    mockReplace.mockResolvedValue('hc-new');
    const log = makeLog();

    await exportLogToHealthPlatform(log, 'test');

    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        logId: 'log-1',
        date: 1_700_000_000_000,
        mealType: 'lunch',
        foodName: 'Rice',
        calories: 300,
      })
    );
    expect(log.externalId).toBe('hc-new');
  });

  it('passes the earlier record id so an edit replaces it', async () => {
    mockReplace.mockResolvedValue('hc-old');
    const log = makeLog({ externalId: 'hc-old' });

    await exportLogToHealthPlatform(log, 'test');

    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ externalId: 'hc-old' }));
    expect(log.update).not.toHaveBeenCalled();
  });

  it('writes its own corrected copy of an imported log and ignores the original', async () => {
    mockFind.mockResolvedValue({ source: 'health_connect' });
    mockReplace.mockResolvedValue('hc-own');
    const log = makeLog({ externalId: 'hc-foreign' });

    await exportLogToHealthPlatform(log, 'test');

    // The other app's record is never replaced or deleted: no earlier id is passed.
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ externalId: undefined }));
    expect(mockRecordTakeover).toHaveBeenCalledWith('log-1', 'hc-foreign');
    expect(log.externalId).toBe('hc-own');
  });

  it('treats an imported log Musclog already took over as its own', async () => {
    mockFind.mockResolvedValue({ source: 'health_connect' });
    mockGetSetting.mockResolvedValue({ ignoredRecordIds: ['hc-foreign'], ownedLogIds: ['log-1'] });
    mockReplace.mockResolvedValue('hc-own');

    await exportLogToHealthPlatform(makeLog({ externalId: 'hc-own' }), 'test');

    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ externalId: 'hc-own' }));
    expect(mockRecordTakeover).not.toHaveBeenCalled();
  });

  it('does nothing on web and swallows platform failures', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    await exportLogToHealthPlatform(makeLog(), 'test');
    expect(mockReplace).not.toHaveBeenCalled();

    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    mockReplace.mockRejectedValue(new Error('boom'));
    await expect(exportLogToHealthPlatform(makeLog(), 'test')).resolves.toBeUndefined();
  });

  it('removes only logs that were exported', async () => {
    await removeLogsFromHealthPlatform(
      [{ externalId: 'a' }, { externalId: undefined }, { externalId: 'b' }],
      'test'
    );
    expect(mockDelete).toHaveBeenCalledWith(['a', 'b']);

    mockDelete.mockClear();
    await removeLogsFromHealthPlatform([{ externalId: undefined }], 'test');
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
