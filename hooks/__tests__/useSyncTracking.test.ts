/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { Platform } from 'react-native';

import { useSyncTracking } from '@/hooks/useSyncTracking';
import { HealthConnectError, HealthConnectErrorCode } from '@/services/healthConnectErrors';
import { SyncStatus, type SyncResult } from '@/services/healthDataSync';

const mockShowSnackbar = jest.fn();
const mockSyncFromHealthConnect = jest.fn();
const mockIsSyncEnabled = jest.fn();
const mockGetLastSyncTime = jest.fn();
const mockIsSyncInProgress = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

jest.mock('@/context/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: mockShowSnackbar }),
}));

jest.mock('@/services/healthDataSync', () => ({
  SyncStatus: {
    IDLE: 'IDLE',
    SYNCING: 'SYNCING',
    SUCCESS: 'SUCCESS',
    ERROR: 'ERROR',
  },
  healthDataSyncService: {
    syncFromHealthConnect: (...args: unknown[]) => mockSyncFromHealthConnect(...args),
    isSyncEnabled: (...args: unknown[]) => mockIsSyncEnabled(...args),
    getLastSyncTime: (...args: unknown[]) => mockGetLastSyncTime(...args),
    isSyncInProgress: (...args: unknown[]) => mockIsSyncInProgress(...args),
    enableSync: jest.fn(),
    disableSync: jest.fn(),
  },
}));

function permissionResult(): SyncResult {
  const error = new HealthConnectError(
    HealthConnectErrorCode.INSUFFICIENT_PERMISSIONS,
    'no permissions'
  );
  return {
    status: SyncStatus.ERROR,
    recordsRead: 0,
    recordsWritten: 0,
    recordsSkipped: 0,
    errors: [error],
    startTime: 1,
    endTime: 2,
    duration: 1,
  };
}

describe('useSyncTracking feedback', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSyncEnabled.mockResolvedValue(true);
    mockGetLastSyncTime.mockResolvedValue(0);
    mockIsSyncInProgress.mockReturnValue(false);
    mockSyncFromHealthConnect.mockResolvedValue(permissionResult());
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('shows missing permissions as a snackbar for a manual native sync only', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const { result } = renderHook(() => useSyncTracking());
    await waitFor(() => expect(mockIsSyncEnabled).toHaveBeenCalled());

    await act(async () => {
      await result.current.syncNow({ lookbackDays: 7 });
    });

    expect(mockSyncFromHealthConnect).toHaveBeenCalledWith({
      lookbackDays: 7,
      trigger: 'manual',
    });
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      'error',
      'snackbar.healthConnect.noPermissionsGranted'
    );
    expect(result.current.error).toBeNull();
  });

  it('does not show a snackbar for an automatic native sync', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const { result } = renderHook(() => useSyncTracking());

    await act(async () => {
      await result.current.syncInBackground();
    });

    expect(mockSyncFromHealthConnect).toHaveBeenCalledWith({ trigger: 'background' });
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('does not show health-sync feedback on web, even for syncNow', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const { result } = renderHook(() => useSyncTracking());

    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockSyncFromHealthConnect).toHaveBeenCalledWith({ trigger: 'manual' });
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });
});
