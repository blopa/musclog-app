import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import * as Sentry from '@sentry/react-native';

import { DATABASE_NAME } from '@/constants/database';
import { initializeSentry } from '@/sentry-init';

import { captureBootDbFileStats } from './dbBootStats';
import { migrations } from './migrations';
import { preparePreMigrationBackupBeforeAdapter } from './preMigrationCapture';
import { schema } from './schema';

// Capture WAL/SHM diagnostics, then capture any needed pre-migration backup
// before WatermelonDB opens its connection. This is the only safe time to read
// musclog.db with expo-sqlite: once WatermelonDB is live, closing a second
// SQLite library connection can unlink the WAL beneath it and lose subsequent
// commits on process kill.
//
// Must run before preparePreMigrationBackupBeforeAdapter(): closing that connection checkpoints
// the WAL, and we need the pre-checkpoint WAL size for loss diagnostics.
captureBootDbFileStats();

const currentDbVersion = preparePreMigrationBackupBeforeAdapter(schema.version);

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
      // Pre-migration rows are captured before adapter creation; never open
      // expo-sqlite from WatermelonDB migration callbacks.
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
