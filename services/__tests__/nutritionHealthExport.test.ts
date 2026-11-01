import type NutritionLog from '@/database/models/NutritionLog';
import { decryptOptionalString } from '@/database/encryptionHelpers';
import { handleError } from '@/utils/handleError';

const mockFind = jest.fn();
const mockWrite = jest.fn();
const mockReplace = jest.fn();
const mockDelete = jest.fn();
const mockLoadState = jest.fn();
const mockRecordOwned = jest.fn();
const mockRecordTakeover = jest.fn();

jest.mock('@/database/database-instance', () => ({
  database: {
    get: () => ({ find: (...args: unknown[]) => mockFind(...args) }),
    write: (fn: unknown) => mockWrite(fn),
  },
}));
jest.mock('@/database/repositories/NutritionHealthRepository', () => ({
  NutritionHealthRepository: {
    loadState: (...args: unknown[]) => mockLoadState(...args),
    recordOwned: (...args: unknown[]) => mockRecordOwned(...args),
    recordTakeover: (...args: unknown[]) => mockRecordTakeover(...args),
  },
}));
jest.mock('@/database/encryptionHelpers', () => ({
  decryptOptionalString: jest.fn(async () => 'Rice'),
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
    loggedFoodNameRaw: 'encrypted-name',
    update: jest.fn(async (fn: (r: Record<string, unknown>) => void) => fn(log)),
    ...overrides,
  };
  return log as unknown as NutritionLog & { update: jest.Mock };
}

describe('nutritionHealthExport', () => {
  const originalOs = Platform.OS;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(decryptOptionalString).mockResolvedValue('Rice');
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    mockFind.mockResolvedValue({ source: 'user' });
    mockLoadState.mockResolvedValue({ ignoredRecordIds: new Set(), ownedLogIds: new Set() });
    mockWrite.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true });
  });

  it('exports the log as it is now and stores the returned id', async () => {
    mockReplace.mockResolvedValue({ status: 'written', externalId: 'hc-new' });
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
    mockReplace.mockResolvedValue({ status: 'written', externalId: 'hc-old' });
    const log = makeLog({ externalId: 'hc-old' });

    await exportLogToHealthPlatform(log, 'test');

    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ externalId: 'hc-old' }));
    expect(log.update).not.toHaveBeenCalled();
  });

  it('writes its own corrected copy of an imported log and ignores the original', async () => {
    mockFind.mockResolvedValue({ source: 'health_connect' });
    mockReplace.mockResolvedValue({ status: 'written', externalId: 'hc-own' });
    const log = makeLog({ externalId: 'hc-foreign' });

    await exportLogToHealthPlatform(log, 'test');

    // The other app's record is never replaced or deleted: no earlier id is passed.
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ externalId: undefined }));
    expect(mockRecordTakeover).toHaveBeenCalledWith('log-1', 'hc-foreign');
    expect(log.externalId).toBe('hc-own');
  });

  it('treats an imported log Musclog already took over as its own', async () => {
    mockFind.mockResolvedValue({ source: 'health_connect' });
    mockLoadState.mockResolvedValue({
      ignoredRecordIds: new Set(['hc-foreign']),
      ownedLogIds: new Set(['log-1']),
    });
    mockReplace.mockResolvedValue({ status: 'written', externalId: 'hc-own' });

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
      [
        { id: 'a', externalId: 'a' },
        { id: 'b', externalId: undefined },
        { id: 'c', externalId: 'b' },
      ],
      'test'
    );
    expect(mockDelete).toHaveBeenCalledWith(['a', 'b']);

    mockDelete.mockClear();
    await removeLogsFromHealthPlatform([{ id: 'a', externalId: undefined }], 'test');
    expect(mockDelete).not.toHaveBeenCalled();
  });
  it('persists ownership before a failed mirror, retaining the earlier id for retry', async () => {
    mockReplace.mockResolvedValue({ status: 'not-written' });
    const log = makeLog({ externalId: 'hc-old' });
    await exportLogToHealthPlatform(log, 'test');
    expect(mockRecordOwned).toHaveBeenCalledWith('log-1');
    expect(mockRecordOwned.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0]
    );
    expect(log.externalId).toBe('hc-old');
    expect(log.update).not.toHaveBeenCalled();
  });

  it('keeps a failed takeover authoritative and never replaces its foreign original on retry', async () => {
    mockFind.mockResolvedValue({ source: 'health_connect' });
    mockReplace.mockResolvedValueOnce({ status: 'not-written' });
    const log = makeLog({ externalId: 'hc-foreign' });
    await exportLogToHealthPlatform(log, 'test');
    expect(mockRecordTakeover).toHaveBeenCalledWith('log-1', 'hc-foreign');
    expect(mockRecordTakeover.mock.invocationCallOrder[0]).toBeLessThan(
      mockReplace.mock.invocationCallOrder[0]
    );

    mockLoadState.mockResolvedValue({
      ownedLogIds: new Set(['log-1']),
      ignoredRecordIds: new Set(['hc-foreign']),
    });
    mockReplace.mockResolvedValueOnce({ status: 'written', externalId: 'hc-own' });
    await exportLogToHealthPlatform(log, 'test');
    expect(mockReplace).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ externalId: undefined })
    );
    expect(log.externalId).toBe('hc-own');
  });

  it('does not touch the platform when ownership cannot be committed', async () => {
    mockRecordOwned.mockRejectedValue(new Error('database unavailable'));
    await expect(exportLogToHealthPlatform(makeLog(), 'test')).resolves.toBeUndefined();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('removes an untracked mirror when storing its id fails, then allows a retry', async () => {
    const error = new Error('id commit failed');
    mockReplace.mockResolvedValueOnce({ status: 'written', externalId: 'hc-untracked' });
    mockWrite.mockRejectedValueOnce(error);
    const log = makeLog({ externalId: 'hc-old' });

    await expect(exportLogToHealthPlatform(log, 'test')).resolves.toBeUndefined();

    expect(mockDelete).toHaveBeenCalledWith(['hc-untracked']);
    expect(handleError).toHaveBeenCalledWith(error, 'test');
    expect(mockRecordOwned).toHaveBeenCalledWith('log-1');
    expect(log.externalId).toBe('hc-old');

    mockLoadState.mockResolvedValue({
      ownedLogIds: new Set(['log-1']),
      ignoredRecordIds: new Set(),
    });
    mockReplace.mockResolvedValueOnce({ status: 'written', externalId: 'hc-retry' });
    await exportLogToHealthPlatform(log, 'test');

    expect(log.externalId).toBe('hc-retry');
    expect(mockReplace).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ externalId: 'hc-old' })
    );
  });

  it('keeps takeover facts and preserves the foreign original after an id commit failure', async () => {
    const ownedLogIds = new Set<string>();
    const ignoredRecordIds = new Set<string>();
    mockLoadState.mockImplementation(async () => ({ ownedLogIds, ignoredRecordIds }));
    mockRecordTakeover.mockImplementation(async (logId: string, originalId: string) => {
      ownedLogIds.add(logId);
      ignoredRecordIds.add(originalId);
    });
    mockFind.mockResolvedValue({ source: 'health_connect' });
    mockReplace.mockResolvedValueOnce({ status: 'written', externalId: 'hc-untracked' });
    mockWrite.mockRejectedValueOnce(new Error('id commit failed'));
    const log = makeLog({ externalId: 'hc-foreign' });

    await exportLogToHealthPlatform(log, 'test');

    expect(mockDelete).toHaveBeenCalledWith(['hc-untracked']);
    expect(ownedLogIds.has(log.id)).toBe(true);
    expect(ignoredRecordIds.has('hc-foreign')).toBe(true);
    expect(log.externalId).toBe('hc-foreign');

    mockReplace.mockResolvedValueOnce({ status: 'written', externalId: 'hc-retry' });
    await exportLogToHealthPlatform(log, 'test');

    expect(mockReplace).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ externalId: undefined })
    );
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(log.externalId).toBe('hc-retry');
  });

  it('reports the id commit failure even when compensating cleanup also rejects', async () => {
    const error = new Error('id commit failed');
    const cleanupError = new Error('cleanup failed');
    mockReplace.mockResolvedValue({ status: 'written', externalId: 'hc-untracked' });
    mockWrite.mockRejectedValueOnce(error);
    mockDelete.mockRejectedValueOnce(cleanupError);

    await expect(exportLogToHealthPlatform(makeLog(), 'test')).resolves.toBeUndefined();

    expect(handleError).toHaveBeenCalledWith(cleanupError, 'test.cleanupUntrackedMirror');
    expect(handleError).toHaveBeenCalledWith(error, 'test');
  });

  it('serializes two replacements of one log using the latest returned id', async () => {
    let finishFirst!: (result: { status: 'written'; externalId: string }) => void;
    const started = new Promise<void>((resolve) => {
      mockReplace.mockImplementationOnce(() => {
        resolve();
        return new Promise((complete) => {
          finishFirst = complete;
        });
      });
    });
    mockReplace.mockResolvedValueOnce({ status: 'written', externalId: 'hc-second' });
    const log = makeLog({ externalId: 'hc-old' });
    const first = exportLogToHealthPlatform(log, 'test');
    await started;
    const second = exportLogToHealthPlatform(log, 'test');
    expect(mockReplace).toHaveBeenCalledTimes(1);
    finishFirst({ status: 'written', externalId: 'hc-first' });
    await Promise.all([first, second]);
    expect(mockReplace).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ externalId: 'hc-first' })
    );
    expect(log.externalId).toBe('hc-second');
  });

  it('waits for an in-flight export before deleting its resulting platform record', async () => {
    let finish!: (result: { status: 'written'; externalId: string }) => void;
    const started = new Promise<void>((resolve) => {
      mockReplace.mockImplementationOnce(() => {
        resolve();
        return new Promise((complete) => {
          finish = complete;
        });
      });
    });
    const log = makeLog({ externalId: 'hc-old' });
    const exporting = exportLogToHealthPlatform(log, 'test');
    await started;
    const removing = removeLogsFromHealthPlatform([log], 'test');
    expect(mockDelete).not.toHaveBeenCalled();
    finish({ status: 'written', externalId: 'hc-new' });
    await Promise.all([exporting, removing]);
    expect(mockDelete).toHaveBeenCalledWith(['hc-new']);
  });
});
