import { WEB_BACKUP_DATA_PREFIX } from '@/constants/exportImport';
import {
  deleteWebBackupPayload,
  hasWebBackupPayload,
  readWebBackupPayload,
  writeWebBackupPayload,
} from '@/database/webBackupPayloadStore';

const localValues = new Map<string, string>();

/**
 * Minimal IndexedDB double: enough of `open` → `transaction` → `objectStore` for the
 * get/put/delete the store issues, plus a quota failure on demand.
 */
function installFakeIndexedDb(): { failWrites: boolean; records: Map<string, string> } {
  const state = { failWrites: false, records: new Map<string, string>() };
  const fireLater = (run: () => void) => setTimeout(run, 0);

  const factory = {
    open: () => {
      const openRequest: Record<string, unknown> = {};

      fireLater(() => {
        openRequest.result = {
          close: () => {},
          objectStoreNames: { contains: () => true },
          transaction: () => {
            const transaction: Record<string, unknown> = {};

            const makeRequest = (run: () => unknown) => {
              const request: Record<string, unknown> = {};
              fireLater(() => {
                if (state.failWrites) {
                  request.error = new DOMException('quota full', 'QuotaExceededError');
                  (request.onerror as (() => void) | undefined)?.();
                  (transaction.onabort as (() => void) | undefined)?.();
                  return;
                }

                request.result = run();
                (transaction.oncomplete as (() => void) | undefined)?.();
              });
              return request;
            };

            transaction.objectStore = () => ({
              delete: (key: string) => makeRequest(() => state.records.delete(key)),
              get: (key: string) => makeRequest(() => state.records.get(key)),
              put: (value: string, key: string) => makeRequest(() => state.records.set(key, value)),
            });

            return transaction;
          },
        };
        (openRequest.onsuccess as (() => void) | undefined)?.();
      });

      return openRequest;
    },
  };

  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: factory });
  return state;
}

function removeIndexedDb(): void {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
}

describe('web backup payload store', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => localValues.get(key) ?? null,
        removeItem: (key: string) => localValues.delete(key),
        setItem: (key: string, value: string) => localValues.set(key, value),
      },
    });
  });

  beforeEach(() => {
    localValues.clear();
  });

  it('writes a database dump IndexedDB can hold rather than localStorage, which cannot', async () => {
    const idb = installFakeIndexedDb();

    await writeWebBackupPayload('abc', '{"big":true}');

    expect(idb.records.get('abc')).toBe('{"big":true}');
    expect(localValues.size).toBe(0);
    await expect(readWebBackupPayload('abc')).resolves.toBe('{"big":true}');
    await expect(hasWebBackupPayload('abc')).resolves.toBe(true);
  });

  it('still reads and deletes recovery points written by older builds', async () => {
    installFakeIndexedDb();
    localValues.set(`${WEB_BACKUP_DATA_PREFIX}legacy`, '{"old":true}');

    await expect(readWebBackupPayload('legacy')).resolves.toBe('{"old":true}');

    await deleteWebBackupPayload('legacy');

    expect(localValues.has(`${WEB_BACKUP_DATA_PREFIX}legacy`)).toBe(false);
  });

  it('surfaces a quota failure so the caller can evict an older recovery point', async () => {
    const idb = installFakeIndexedDb();
    idb.failWrites = true;

    await expect(writeWebBackupPayload('abc', 'payload')).rejects.toMatchObject({
      name: 'QuotaExceededError',
    });
  });

  it('falls back to localStorage where IndexedDB is unavailable', async () => {
    removeIndexedDb();

    await writeWebBackupPayload('abc', 'payload');

    expect(localValues.get(`${WEB_BACKUP_DATA_PREFIX}abc`)).toBe('payload');
    await expect(readWebBackupPayload('abc')).resolves.toBe('payload');
  });
});
