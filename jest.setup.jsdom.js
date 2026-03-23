// Setup file for jsdom environment (hook tests)
// This file is used instead of the default jest.setup.js to avoid React Native setup conflicts
// No React Native setup is loaded here, preventing window property conflicts

global.__DEV__ = true;

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  Platform: {
    OS: 'web',
    select: jest.fn((obj) => obj.web || obj.default),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
