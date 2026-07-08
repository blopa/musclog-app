import { handleError } from '@/utils/handleError';

import { captureAsyncStorageDump } from './asyncStorageBackup';
import {
  type DumpDatabaseOptions,
  dumpDatabaseWithQueryRunner,
  type ExportDump,
} from './exportDbCore';
import { rawQueryViaWatermelon } from './wmdbRaw';

export type { ExportDump };

/**
 * Dump the entire database to a JSON-serializable object using raw SQL against
 * whatever tables actually exist (schema-independent), executed through
 * WatermelonDB's own connection (`rawQueryViaWatermelon`).
 *
 * It runs through WatermelonDB on purpose: this path used to open a raw
 * expo-sqlite connection, whose close unlinked the live WAL and silently lost
 * committed data (June 2026 incident — see docs/DATABASE_DURABILITY.md). Never
 * reintroduce a second SQLite connection to `musclog.db` here.
 *
 * Encrypted fields in user_metrics, nutrition_logs, saved_for_later_groups and
 * saved_for_later_items are exported decrypted so the backup is device-independent.
 * API key settings are excluded.
 */
export async function dumpDatabase(
  encryptionPhrase?: string,
  options: Omit<DumpDatabaseOptions, 'asyncStorageData'> = {}
): Promise<string> {
  try {
    // Live exports always embed the current AsyncStorage state. Snapshot
    // conversions pass their captured sidecar instead (sqliteBackupConvert.ts).
    return await dumpDatabaseWithQueryRunner(rawQueryViaWatermelon, encryptionPhrase, {
      ...options,
      asyncStorageData: await captureAsyncStorageDump(),
    });
  } catch (err) {
    await handleError(err, 'dumpDatabase');
    throw err;
  }
}
