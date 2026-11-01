import type NutritionLog from '@/database/models/NutritionLog';

const mockAuthorization = jest.fn();
const mockQueryCorrelations = jest.fn();
const mockDeleteObjects = jest.fn();
const mockSaveCorrelation = jest.fn();
const mockGetCollection = jest.fn();
const mockLoadOwnership = jest.fn();

jest.mock('@kingstinct/react-native-healthkit', () => ({
  AuthorizationStatus: { sharingAuthorized: 2 },
  authorizationStatusFor: (...args: unknown[]) => mockAuthorization(...args),
  queryCorrelationSamples: (...args: unknown[]) => mockQueryCorrelations(...args),
  deleteObjects: (...args: unknown[]) => mockDeleteObjects(...args),
  saveCorrelationSample: (...args: unknown[]) => mockSaveCorrelation(...args),
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
jest.mock('../nutritionHealthOwnership', () => ({
  classifyHealthRecord: jest.fn(() => 'adopt'),
  loadOwnershipContext: (...args: unknown[]) => mockLoadOwnership(...args),
}));

import {
  replaceNutritionLogInHealthConnect,
  syncNutritionFromHealthConnect,
  type NutritionWriteParams,
} from '../healthConnectNutrition.ios';

const params: NutritionWriteParams & { externalId: string } = {
  logId: 'log-1',
  externalId: 'old-correlation',
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
  mockAuthorization.mockReturnValue(2);
  mockGetCollection.mockImplementation(() => queriedRows([{ value: 'true' }]));
  mockQueryCorrelations.mockResolvedValue([
    {
      uuid: 'old-correlation',
      objects: [
        { uuid: 'energy-sample', quantityType: 'HKQuantityTypeIdentifierDietaryEnergyConsumed' },
        { uuid: 'protein-sample', quantityType: 'HKQuantityTypeIdentifierDietaryProtein' },
      ],
    },
  ]);
  mockDeleteObjects.mockResolvedValue(1);
  mockSaveCorrelation.mockResolvedValue({ uuid: 'new-correlation' });
});

describe('iOS nutrition replacement', () => {
  it.each(['query', 'quantity deletion', 'correlation deletion'])(
    'does not create another correlation after %s fails',
    async (stage) => {
      const error = new Error(`${stage} failed`);
      if (stage === 'query') {
        mockQueryCorrelations.mockRejectedValue(error);
      } else if (stage === 'quantity deletion') {
        mockDeleteObjects.mockRejectedValueOnce(error);
      } else {
        mockDeleteObjects.mockImplementation(async (type: string) => {
          if (type === 'HKCorrelationTypeIdentifierFood') {
            throw error;
          }

          return 1;
        });
      }

      await expect(replaceNutritionLogInHealthConnect(params)).resolves.toEqual({
        status: 'not-written',
      });
      expect(mockSaveCorrelation).not.toHaveBeenCalled();
    }
  );

  it('reports a failed save after successful deletion without claiming a new id', async () => {
    mockSaveCorrelation.mockRejectedValue(new Error('save failed'));

    await expect(replaceNutritionLogInHealthConnect(params)).resolves.toEqual({
      status: 'not-written',
    });
    expect(mockDeleteObjects).toHaveBeenCalledWith('HKCorrelationTypeIdentifierFood', {
      uuids: ['old-correlation'],
    });
  });

  it.each(['disabled writing', 'denied authorization'])(
    'leaves existing correlations untouched with %s',
    async (reason) => {
      if (reason === 'disabled writing') {
        mockGetCollection.mockImplementation(() => queriedRows([{ value: 'false' }]));
      } else {
        mockAuthorization.mockReturnValue(0);
      }

      await expect(replaceNutritionLogInHealthConnect(params)).resolves.toEqual({
        status: 'not-written',
      });
      expect(mockQueryCorrelations).not.toHaveBeenCalled();
      expect(mockDeleteObjects).not.toHaveBeenCalled();
      expect(mockSaveCorrelation).not.toHaveBeenCalled();
    }
  );

  it('deletes quantity samples and the old correlation before saving its replacement', async () => {
    await expect(replaceNutritionLogInHealthConnect(params)).resolves.toEqual({
      status: 'written',
      externalId: 'new-correlation',
    });

    expect(mockDeleteObjects.mock.calls).toEqual([
      ['HKQuantityTypeIdentifierDietaryEnergyConsumed', { uuids: ['energy-sample'] }],
      ['HKQuantityTypeIdentifierDietaryProtein', { uuids: ['protein-sample'] }],
      ['HKCorrelationTypeIdentifierFood', { uuids: ['old-correlation'] }],
    ]);
    expect(mockSaveCorrelation.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockDeleteObjects.mock.invocationCallOrder[2]
    );
    expect(mockSaveCorrelation).toHaveBeenCalledWith(
      'HKCorrelationTypeIdentifierFood',
      expect.any(Array),
      new Date(params.date),
      new Date(params.date + 60_000),
      expect.objectContaining({ HKExternalUUID: 'log-1' })
    );
  });
});

describe('iOS replacement cleanup counts', () => {
  it.each(['quantity', 'correlation'])(
    'does not save after a resolved no-op %s deletion',
    async (kind) => {
      if (kind === 'quantity') {
        mockDeleteObjects.mockResolvedValueOnce(0);
      } else {
        mockDeleteObjects
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0);
      }
      await expect(replaceNutritionLogInHealthConnect(params)).resolves.toEqual({
        status: 'not-written',
      });
      expect(mockSaveCorrelation).not.toHaveBeenCalled();
    }
  );
});

describe('iOS nutrition pull deletion policy', () => {
  it('keeps missing locally owned logs and newer export ids while removing missing foreign imports', async () => {
    const makeLog = (id: string, externalId: string) => {
      const record = { id, externalId, createdAt: 1, deletedAt: undefined as number | undefined };
      return {
        ...record,
        update: jest.fn(async (apply: (log: typeof record) => void) => apply(record)),
      };
    };
    const present = makeLog('present', 'newer-export-id');
    const missingOwn = makeLog('log-1', 'old-correlation');
    const missingForeign = makeLog('foreign', 'foreign-correlation');
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
    mockQueryCorrelations.mockResolvedValue([
      {
        uuid: 'present-correlation',
        startDate: new Date(params.date),
        objects: [],
        metadata: { HKExternalUUID: 'present' },
      },
    ]);
    mockLoadOwnership.mockResolvedValue({
      ownLogs: new Map([['present', present as unknown as NutritionLog]]),
      ownedLogIds: new Set(['present', 'log-1']),
      tombstonedExternalIds: new Set(),
      ignoredRecordIds: new Set(),
    });
    // Only the present record is classified; missing rows exercise the sweep itself.
    const { classifyHealthRecord } = jest.requireMock('../nutritionHealthOwnership');
    classifyHealthRecord.mockReturnValue('adopt');

    const counts = await syncNutritionFromHealthConnect(
      { startTime: params.date - 86_400_000, endTime: params.date + 86_400_000 },
      { retryAttempts: 1 }
    );

    expect(counts.deleted).toBe(1);
    expect(missingOwn.update).not.toHaveBeenCalled();
    expect(missingForeign.update).toHaveBeenCalledTimes(1);
    expect(present.update).not.toHaveBeenCalled();
  });
});
