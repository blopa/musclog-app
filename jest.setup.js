// Global mocks

// mock the __DEV__ global variable
Object.defineProperty(global, '__DEV__', {
  value: true,
});

// Skip React Native setup for jsdom environment (used for hook tests)
if (process.env.JEST_ENVIRONMENT !== 'jsdom') {
  // React Native's jest setup runs here for node environment
  // This prevents conflicts with jsdom's window object
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
