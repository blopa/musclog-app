// Web has no raw `.db` pre-migration snapshots — the web adapter is LokiJS and its
// pre-migration backups are already JSON (see preMigrationBackup.web.ts). These
// stubs exist only so the shared LocalBackupsModal import resolves on web; they are
// never reached because no web backup carries `format: 'sqlite'`.

export async function convertSqliteBackupToJson(): Promise<string> {
  throw new Error('SQLite backup snapshots are not supported on web');
}

export async function exportSqliteBackupAsJsonFile(): Promise<string> {
  throw new Error('SQLite backup snapshots are not supported on web');
}
