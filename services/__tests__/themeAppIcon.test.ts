type ChangeListener = (state: string) => void;

const mockPlatform = { OS: 'ios' };
const mockListeners: ChangeListener[] = [];
const mockNativeModule: {
  current: {
    getAppIcon: jest.Mock<Promise<string | null>, []>;
    setAppIcon: jest.Mock<Promise<string | null>, [string | null]>;
  } | null;
} = { current: null };
const mockHandleError = jest.fn();

jest.mock('react-native', () => ({
  Platform: mockPlatform,
  AppState: {
    addEventListener: (_event: string, listener: ChangeListener) => {
      mockListeners.push(listener);
      return { remove: jest.fn() };
    },
  },
}));
jest.mock('@/modules/theme-app-icon', () => ({
  get themeAppIconModule() {
    return mockNativeModule.current;
  },
}));
jest.mock('@/utils/handleError', () => ({
  handleError: (...args: unknown[]) => mockHandleError(...args),
}));

function loadService(): typeof import('../themeAppIcon') {
  let service: typeof import('../themeAppIcon') | undefined;
  jest.isolateModules(() => {
    service = require('../themeAppIcon');
  });
  return service!;
}

function nativeModule(current: string | null) {
  mockNativeModule.current = {
    getAppIcon: jest.fn().mockResolvedValue(current),
    setAppIcon: jest.fn().mockImplementation(async (name: string | null) => name),
  };
  return mockNativeModule.current;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  mockListeners.length = 0;
  mockHandleError.mockReset();
  mockNativeModule.current = null;
  mockPlatform.OS = 'ios';
});

describe('syncAppIconWithTheme', () => {
  it('does nothing where the native module is unavailable (web, Jest, old builds)', async () => {
    const { syncAppIconWithTheme } = loadService();

    await expect(syncAppIconWithTheme('kinetic-light')).resolves.toBe(false);
    expect(mockListeners).toHaveLength(0);
  });

  it('switches iOS immediately to the theme icon', async () => {
    const native = nativeModule(null);
    const { syncAppIconWithTheme } = loadService();

    await syncAppIconWithTheme('kinetic-volt');

    expect(native.setAppIcon).toHaveBeenCalledWith('KineticVolt');
  });

  it('keeps the default icon for the system preference and the default theme', async () => {
    const native = nativeModule('KineticVolt');
    const { syncAppIconWithTheme } = loadService();

    await syncAppIconWithTheme('system');
    expect(native.setAppIcon).toHaveBeenLastCalledWith(null);

    native.setAppIcon.mockClear();
    await syncAppIconWithTheme('kinetic-depth');
    expect(native.setAppIcon).toHaveBeenLastCalledWith(null);
  });

  it('never re-applies the icon already shown, which would trigger the iOS alert for nothing', async () => {
    const native = nativeModule('KineticShock');
    const { syncAppIconWithTheme } = loadService();

    await syncAppIconWithTheme('kinetic-shock');

    expect(native.setAppIcon).not.toHaveBeenCalled();
  });

  it('defers the Android switch until the app is backgrounded, applying only the last pick', async () => {
    mockPlatform.OS = 'android';
    const native = nativeModule(null);
    const { syncAppIconWithTheme } = loadService();

    await expect(syncAppIconWithTheme('kinetic-light')).resolves.toBe(true);
    await syncAppIconWithTheme('kinetic-blush');
    expect(native.setAppIcon).not.toHaveBeenCalled();
    expect(mockListeners).toHaveLength(1);

    mockListeners[0]('inactive');
    await flush();
    expect(native.setAppIcon).not.toHaveBeenCalled();

    mockListeners[0]('background');
    await flush();
    expect(native.setAppIcon).toHaveBeenCalledTimes(1);
    expect(native.setAppIcon).toHaveBeenCalledWith('KineticBlush');

    // Applied once; later backgrounds have nothing pending.
    mockListeners[0]('background');
    await flush();
    expect(native.setAppIcon).toHaveBeenCalledTimes(1);
  });

  it('reports a failed switch instead of throwing into the settings screen', async () => {
    const native = nativeModule(null);
    native.setAppIcon.mockRejectedValue(new Error('unsupported'));
    const { syncAppIconWithTheme } = loadService();

    await expect(syncAppIconWithTheme('kinetic-light')).resolves.toBe(false);
    expect(mockHandleError).toHaveBeenCalledWith(expect.any(Error), 'themeAppIcon.apply', {
      showSnackbar: false,
    });
  });
});
