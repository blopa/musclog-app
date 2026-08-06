// Manual mock for `@sentry/react-native`.
//
// The real package ships untranspiled ESM/TSX and pulls React Native's native
// component registry in through its replay module, which cannot be loaded in the
// `node` test environment. No test wants to talk to the real Sentry SDK anyway, so
// Jest picks this stub up automatically for every suite (node + jsdom).
//
// A test that needs to assert on Sentry calls can still `jest.mock` it with its own
// factory — an explicit factory takes precedence over this file.

const ErrorBoundary = ({ children }) => children;

module.exports = {
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  ErrorBoundary,
  init: jest.fn(),
  setUser: jest.fn(),
  wrap: (component) => component,
};
