import { HealthConnectErrorCode, type HealthConnectError } from '@/services/healthConnectErrors';
import { healthDataSyncService, SyncStatus } from '@/services/healthDataSync';

const mockSettingsFetch = jest.fn();
const mockHasAnyPermission = jest.fn();
const mockHandleError = jest.fn();

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    eq: jest.fn((value: unknown) => value),
    where: jest.fn((...args: unknown[]) => args),
  },
}));

jest.mock('@/database', () => ({
  database: {
    get: jest.fn(() => ({
      query: jest.fn(() => ({ fetch: mockSettingsFetch })),
    })),
    write: jest.fn(),
  },
}));

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

jest.mock('@/services/healthConnect', () => ({
  healthConnectService: {
    hasAnyPermission: (...args: unknown[]) => mockHasAnyPermission(...args),
  },
}));

jest.mock('@/services/healthConnectFitness', () => ({
  syncFitnessMetrics: jest.fn(),
}));

jest.mock('@/services/healthConnectNutrition', () => ({
  syncNutritionFromHealthConnect: jest.fn(),
}));

jest.mock('@/utils/handleError', () => ({
  handleError: (...args: unknown[]) => mockHandleError(...args),
}));

describe('healthDataSyncService error reporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsFetch.mockResolvedValue([{ value: 'true' }]);
    mockHandleError.mockResolvedValue(undefined);
  });

  it.each(['manual', 'background'] as const)(
    'does not report missing permissions to Sentry for a %s sync',
    async (trigger) => {
      mockHasAnyPermission.mockResolvedValue(false);

      const result = await healthDataSyncService.syncFromHealthPlatform({ trigger });

      expect(result.status).toBe(SyncStatus.ERROR);
      expect(result.errors[0].code).toBe(HealthConnectErrorCode.INSUFFICIENT_PERMISSIONS);
      expect(mockHandleError).not.toHaveBeenCalled();
    }
  );

  it('reports an unexpected manual-sync failure', async () => {
    mockHasAnyPermission.mockRejectedValue(new Error('native bridge failed'));

    const result = await healthDataSyncService.syncFromHealthPlatform({ trigger: 'manual' });

    expect(result.status).toBe(SyncStatus.ERROR);
    expect((result.errors[0] as HealthConnectError).code).toBe(
      HealthConnectErrorCode.UNKNOWN_ERROR
    );
    expect(mockHandleError).toHaveBeenCalledWith(
      result.errors[0],
      'healthDataSync.syncHealthData',
      { showSnackbar: false }
    );
  });

  it('silently returns an unexpected background-sync failure', async () => {
    mockHasAnyPermission.mockRejectedValue(new Error('native bridge failed'));

    const result = await healthDataSyncService.syncFromHealthPlatform({ trigger: 'background' });

    expect(result.status).toBe(SyncStatus.ERROR);
    expect(result.errors[0].code).toBe(HealthConnectErrorCode.UNKNOWN_ERROR);
    expect(mockHandleError).not.toHaveBeenCalled();
  });
});
