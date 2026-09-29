/**
 * Storage for web recovery-point payloads (web only — imported from `preMigrationBackup.web.ts`).
 *
 * These payloads are full database dumps. `localStorage` caps an origin at ~5 MB and counts
 * UTF-16 code units, so it tops out around 2.5M characters — less than one real user's export.
 * Storing dumps there made `createPreExerciseCatalogueBackup()` fail with
 * `QuotaExceededError` on every boot once a database was big enough to matter, which
 * permanently blocked `LegacyExerciseCatalogueMigration` on web (see `FIXES.md`). IndexedDB has
 * no such cap, so payloads live there and only the small metadata index stays in localStorage.
 *
 * Payloads written by older builds are still read back from localStorage, and deletes clear
 * both stores, so an upgrade keeps every recovery point it already had.
 */

import { WEB_BACKUP_DATA_PREFIX } from '@/constants/exportImport';

const IDB_NAME = 'musclog_web_backups';
const IDB_VERSION = 1;
const IDB_STORE = 'payloads';

function getIndexedDb(): IDBFactory | null {
  return typeof indexedDB !== 'undefined' ? indexedDB : null;
}

function legacyKey(key: string): string {
  return `${WEB_BACKUP_DATA_PREFIX}${key}`;
}

function readLegacyPayload(key: string): null | string {
  try {
    return localStorage.getItem(legacyKey(key));
  } catch {
    return null;
  }
}

function removeLegacyPayload(key: string): void {
  try {
    localStorage.removeItem(legacyKey(key));
  } catch {
    // A payload we cannot reach is already unreadable; the index drops it either way.
  }
}

function openDatabase(): Promise<IDBDatabase> {
  const factory = getIndexedDb();
  if (!factory) {
    return Promise.reject(new Error('IndexedDB is not available'));
  }

  return new Promise((resolve, reject) => {
    const request = factory.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IDB_STORE)) {
        request.result.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open web backup store'));
    request.onblocked = () => reject(new Error('Web backup store is blocked by another tab'));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE, mode);
        const request = operation(transaction.objectStore(IDB_STORE));

        // The quota error surfaces on the transaction, not the request, when the write
        // itself is what exceeds the origin's budget — so both paths have to reject.
        request.onerror = () => reject(request.error ?? new Error('Web backup store failed'));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('Web backup store transaction aborted'));
        transaction.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
      })
  );
}

/** Read a payload, falling back to the pre-IndexedDB localStorage location. */
export async function readWebBackupPayload(key: string): Promise<null | string> {
  if (getIndexedDb()) {
    try {
      const stored = await runTransaction<unknown>('readonly', (store) => store.get(key));
      if (typeof stored === 'string') {
        return stored;
      }
    } catch {
      // Fall through to the legacy location rather than losing an older recovery point.
    }
  }

  return readLegacyPayload(key);
}

/** True when the payload already exists in either store. */
export async function hasWebBackupPayload(key: string): Promise<boolean> {
  return (await readWebBackupPayload(key)) !== null;
}

/** Persist a payload. Rejects (typically with `QuotaExceededError`) when it does not fit. */
export async function writeWebBackupPayload(key: string, content: string): Promise<void> {
  if (getIndexedDb()) {
    await runTransaction('readwrite', (store) => store.put(content, key));
    return;
  }

  localStorage.setItem(legacyKey(key), content);
}

/** Drop a payload from both the current and the legacy location. */
export async function deleteWebBackupPayload(key: string): Promise<void> {
  removeLegacyPayload(key);

  if (!getIndexedDb()) {
    return;
  }

  try {
    await runTransaction('readwrite', (store) => store.delete(key));
  } catch {
    // An unreachable store cannot hold the payload back from being re-created later.
  }
}
