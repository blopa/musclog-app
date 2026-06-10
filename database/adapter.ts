import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import * as Sentry from '@sentry/react-native';
import { openDatabaseSync } from 'expo-sqlite';

import { DATABASE_NAME } from '@/constants/database';
import { initializeSentry } from '@/sentry-init';

import { captureBootDbFileStats } from './dbBootStats';
import { wdbDir } from './dbPath';
import { migrations } from './migrations';
import { createPreMigrationBackup } from './preMigrationBackup';
import { schema } from './schema';

function readCurrentDbVersion(): number | null {
  try {
    const db = openDatabaseSync(`${DATABASE_NAME}.db`, undefined, wdbDir());
    const result = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
    db.closeSync();
    return result?.user_version ?? null;
  } catch {
    return null;
  }
}

// Must run before readCurrentDbVersion(): closing that connection checkpoints
// the WAL, and we need the pre-checkpoint WAL size for loss diagnostics.
captureBootDbFileStats();

const currentDbVersion = readCurrentDbVersion();

// Note: The JSI SQLiteAdapter warning ("JSI SQLiteAdapter not available... falling back to asynchronous operation")
// is expected and harmless in the following scenarios:
// 1. When using remote JS debugging (Chrome DevTools) - JSI cannot work with remote debugging
// 2. When using Expo Go - custom native modules are not available in Expo Go
// 3. In development builds, ensure you're using a development client (not Expo Go) and have rebuilt native code
// The adapter will automatically fall back to async mode, which is slower but functional.
// For production builds, ensure native code is properly compiled with JSI support.
export default new SQLiteAdapter({
  schema,
  migrations,
  dbName: DATABASE_NAME,
  jsi: true,
  migrationEvents: {
    onStart: () => {
      createPreMigrationBackup({ fromVersion: currentDbVersion, toVersion: schema.version }).catch(
        (error) => {
          console.warn('[PreMigrationBackup] onStart callback failed:', error);
        }
      );
    },
    onError: (error: Error) => {
      console.warn('[SQLiteMigration] Migration failed', error);
      initializeSentry();
      Sentry.captureException(error, {
        data: {
          context: 'SQLiteMigration.onError',
          fromVersion: currentDbVersion,
          toVersion: schema.version,
        },
      });
    },
    onSuccess: () => {
      console.log('[SQLiteMigration] Migration completed');
    },
  },
});
