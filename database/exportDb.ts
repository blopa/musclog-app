import { handleError } from '@/utils/handleError';

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
  options: DumpDatabaseOptions = {}
): Promise<string> {
  try {
    return await dumpDatabaseWithQueryRunner(rawQueryViaWatermelon, encryptionPhrase, options);
  } catch (err) {
    await handleError(err, 'dumpDatabase');
    throw err;
  }
}
