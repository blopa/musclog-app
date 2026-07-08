import { RESTORE_ORDER } from '@/constants/exportImport';

import { captureAsyncStorageDump } from './asyncStorageBackup';
import { database } from './database-instance';
import {
  type CapturedTableRows,
  type DumpDatabaseOptions,
  dumpRowsToJson,
  type ExportDump,
} from './exportDbCore';

export type { ExportDump };

function getRawRow(record: { _raw?: unknown }): Record<string, unknown> {
  const raw = (record as { _raw?: Record<string, unknown> })._raw;
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  return { ...raw };
}

function stripLokiMetadata(row: Record<string, unknown>): Record<string, unknown> {
  const raw = { ...row };
  delete raw.$loki;
  delete raw.meta;
  return raw;
}

function getRawRowsFromLoki(tableName: string): Record<string, unknown>[] | null {
  const adapter = database.adapter as any;
  const loki = adapter?.underlyingAdapter?._driver?.loki ?? adapter?._driver?.loki;
  const collection = loki?.getCollection?.(tableName);

  if (!collection?.data) {
    return null;
  }

  return collection.data.map((row: Record<string, unknown>) => stripLokiMetadata(row));
}

/**
 * Dump the entire database to a JSON-serializable object.
 * Encrypted fields in user_metrics, nutrition_logs, saved_for_later_groups and
 * saved_for_later_items are exported decrypted so the backup is device-independent.
 * API key settings are excluded.
 */
export async function dumpDatabase(
  encryptionPhrase?: string,
  options: Omit<DumpDatabaseOptions, 'asyncStorageData'> = {}
): Promise<string> {
  const includeDeletedRecords = options.includeDeletedRecords ?? true;
  const capturedRows: CapturedTableRows = {};

  for (const tableName of RESTORE_ORDER) {
    const collection = database.get(tableName as any);
    const records = await collection.query().fetch();
    // WatermelonDB's query API filters out internal tombstones (`_status = 'deleted'`).
    // When requested, read Loki directly so exports can preserve those rows.
    const rows = includeDeletedRecords
      ? (getRawRowsFromLoki(tableName) ?? records.map((r) => getRawRow(r)))
      : records.map((r) => getRawRow(r));

    capturedRows[tableName] = rows;
  }

  // Live exports always embed the current AsyncStorage state (see exportDb.ts).
  return dumpRowsToJson(capturedRows, encryptionPhrase, {
    ...options,
    asyncStorageData: await captureAsyncStorageDump(),
  });
}
