const mockGetCollection = jest.fn();
const mockLoadOwnership = jest.fn();
const mockClassifyRecord = jest.fn();
const mockCheckAvailability = jest.fn();
const mockHasPermission = jest.fn();
const mockInsertRecords = jest.fn();
const mockReadRecords = jest.fn();
const mockDeleteRecords = jest.fn();

jest.mock('react-native-health-connect', () => ({
  RecordingMethod: { RECORDING_METHOD_MANUAL_ENTRY: 3 },
}));
jest.mock('@/database', () => ({
  database: {
    get: (...args: unknown[]) => mockGetCollection(...args),
    write: async (run: () => Promise<unknown>) => run(),
  },
}));
jest.mock('@/database/database-instance', () => ({
  database: {
    get: (...args: unknown[]) => mockGetCollection(...args),
    write: async (run: () => Promise<unknown>) => run(),
  },
}));
jest.mock('@/database/encryptionHelpers', () => ({ encryptNutritionLogSnapshot: jest.fn() }));
jest.mock('@/database/services/FoodPortionService', () => ({ FoodPortionService: {} }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('../healthConnectErrors', () => ({ RETRY_CONFIG: { maxAttempts: 1 } }));
jest.mock('../healthDataTransform', () => ({
  TimestampConverter: { unixToIso: (timestamp: number) => new Date(timestamp).toISOString() },
}));
jest.mock('../healthConnect', () => ({
  healthConnectService: {
    checkAvailability: (...args: unknown[]) => mockCheckAvailability(...args),
    hasPermissionForRecordType: (...args: unknown[]) => mockHasPermission(...args),
    insertRecords: (...args: unknown[]) => mockInsertRecords(...args),
    readRecords: (...args: unknown[]) => mockReadRecords(...args),
    deleteRecordsByUuids: (...args: unknown[]) => mockDeleteRecords(...args),
  },
}));
jest.mock('../nutritionHealthOwnership', () => ({
  classifyHealthRecord: (...args: unknown[]) => mockClassifyRecord(...args),
  reconcileOwnedRecord: async (...args: unknown[]) => mockClassifyRecord(...args),
  loadOwnershipContext: (...args: unknown[]) => mockLoadOwnership(...args),
}));

import type { NutritionWriteParams } from '../healthConnectNutrition';

// Jest's React Native preset prefers the iOS sibling; explicitly exercise the Android adapter.
const { writeNutritionLogToHealthConnect, syncNutritionFromHealthConnect } = jest.requireActual<
  typeof import('../healthConnectNutrition')
>('../healthConnectNutrition.ts');

const params: NutritionWriteParams & { externalId: string } = {
  logId: 'log-1',
  externalId: 'old-record',
  date: Date.parse('2026-11-01T12:00:00Z'),
  mealType: 'lunch',
  foodName: 'Rice',
  calories: 300,
  protein: 20,
  carbs: 30,
  fat: 10,
  fiber: 5,
};

function queriedRows(rows: unknown[]) {
  return { query: () => ({ fetch: async () => rows }) };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockGetCollection.mockImplementation(() => queriedRows([{ value: 'true' }]));
  mockCheckAvailability.mockResolvedValue(true);
  mockHasPermission.mockResolvedValue(true);
  mockInsertRecords.mockResolvedValue(['new-record']);
  mockDeleteRecords.mockResolvedValue(undefined);
});

describe('Android nutrition replacement', () => {
  it('returns the platform id after writing with the same client record identity', async () => {
    await expect(writeNutritionLogToHealthConnect(params)).resolves.toEqual({
      status: 'written',
      externalId: 'new-record',
    });

    expect(mockHasPermission).toHaveBeenCalledWith('Nutrition', 'write');
    expect(mockInsertRecords).toHaveBeenCalledWith([
      expect.objectContaining({
        recordType: 'Nutrition',
        startTime: '2026-11-01T12:00:00.000Z',
        endTime: '2026-11-01T12:00:00.001Z',
        metadata: expect.objectContaining({ clientRecordId: 'log-1' }),
      }),
    ]);
    expect(mockDeleteRecords).not.toHaveBeenCalled();
  });

  it.each(['unavailable platform', 'denied permission', 'disabled writing'])(
    'reports not-written without inserting when %s',
    async (reason) => {
      if (reason === 'unavailable platform') {
        mockCheckAvailability.mockResolvedValue(false);
      } else if (reason === 'denied permission') {
        mockHasPermission.mockResolvedValue(false);
      } else {
        mockGetCollection.mockImplementation(() => queriedRows([{ value: 'false' }]));
      }

      await expect(writeNutritionLogToHealthConnect(params)).resolves.toEqual({
        status: 'not-written',
      });
      expect(mockInsertRecords).not.toHaveBeenCalled();
      expect(mockDeleteRecords).not.toHaveBeenCalled();
    }
  );
});

describe('Android nutrition pull deletion policy', () => {
  it('preserves missing locally owned logs and newer export ids while deleting missing foreign imports', async () => {
    const makeLog = (id: string, externalId: string) => {
      const record = { id, externalId, createdAt: 1, deletedAt: undefined as number | undefined };
      return Object.assign(record, {
        update: jest.fn(async (apply: (log: typeof record) => void) => apply(record)),
      });
    };
    const present = makeLog('present', 'newer-export-id');
    const missingOwn = makeLog('log-1', 'old-record');
    const missingForeign = makeLog('foreign', 'foreign-record');
    const localLogs = [present, missingOwn, missingForeign];
    mockGetCollection.mockImplementation((table: string) => {
      if (table === 'nutrition_logs') {
        return queriedRows(localLogs);
      }

      if (table === 'foods') {
        return queriedRows([{ id: 'sentinel' }]);
      }

      return queriedRows([{ value: 'true' }]);
    });
    mockReadRecords.mockResolvedValue({
      records: [
        {
          metadata: { id: 'present-record', clientRecordId: 'present' },
          startTime: '2026-11-01T12:00:00Z',
        },
      ],
    });
    mockLoadOwnership.mockResolvedValue({
      ownLogs: new Map([['present', present]]),
      ownedLogIds: new Set(['present', 'log-1']),
      tombstonedExternalIds: new Set(),
      ignoredRecordIds: new Set(),
    });
    mockClassifyRecord.mockReturnValue('adopt');

    const counts = await syncNutritionFromHealthConnect(
      { startTime: params.date - 86_400_000, endTime: params.date + 86_400_000 },
      { retryAttempts: 1 }
    );

    expect(mockLoadOwnership).toHaveBeenCalledWith(['present'], ['present-record'], localLogs);
    expect(counts.deleted).toBe(1);
    expect(missingOwn.update).not.toHaveBeenCalled();
    expect(missingOwn.deletedAt).toBeUndefined();
    expect(missingForeign.update).toHaveBeenCalledTimes(1);
    expect(missingForeign.deletedAt).toEqual(expect.any(Number));
    expect(present.update).not.toHaveBeenCalled();
  });
});
