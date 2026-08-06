// Manual mock for `expo-router`. The real package pulls in
// `react-native-safe-area-context` -> `codegenNativeComponent`, which drags
// `react-native-css-interop`'s untransformed JSX pragma probe into the module graph and
// blows up before any test runs. Navigation is never exercised in these unit tests, so
// a flat stub of the surface the app imports is enough.

const router = {
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
  dismissAll: jest.fn(),
  navigate: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  setParams: jest.fn(),
};

const passthrough = ({ children }) => children ?? null;

module.exports = {
  Link: passthrough,
  Redirect: () => null,
  router,
  Slot: passthrough,
  Stack: Object.assign(passthrough, { Screen: () => null }),
  useLocalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
  useRootNavigationState: jest.fn(() => ({ key: 'test-root-key' })),
  useRouter: jest.fn(() => router),
  useSegments: jest.fn(() => []),
};
