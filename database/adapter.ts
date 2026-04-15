import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { documentDirectory } from 'expo-file-system/legacy';
import { openDatabaseSync } from 'expo-sqlite';
import { Platform } from 'react-native';

import { migrations } from './migrations';
import { createPreMigrationBackup } from './preMigrationBackup';
import { schema } from './schema';

// Returns the directory where WatermelonDB's JSI adapter stores its database.
// See exportDb.ts wdbDir() for the full explanation.
function wdbDir(): string {
  const base = (documentDirectory ?? '').replace(/^file:\/\//, '').replace(/\/$/, '');
  return Platform.OS === 'android' ? base.replace(/\/files$/, '') : base;
}

// Read the current DB version before WatermelonDB opens its connection, so we
// can pass accurate fromVersion/toVersion to the pre-migration backup.
function readCurrentDbVersion(): number | null {
  try {
    const db = openDatabaseSync('musclog.db', undefined, wdbDir());
    const result = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
    db.closeSync();
    return result?.user_version ?? null;
  } catch {
    return null;
  }
}

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
  dbName: 'musclog',
  jsi: true,
  migrationEvents: {
    onStart: () => {
      createPreMigrationBackup({ fromVersion: currentDbVersion, toVersion: schema.version }).catch(
        (error) => {
          console.warn('[PreMigrationBackup] onStart callback failed:', error);
        }
      );
    },
    onError: () => {
      console.warn('[SQLiteMigration] Migration failed');
    },
    onSuccess: () => {
      console.log('[SQLiteMigration] Migration completed');
    },
  },
});
