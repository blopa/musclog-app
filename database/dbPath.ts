import { documentDirectory } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Returns the directory where WatermelonDB's JSI adapter stores its database file.
 *
 * WatermelonDB does NOT use expo-sqlite's default directory. Its native path logic is:
 *   Android (JSIInstaller.java): context.getDatabasePath(name+".db").getPath().replace("/databases","")
 *             → <appDataRoot>/musclog.db  (i.e. one level above expo-sqlite's files/SQLite/)
 *   iOS (DatabasePlatformIOS.mm): NSDocumentDirectory/name.db
 *             → <Documents>/musclog.db  (expo-sqlite would use <Documents>/SQLite/musclog)
 *
 * The database filename is always `${DATABASE_NAME}.db` (WatermelonDB appends ".db" itself).
 *
 * ⚠️ DANGER: do NOT use this to open `musclog.db` with expo-sqlite while the app
 * is running. A second SQLite library closing its connection unlinks the live
 * WAL and silently loses committed data (see docs/DATABASE_DURABILITY.md). The
 * only sanctioned raw open is the pre-adapter capture in preMigrationCapture.ts;
 * everywhere else use rawQueryViaWatermelon (database/wmdbRaw.ts).
 */
export function wdbDir(): string {
  // documentDirectory:  Android → 'file:///data/user/0/<pkg>/files/'
  //                     iOS    → 'file:///var/mobile/.../Documents/'
  const base = (documentDirectory ?? '').replace(/^file:\/\//, '').replace(/\/$/, '');
  // Android: WatermelonDB stores in the app-data root (parent of 'files/')
  // iOS:     WatermelonDB stores directly in Documents (same dir, no SQLite/ subdir)
  return Platform.OS === 'android' ? base.replace(/\/files$/, '') : base;
}
