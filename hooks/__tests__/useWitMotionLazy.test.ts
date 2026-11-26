/**
 * @jest-environment jsdom
 */

/**
 * The WitMotion sensor module is a rarely used feature. Importing it, or mounting a screen that
 * only might use it, must not touch the native module; only a subscription or an action does.
 */

const mockNative = {
  addListener: jest.fn(),
  getState: jest.fn(async () => ({})),
  startScan: jest.fn(async () => true),
  stopScan: jest.fn(),
  disconnect: jest.fn(() => true),
};
const mockRequireOptionalNativeModule = jest.fn((_name: string) => mockNative);

jest.mock('expo', () => ({
  requireOptionalNativeModule: (name: string) => mockRequireOptionalNativeModule(name),
}));
jest.mock('react-native', () => ({ Platform: { OS: 'android', Version: 35 } }));

type Fresh = typeof import('@/modules/witmotion-ble') & {
  renderHook: typeof import('@testing-library/react/pure').renderHook;
};

/** A new client singleton, with React and the testing library from the same module registry. */
function loadFresh(): Fresh {
  let loaded: Fresh | undefined;

  jest.isolateModules(() => {
    loaded = {
      ...require('@/modules/witmotion-ble'),
      // `/pure`: the main entry registers cleanup hooks, which Jest refuses inside a test.
      renderHook: require('@testing-library/react/pure').renderHook,
    };
  });

  return loaded as Fresh;
}

describe('WitMotion sensor module wake-up', () => {
  beforeEach(() => jest.clearAllMocks());

  it('touches nothing native when imported', () => {
    const { witMotionClient } = loadFresh();

    expect(mockRequireOptionalNativeModule).not.toHaveBeenCalled();
    expect(witMotionClient.isAwake()).toBe(false);
  });

  it('stays asleep for a mounted screen that passes enabled: false', () => {
    const { renderHook, useWitMotion, witMotionClient } = loadFresh();

    const { result } = renderHook(() => useWitMotion({ enabled: false }));

    expect(result.current.isConnected).toBe(false);
    expect(mockRequireOptionalNativeModule).not.toHaveBeenCalled();
    expect(witMotionClient.isAwake()).toBe(false);
  });

  it('does not wake to stop or disconnect what never ran', async () => {
    const { witMotionClient } = loadFresh();

    witMotionClient.stopScan();
    await witMotionClient.disconnect();

    expect(mockRequireOptionalNativeModule).not.toHaveBeenCalled();
    expect(mockNative.stopScan).not.toHaveBeenCalled();
  });

  it('wakes once when a screen subscribes, and listens from then on', () => {
    const { renderHook, useWitMotion, witMotionClient } = loadFresh();

    renderHook(() => useWitMotion());
    renderHook(() => useWitMotion());

    expect(mockRequireOptionalNativeModule).toHaveBeenCalledTimes(1);
    expect(mockRequireOptionalNativeModule).toHaveBeenCalledWith('WitMotionBle');
    expect(mockNative.addListener).toHaveBeenCalledWith('onStateChanged', expect.any(Function));
    expect(mockNative.addListener).toHaveBeenCalledWith('onDataBatch', expect.any(Function));
    expect(mockNative.getState).toHaveBeenCalledTimes(1);
    expect(witMotionClient.isAwake()).toBe(true);
  });

  it('wakes on an action such as a scan', async () => {
    const { witMotionClient } = loadFresh();

    await witMotionClient.startScan();

    expect(mockRequireOptionalNativeModule).toHaveBeenCalledTimes(1);
    expect(mockNative.startScan).toHaveBeenCalledTimes(1);
  });
});
