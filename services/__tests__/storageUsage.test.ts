const mockFiles: Record<
  string,
  { dir?: boolean; size?: number; mtime?: number; children?: string[] }
> = {};
const mockDeleted: string[] = [];
const mockBackups: { uri: string; asyncStorageUri?: string }[] = [];

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/files/',
  cacheDirectory: 'file:///data/cache/',
  getInfoAsync: jest.fn(async (uri: string) => {
    const key = uri.replace(/\/$/, '');
    const f = mockFiles[key];
    return f
      ? {
          exists: true,
          uri,
          isDirectory: Boolean(f.dir),
          size: f.size ?? 0,
          modificationTime: f.mtime ?? 0,
        }
      : { exists: false, uri, isDirectory: false };
  }),
  readDirectoryAsync: jest.fn(
    async (uri: string) => mockFiles[uri.replace(/\/$/, '')]?.children ?? []
  ),
  deleteAsync: jest.fn(async (uri: string) => {
    mockDeleted.push(uri);
  }),
}));
jest.mock('@/database/preMigrationBackup', () => ({
  getStoredBackups: jest.fn(async () => mockBackups),
}));

import { clearStorageCategory, measureStorage } from '../storageUsage';

const nowSec = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  for (const key of Object.keys(mockFiles)) {
    delete mockFiles[key];
  }
  mockDeleted.length = 0;
  mockBackups.length = 0;

  const old = nowSec() - 7200;
  Object.assign(mockFiles, {
    'file:///data/musclog.db': { size: 1000 },
    'file:///data/musclog.db-wal': { size: 200 },
    'file:///data/files/foods': { dir: true, children: ['a.jpg'] },
    'file:///data/files/foods/a.jpg': { size: 300 },
    'file:///data/files/exercise-images': { dir: true, children: ['x__0.webp', 'x__1.webp'] },
    'file:///data/files/exercise-images/x__0.webp': { size: 40 },
    'file:///data/files/exercise-images/x__1.webp': { size: 60 },
    'file:///data/cache': {
      dir: true,
      children: ['old.csv', 'new.csv', 'backup.json', 'ble-workout-tracking', 'ImagePicker'],
    },
    'file:///data/cache/old.csv': { size: 5, mtime: old },
    'file:///data/cache/new.csv': { size: 7, mtime: nowSec() },
    'file:///data/cache/backup.json': { size: 900, mtime: old },
    'file:///data/cache/ble-workout-tracking': { dir: true, mtime: old, children: ['s.ndjson'] },
    'file:///data/cache/ble-workout-tracking/s.ndjson': { size: 50 },
    'file:///data/cache/ImagePicker': { dir: true, mtime: old, children: ['p.jpg'] },
    'file:///data/cache/ImagePicker/p.jpg': { size: 20 },
  });
  mockBackups.push({ uri: 'file:///data/cache/backup.json' });
});

describe('measureStorage', () => {
  it('sizes each category and keeps recovery points out of temporary files', async () => {
    const report = await measureStorage();
    const bytes = Object.fromEntries((report?.categories ?? []).map((c) => [c.id, c.bytes]));

    expect(bytes).toEqual({
      database: 1200,
      photos: 300,
      sensorRecordings: 0,
      recoveryPoints: 900,
      exerciseImages: 100,
      // old.csv + new.csv + ImagePicker/p.jpg; not backup.json, not ble-workout-tracking
      temporary: 5 + 7 + 20,
    });
    expect(report?.totalBytes).toBe(1200 + 300 + 900 + 100 + 32);
  });
});

describe('clearStorageCategory', () => {
  it('clears exercise pictures and reports what it freed', async () => {
    await expect(clearStorageCategory('exerciseImages')).resolves.toBe(100);
    expect(mockDeleted).toEqual(['file:///data/files/exercise-images']);
  });

  it('removes only old temporary files, never a backup or the live recording', async () => {
    const freed = await clearStorageCategory('temporary');

    expect(mockDeleted.sort()).toEqual([
      'file:///data/cache/ImagePicker',
      'file:///data/cache/old.csv',
    ]);
    expect(freed).toBe(25);
  });
});
