const mockHandleError = jest.fn(async () => {});
const mockGetApple = jest.fn();
const mockRefreshModel = jest.fn(async () => {});
const mockGet = jest.fn(async () => 'auto');
const mockTextModelKind = jest.fn(() => 'none');

jest.mock('@/utils/handleError', () => ({
  handleError: (...args: unknown[]) => mockHandleError(...args),
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: (...args: unknown[]) => mockGet(...args) },
}));
jest.mock('@/utils/onDeviceAi', () => ({ getAppleAvailability: () => mockGetApple() }));
jest.mock('@/services/localModels/modelStore', () => ({
  getLocalModelSnapshot: () => ({
    supported: true,
    state: { kind: 'none' },
    projectorInstalled: false,
    updateAvailable: false,
  }),
  refreshLocalModel: () => mockRefreshModel(),
  localTextModelStore: {
    refresh: () => mockRefreshModel(),
    getSnapshot: () => ({ state: { kind: mockTextModelKind() } }),
    subscribe: () => () => {},
  },
  subscribeLocalModel: () => () => {},
}));
jest.mock('@/services/localModels/devWebBridge', () => ({ isDevWebLocalModel: () => false }));
jest.mock('expo-device', () => ({ totalMemory: 8e9, supportedCpuArchitectures: ['arm64-v8a'] }));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));

import {
  getOnDeviceStatusSnapshot,
  refreshOnDeviceStatus,
  resetOnDeviceStatusForTests,
} from '@/services/localModels/onDeviceStatusStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });

  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('onDeviceStatusStore', () => {
  beforeEach(() => {
    resetOnDeviceStatusForTests();
    jest.clearAllMocks();
    mockGetApple.mockResolvedValue('available');
  });

  it('reports the optional text model in the capabilities', async () => {
    mockGet.mockResolvedValue('gguf' as never);
    mockTextModelKind.mockReturnValue('ready');

    expect((await refreshOnDeviceStatus()).capabilities.textModel).toBe(true);

    mockTextModelKind.mockReturnValue('none');
    expect((await refreshOnDeviceStatus()).capabilities.textModel).toBe(false);
    mockGet.mockResolvedValue('auto' as never);
  });

  it('never rejects when a probe fails, reports it once and keeps the last snapshot', async () => {
    await refreshOnDeviceStatus();
    const before = getOnDeviceStatusSnapshot();
    expect(before.initialized).toBe(true);

    const error = new Error('native module missing');
    mockGetApple.mockRejectedValueOnce(error);

    const after = await refreshOnDeviceStatus();

    expect(after).toEqual(before);
    expect(getOnDeviceStatusSnapshot()).toEqual(before);
    expect(mockHandleError).toHaveBeenCalledTimes(1);
    expect(mockHandleError).toHaveBeenCalledWith(error, 'onDeviceStatus.refresh', {
      showSnackbar: false,
    });
  });

  it('leaves the status uninitialized when the first probe fails', async () => {
    mockGetApple.mockRejectedValueOnce(new Error('boom'));

    const snapshot = await refreshOnDeviceStatus();

    expect(snapshot.initialized).toBe(false);
  });

  it('runs one probe plus one shared trailing probe for calls made while one runs', async () => {
    const first = deferred<string>();
    mockGetApple.mockReturnValueOnce(first.promise).mockResolvedValue('available');

    const a = refreshOnDeviceStatus();
    await tick();
    expect(mockGetApple).toHaveBeenCalledTimes(1);

    const b = refreshOnDeviceStatus();
    const c = refreshOnDeviceStatus();
    expect(b).toBe(c);

    first.resolve('appleIntelligenceNotEnabled');
    const [ra, rb, rc] = await Promise.all([a, b, c]);

    expect(mockGetApple).toHaveBeenCalledTimes(2);
    expect(ra.appleState).toBe('appleOff');
    expect(rb.appleState).toBe('ready');
    expect(rc.appleState).toBe('ready');
  });

  it('starts a fresh probe for a call made after the previous one finished', async () => {
    await refreshOnDeviceStatus();
    await refreshOnDeviceStatus();

    expect(mockGetApple).toHaveBeenCalledTimes(2);
  });

  it('does not let a probe still running at reset change the new session', async () => {
    const slow = deferred<string>();
    mockGetApple.mockReturnValueOnce(slow.promise);

    const stale = refreshOnDeviceStatus();
    await tick();
    resetOnDeviceStatusForTests();
    const fresh = getOnDeviceStatusSnapshot();

    slow.resolve('available');
    await stale;

    expect(getOnDeviceStatusSnapshot()).toBe(fresh);
    expect(getOnDeviceStatusSnapshot().initialized).toBe(false);
  });
});
