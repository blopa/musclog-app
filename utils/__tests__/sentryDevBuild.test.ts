// Jest runs with `__DEV__` on, so this is the development build.
jest.mock('@sentry/react-native', () => ({ init: jest.fn(), close: jest.fn() }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0' }));
jest.mock('expo-device', () => ({ modelName: 'Test phone' }));
jest.mock('@/constants/platform', () => ({ isStaticExport: false }));

function initOptions(): { enabled?: boolean } {
  let options: { enabled?: boolean } = {};
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    require('@/sentry-init').initializeSentry();
    options = require('@sentry/react-native').init.mock.calls[0][0];
    /* eslint-enable @typescript-eslint/no-require-imports */
  });

  return options;
}

describe('Sentry in a development build', () => {
  const flag = process.env.EXPO_PUBLIC_SENTRY_IN_DEV;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_SENTRY_IN_DEV;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_SENTRY_IN_DEV = flag;
  });

  it('sends nothing, so a hot reload never files an issue', () => {
    expect(initOptions().enabled).toBe(false);
  });

  it('sends when asked to, to try the reporting itself', () => {
    process.env.EXPO_PUBLIC_SENTRY_IN_DEV = '1';

    expect(initOptions().enabled).toBe(true);
  });
});
