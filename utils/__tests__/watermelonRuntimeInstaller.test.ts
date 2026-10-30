const mockInstall = jest.fn(() => {
  (global as any).nativeWatermelonCreateAdapter = jest.fn();
});

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  NativeModules: { WMDatabaseBridge: {}, WMDatabaseJSIBridge: { install: mockInstall } },
}));

// Exercise WatermelonDB's actual dispatcher, including the fallback selected when the legacy
// initializeJSI method is absent on RN 0.88. The native installer is verified by the iOS build.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  getDispatcherType,
} = require('@nozbe/watermelondb/adapters/sqlite/makeDispatcher/index.native');

afterEach(() => {
  delete (global as any).nativeWatermelonCreateAdapter;
  mockInstall.mockClear();
});

it('installs JSI through WMDatabaseJSIBridge when RCTCxxBridge is unavailable', () => {
  expect(getDispatcherType({ jsi: true })).toBe('jsi');
  expect(mockInstall).toHaveBeenCalledTimes(1);
  expect(getDispatcherType({ jsi: true })).toBe('jsi');
  expect(mockInstall).toHaveBeenCalledTimes(1);
});

it('preserves the asynchronous adapter when JSI is explicitly disabled', () => {
  expect(getDispatcherType({ jsi: false })).toBe('asynchronous');
  expect(mockInstall).not.toHaveBeenCalled();
});
