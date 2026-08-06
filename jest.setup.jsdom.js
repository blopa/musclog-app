// Setup file for jsdom environment (hook tests)
// This file is used instead of the default jest.setup.js to avoid React Native setup conflicts
// No React Native setup is loaded here, preventing window property conflicts

// mock the __DEV__ global variable (mirrors jest.setup.js — RN always defines this at runtime)
Object.defineProperty(global, '__DEV__', {
  value: true,
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// `database/adapter.ts` builds a real SQLiteAdapter at module scope, which reaches for a
// native driver that does not exist here. Because `database/database-instance.ts` imports
// it, that would take down every suite whose module graph reaches the database — even
// suites that mock the database itself. Mirrors the same mock in `jest.setup.js`; it keeps
// the real schema/migrations because `new Database()` validates model classes against them.
jest.mock('@/database/adapter', () => ({
  __esModule: true,
  default: {
    migrations: jest.requireActual('@/database/migrations').migrations,
    schema: jest.requireActual('@/database/schema').schema,
  },
}));
