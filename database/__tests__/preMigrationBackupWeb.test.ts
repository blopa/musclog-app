import { WEB_BACKUP_DATA_PREFIX } from '@/constants/exportImport';
import {
  createPreExerciseCatalogueBackup,
  getStoredBackups,
} from '@/database/preMigrationBackup.web';

jest.mock('@/constants/platform', () => ({ isStaticExport: false }));
jest.mock('@/database/exportDb', () => ({ dumpDatabase: jest.fn(async () => '{"data":true}') }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

const INDEX_KEY = 'musclog_pre_migration_backups_v1';
const NEW_HASH = '0102';
const NEW_KEY = `${WEB_BACKUP_DATA_PREFIX}${NEW_HASH}`;

class QuotaStorage {
  readonly values = new Map<string, string>();
  failNewBackupWhile: () => boolean = () => false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (key === NEW_KEY && this.failNewBackupWhile()) {
      throw new DOMException('quota full', 'QuotaExceededError');
    }
    this.values.set(key, value);
  }
}

const meta = (hash: string, createdAt: string) => ({
  uri: `web-backup://${hash}`,
  createdAt,
  fromVersion: 24,
  toVersion: 25,
  reason: 'schema-migration' as const,
});

describe('web safety backup quota recovery', () => {
  const storage = new QuotaStorage();
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { subtle: { digest: jest.fn() } },
    });
  });

  beforeEach(() => {
    storage.values.clear();
    storage.failNewBackupWhile = () => false;
    jest
      .mocked(globalThis.crypto.subtle.digest)
      .mockResolvedValue(new Uint8Array([1, 2]).buffer as ArrayBuffer);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('evicts the oldest entry and commits the replacement without touching the newest backup', async () => {
    const newest = meta('newest', '2026-08-12T12:00:00.000Z');
    const oldest = meta('oldest', '2026-08-11T12:00:00.000Z');
    storage.values.set(INDEX_KEY, JSON.stringify([newest, oldest]));
    storage.values.set(`${WEB_BACKUP_DATA_PREFIX}newest`, 'newest-data');
    storage.values.set(`${WEB_BACKUP_DATA_PREFIX}oldest`, 'oldest-data');
    storage.failNewBackupWhile = () => storage.values.has(`${WEB_BACKUP_DATA_PREFIX}oldest`);

    await expect(createPreExerciseCatalogueBackup()).resolves.toBe(`web-backup://${NEW_HASH}`);

    expect(storage.values.get(`${WEB_BACKUP_DATA_PREFIX}newest`)).toBe('newest-data');
    expect(storage.values.has(`${WEB_BACKUP_DATA_PREFIX}oldest`)).toBe(false);
    expect(storage.values.get(NEW_KEY)).toBe('{"data":true}');
    expect((await getStoredBackups()).map((backup) => backup.uri)).toEqual([
      `web-backup://${NEW_HASH}`,
      'web-backup://newest',
    ]);
  });

  it('refuses the required replacement when only the protected recovery point remains', async () => {
    const newest = meta('newest', '2026-08-12T12:00:00.000Z');
    storage.values.set(INDEX_KEY, JSON.stringify([newest]));
    storage.values.set(`${WEB_BACKUP_DATA_PREFIX}newest`, 'newest-data');
    storage.failNewBackupWhile = () => true;

    await expect(createPreExerciseCatalogueBackup()).rejects.toThrow(
      'preserving the latest recovery point'
    );

    expect(storage.values.get(`${WEB_BACKUP_DATA_PREFIX}newest`)).toBe('newest-data');
    expect(storage.values.has(NEW_KEY)).toBe(false);
    expect(await getStoredBackups()).toEqual([newest]);
  });
});
