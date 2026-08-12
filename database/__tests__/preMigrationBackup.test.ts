import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteAsync, writeAsStringAsync } from 'expo-file-system/legacy';

import { type BackupFileMeta, writePortableBackup } from '@/database/preMigrationBackup';

const mockStorageValues = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorageValues.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorageValues.set(key, value);
    }),
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

const INDEX_KEY = 'pre_migration_backups_v1';
const NEW_URI = 'file:///cache/2026-08-12T12-00-00-pre-exercise-catalogue.json';

const backup = (name: string): BackupFileMeta => ({
  uri: `file:///cache/${name}.json`,
  createdAt: `2026-08-${name === 'newest' ? '11' : name === 'middle' ? '10' : '09'}T12:00:00.000Z`,
  fromVersion: 24,
  toVersion: 25,
  format: 'json',
  reason: 'schema-migration',
});

describe('native pre-migration backup index commits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageValues.clear();
  });

  it('preserves every indexed recovery point when the replacement index write fails', async () => {
    const existing = [backup('newest'), backup('middle'), backup('oldest')];
    mockStorageValues.set(INDEX_KEY, JSON.stringify(existing));
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('index unavailable'));

    const replacement: BackupFileMeta = {
      uri: NEW_URI,
      createdAt: '2026-08-12T12:00:00.000Z',
      fromVersion: null,
      toVersion: null,
      format: 'json',
      reason: 'exercise-catalogue',
    };

    await expect(writePortableBackup(replacement, '{"data":true}')).rejects.toThrow(
      'index unavailable'
    );

    expect(mockStorageValues.get(INDEX_KEY)).toBe(JSON.stringify(existing));
    expect(writeAsStringAsync).toHaveBeenCalledWith(NEW_URI, '{"data":true}');
    expect(deleteAsync).toHaveBeenCalledTimes(1);
    expect(deleteAsync).toHaveBeenCalledWith(NEW_URI, { idempotent: true });
    for (const entry of existing) {
      expect(deleteAsync).not.toHaveBeenCalledWith(entry.uri, expect.anything());
    }
  });
});
