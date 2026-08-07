// Manual mock for `expo-sqlite` — a native module, so its real implementation cannot
// load in Jest. Suites that assert on raw-SQLite behaviour (e.g. the pre-migration
// snapshot conversion) override this with their own factory.

const openDatabaseSync = jest.fn(() => ({
  closeSync: jest.fn(),
  execSync: jest.fn(),
  getAllSync: jest.fn(() => []),
  getFirstSync: jest.fn(() => null),
  runSync: jest.fn(),
}));

module.exports = {
  deleteDatabaseSync: jest.fn(),
  openDatabaseAsync: jest.fn(async (...args) => openDatabaseSync(...args)),
  openDatabaseSync,
};
