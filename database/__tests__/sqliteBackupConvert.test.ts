import { convertSqliteBackupToJson } from '../sqliteBackupConvert';

jest.mock('@/constants/database', () => ({ DATABASE_NAME: 'musclog' }));

jest.mock('../exportDbCore', () => ({
  LIST_USER_TABLES_SQL: 'LIST_TABLES_SQL',
  dumpDatabaseWithQueryRunner: jest.fn(async () => '{"_exportVersion":22}'),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

jest.mock('expo-sqlite', () => {
  const closeSync = jest.fn();
  const getAllSync = jest.fn();
  const openDatabaseSync = jest.fn(() => ({ getAllSync, closeSync }));
  return { openDatabaseSync, __mock: { closeSync, getAllSync, openDatabaseSync } };
});

const { getInfoAsync } = jest.requireMock('expo-file-system/legacy') as {
  getInfoAsync: jest.Mock;
};
const {
  openDatabaseSync,
  __mock: { getAllSync, closeSync },
} = jest.requireMock('expo-sqlite') as {
  openDatabaseSync: jest.Mock;
  __mock: { getAllSync: jest.Mock; closeSync: jest.Mock };
};
const { dumpDatabaseWithQueryRunner } = jest.requireMock('../exportDbCore') as {
  dumpDatabaseWithQueryRunner: jest.Mock;
};

describe('convertSqliteBackupToJson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInfoAsync.mockResolvedValue({ exists: true });
    getAllSync.mockReturnValue([{ name: 'settings' }]);
    dumpDatabaseWithQueryRunner.mockResolvedValue('{"_exportVersion":22}');
  });

  it('refuses to open the live database file (never treat musclog.db as a snapshot)', async () => {
    await expect(convertSqliteBackupToJson('file:///data/musclog.db')).rejects.toThrow(
      /live database/i
    );
    expect(openDatabaseSync).not.toHaveBeenCalled();
  });

  it('throws when the snapshot file does not exist (no silent empty restore)', async () => {
    getInfoAsync.mockResolvedValue({ exists: false });
    await expect(convertSqliteBackupToJson('file:///cache/snap.db')).rejects.toThrow(/not found/i);
    expect(openDatabaseSync).not.toHaveBeenCalled();
  });

  it('throws when the snapshot has no user tables, so a restore cannot wipe the DB', async () => {
    getAllSync.mockReturnValue([]);
    await expect(convertSqliteBackupToJson('file:///cache/snap.db')).rejects.toThrow(/no tables/i);
    expect(dumpDatabaseWithQueryRunner).not.toHaveBeenCalled();
    expect(closeSync).toHaveBeenCalledTimes(1); // opened, so it must be closed
  });

  it('converts a valid snapshot, passing the schema version through, and closes the db', async () => {
    const json = await convertSqliteBackupToJson('file:///cache/snap.db', 22);

    expect(json).toBe('{"_exportVersion":22}');
    expect(openDatabaseSync).toHaveBeenCalledWith('snap.db', undefined, '/cache');
    expect(dumpDatabaseWithQueryRunner).toHaveBeenCalledWith(expect.any(Function), undefined, {
      includeDeletedRecords: true,
      exportVersion: 22,
    });
    expect(closeSync).toHaveBeenCalledTimes(1);
  });

  it('still closes the db if the dump throws', async () => {
    dumpDatabaseWithQueryRunner.mockRejectedValueOnce(new Error('boom'));
    await expect(convertSqliteBackupToJson('file:///cache/snap.db')).rejects.toThrow('boom');
    expect(closeSync).toHaveBeenCalledTimes(1);
  });
});
