import { Q } from '@nozbe/watermelondb';

import { database } from './database-instance';
import type { RawQueryRunner } from './exportDbCore';

/**
 * Runs raw SQL through WatermelonDB's OWN connection — never expo-sqlite.
 *
 * Why this matters: expo-sqlite and WatermelonDB each bundle their own SQLite
 * library. POSIX advisory locks never conflict between connections of the same
 * process, so when an expo-sqlite connection to musclog.db closes, it always
 * concludes it is the "last connection", checkpoints, and unlinks the -wal and
 * -shm files out from under WatermelonDB's live connection. WatermelonDB then
 * keeps committing into the unlinked inode — data that silently evaporates the
 * moment the process is killed (field incident: lost nutrition logs, June 2026).
 *
 * Any raw SQL that must run while the app is up therefore goes through this
 * helper. Opening expo-sqlite on musclog.db is only safe in the native
 * pre-adapter path (preparePreMigrationBackupBeforeAdapter in
 * preMigrationCapture.ts), before WatermelonDB has opened the file.
 */
// 'settings' only satisfies the adapter's validateTable check; the SQL is arbitrary.
export const rawQueryViaWatermelon: RawQueryRunner = (sql, args = []) =>
  database.get('settings').query(Q.unsafeSqlQuery(sql, args)).unsafeFetchRaw();
