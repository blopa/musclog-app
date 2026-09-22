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

// `database/adapter.ts` constructs a real native SQLiteAdapter at module scope, which
// needs JSI and cannot exist under Jest. Because `database/database-instance.ts` imports
// it, that would take down every suite whose module graph reaches the database — even
// suites that mock the database itself. `new Database()` only requires a truthy adapter,
// so a stub is enough. Suites that exercise the adapter mock it themselves.
// It keeps the real schema/migrations because WatermelonDB's `Database` constructor
// validates every model class against the adapter's schema.
jest.mock('@/database/adapter', () => ({
  __esModule: true,
  default: {
    migrations: jest.requireActual('@/database/migrations').migrations,
    schema: jest.requireActual('@/database/schema').schema,
  },
}));

// `expo-localization` is stubbed by the manual mock in `__mocks__/`, which Jest applies
// automatically to both the node and jsdom projects.
jest.mock('expo-crypto', () => {
  let counter = 0;
  // Distinct per call: tests that generate several ids (chat groups, sync ids, optical
  // payloads) must not silently collide on a constant.
  return {
    randomUUID: () => {
      counter += 1;
      return `00000000-0000-4000-a000-${String(counter).padStart(12, '0')}`;
    },
  };
});
