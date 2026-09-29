import {
  createPreExerciseCatalogueBackup,
  getStoredBackups,
} from '@/database/preMigrationBackup.web';

jest.mock('@/constants/platform', () => ({ isStaticExport: false }));
jest.mock('@/database/exportDb', () => ({ dumpDatabase: jest.fn(async () => '{"data":true}') }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

// Payloads live in IndexedDB (localStorage cannot hold a database dump); the fake store
// keeps the quota behaviour the recovery loop is written against.
const mockPayloads = new Map<string, string>();
let mockFailNewPayloadWhile: () => boolean = () => false;

jest.mock('@/database/webBackupPayloadStore', () => ({
  deleteWebBackupPayload: jest.fn(async (key: string) => {
    mockPayloads.delete(key);
  }),
  hasWebBackupPayload: jest.fn(async (key: string) => mockPayloads.has(key)),
  readWebBackupPayload: jest.fn(async (key: string) => mockPayloads.get(key) ?? null),
  writeWebBackupPayload: jest.fn(async (key: string, content: string) => {
    if (key === MOCK_NEW_HASH && mockFailNewPayloadWhile()) {
      throw new DOMException('quota full', 'QuotaExceededError');
    }
    mockPayloads.set(key, content);
  }),
}));

const INDEX_KEY = 'musclog_pre_migration_backups_v1';
const MOCK_NEW_HASH = '0102';
const NEW_HASH = MOCK_NEW_HASH;

class QuotaStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
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
    mockPayloads.clear();
    mockFailNewPayloadWhile = () => false;
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
    mockPayloads.set('newest', 'newest-data');
    mockPayloads.set('oldest', 'oldest-data');
    mockFailNewPayloadWhile = () => mockPayloads.has('oldest');

    await expect(createPreExerciseCatalogueBackup()).resolves.toBe(`web-backup://${NEW_HASH}`);

    expect(mockPayloads.get('newest')).toBe('newest-data');
    expect(mockPayloads.has('oldest')).toBe(false);
    expect(mockPayloads.get(NEW_HASH)).toBe('{"data":true}');
    expect((await getStoredBackups()).map((backup) => backup.uri)).toEqual([
      `web-backup://${NEW_HASH}`,
      'web-backup://newest',
    ]);
  });

  it('refuses the required replacement when only the protected recovery point remains', async () => {
    const newest = meta('newest', '2026-08-12T12:00:00.000Z');
    storage.values.set(INDEX_KEY, JSON.stringify([newest]));
    mockPayloads.set('newest', 'newest-data');
    mockFailNewPayloadWhile = () => true;

    await expect(createPreExerciseCatalogueBackup()).rejects.toThrow(
      'preserving the latest recovery point'
    );

    expect(mockPayloads.get('newest')).toBe('newest-data');
    expect(mockPayloads.has(NEW_HASH)).toBe(false);
    expect(await getStoredBackups()).toEqual([newest]);
  });
});
