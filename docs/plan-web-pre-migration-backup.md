# Pre-Migration Backup (Native + Web)

> **Status: implemented.** This document describes how pre-migration backups
> actually work today. It supersedes the original plan, which proposed a bare
> LokiJS instance + browser-download approach for web — that approach was not
> taken. The web path stores backups in `localStorage` (surfaced by
> `LocalBackupsModal`), and both platforms share one serializer.

## Why a pre-migration backup exists

A schema migration can fail or corrupt data. Capturing a full JSON snapshot of
the database immediately before the migration runs gives the user a restore
point. Backups are best-effort: a failure to create one never blocks the
migration or the app.

## The hard constraint that shapes the native design

`expo-sqlite` and WatermelonDB bundle **separate** SQLite libraries. POSIX
advisory locks never conflict between connections of the same process, so when
an `expo-sqlite` connection to `musclog.db` **closes**, it concludes it is the
last connection, checkpoints, and unlinks the `-wal`/`-shm` files out from under
WatermelonDB's live connection — silently losing any commits WatermelonDB made
into the now-unlinked WAL when the process is later killed (June 2026 field
incident). See `database/wmdbRaw.ts` and the "Raw SQL" rule in `AGENTS.md`.

The consequence: a raw `expo-sqlite` read of `musclog.db` is **only** safe
before WatermelonDB opens the file. That is exactly the pre-migration window, so
the native capture runs there and nowhere else.

## Native: pre-adapter synchronous capture

`database/preMigrationCapture.ts` is the **only** module allowed to open
`musclog.db` with `expo-sqlite`, and it is imported solely by
`database/adapter.ts` at module-eval time, before `new SQLiteAdapter`:

1. `preparePreMigrationBackupBeforeAdapter(toVersion)` opens a raw connection and
   reads `PRAGMA user_version` (`fromVersion`).
2. If `0 < fromVersion < toVersion`, it captures every table in `RESTORE_ORDER`
   **synchronously** (`db.getAllSync`) into memory. Sync is required: the
   snapshot must finish before the adapter opens the file and the migration
   starts mutating it. This is bounded to migration boots only.
3. It hands the rows to `persistCapturedPreMigrationBackup()` (in
   `preMigrationBackup.ts`), then closes the raw connection. `adapter.ts`'s
   `migrationEvents.onStart` is a deliberate no-op — never open `expo-sqlite`
   from a migration callback.

`persistCapturedPreMigrationBackup` is fire-and-forget at module-eval, so the
in-flight promise is tracked and awaited via `waitForPreMigrationBackup()` before
the boot sequence proceeds (see `database/dbBootCoordinator.ts`). It serializes
the captured rows with `dumpRowsToJson` and writes
`pre-migration-v{from}-to-v{to}.json` to the cache directory, tracking the file
in the `pre_migration_backups_v1` AsyncStorage index (kept to the 3 most recent).

`database/preMigrationBackup.ts` itself imports **no** `expo-sqlite` — keeping
the dangerous open isolated in `preMigrationCapture.ts` makes the invariant
structural rather than advisory.

## Web: localStorage snapshot via WatermelonDB

Web has no pre-adapter window (LokiJS has no migration-event hook), but it does
not need one: **LokiJS schema migrations only create new empty collections — they
never modify existing rows**, and `dumpDatabase()` queues on WatermelonDB until
its async `setUp()` (including migration) completes. So a dump taken at any point
during startup captures the correct user data.

`runWebPreMigrationBackupIfNeeded()` in `database/preMigrationBackup.web.ts`
(called from the web root layout before DB-touching components render):

1. Skips entirely on static export (no IndexedDB persistence).
2. Compares the `musclog_last_db_version` localStorage marker against
   `CURRENT_DATABASE_VERSION`. Fresh install (no marker) just records the version;
   already-current is a no-op.
3. On a version bump, calls `dumpDatabase()` (web), computes a SHA-256 content
   hash, and stores the JSON under `localStorage[<WEB_BACKUP_DATA_PREFIX><hash>]`
   plus a metadata entry in the `musclog_pre_migration_backups_v1` index (kept to
   3, with quota-exceeded fallback that clears older backups). Backups are
   surfaced for restore/export/delete by `LocalBackupsModal`.
4. Always advances the stored version in `finally`, so a failed dump doesn't
   retry forever.

## Shared serialization core

Both platforms converge on `dumpRowsToJson` in `database/exportDbCore.ts`, which
takes a `CapturedTableRows` map and produces the export JSON: it applies the
`settings` exclusion list, decrypts `user_metrics` / `nutrition_logs` /
`saved_for_later_*` fields via `database/encryptionHelpers.ts`, appends the
filtered AsyncStorage dump, and optionally encrypts with a passphrase. The only
difference between callers is **how rows are captured**:

| Caller                           | Row source                                                          |
| -------------------------------- | ------------------------------------------------------------------- |
| Native live export / pre-restore | `dumpDatabaseWithQueryRunner` → `rawQueryViaWatermelon` (live WMDB) |
| Native pre-migration             | `preMigrationCapture.ts` raw `expo-sqlite` (pre-adapter, sync)      |
| Web (all paths)                  | `exportDb.web.ts` reads LokiJS rows (`getRawRowsFromLoki`)          |

This is why the export format is identical across native export, web export, and
either platform's pre-migration backup, and why a backup taken on one platform
restores on the other.

## Verification

1. Native: bump `CURRENT_DATABASE_VERSION`, add a migration, install over an old
   build → confirm a `pre-migration-v{from}-to-v{to}.json` appears in the cache
   index and `LocalBackupsModal` lists it; confirm the durability "rescue
   checkpoint" at boot (see `dbDurability.ts`) leaves the `-wal` intact.
2. Web: set `musclog_last_db_version` in localStorage below
   `CURRENT_DATABASE_VERSION`, reload → confirm a hashed backup entry is written
   and listed in `LocalBackupsModal`.
3. Cross-platform: import a web-created backup on native (and vice versa) — data
   restores correctly, with no API keys in `settings` and decrypted metric/log
   values.
