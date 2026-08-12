# Pre-Migration Backup (Native + Web)

> **Status: implemented.** This document describes how pre-migration backups
> actually work today. It supersedes the original plan, which proposed a bare
> LokiJS instance + browser-download approach for web — that approach was not
> taken. The web path stores backups in `localStorage` (surfaced by
> `LocalBackupsModal`), and both platforms share one serializer.

## Why a pre-migration backup exists

A schema migration or destructive runtime data cutover can fail or corrupt data.
Capturing a snapshot immediately before existing rows are changed gives the user
a restore point. Schema-migration and pre-restore backups are best-effort. A
destructive data cutover may instead make its backup mandatory; the exercise
catalogue replacement does so and leaves the retired catalogue untouched when
backup creation fails.

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
2. If `0 < fromVersion < toVersion` and `migrationSafety.ts` finds a pending step
   that can touch existing rows, it uses synchronous `VACUUM INTO` to write a
   consistent standalone `.db` copy. Purely additive schema changes skip the
   snapshot. Sync is required: the copy must finish before the adapter opens the
   file and the migration starts mutating it.
3. It passes the completed copy to `registerPreMigrationDbBackup()` and closes
   the raw connection. `adapter.ts`'s `migrationEvents.onStart` remains a
   deliberate no-op — never open `expo-sqlite` from a migration callback.

Registration is fire-and-forget at module-eval, so the in-flight promise is
tracked and awaited via `waitForPreMigrationBackup()` before the boot sequence
proceeds. It captures AsyncStorage in a sidecar and records both files in the
`pre_migration_backups_v1` index (kept to the 3 most recent). Conversion to the
portable JSON export format is deferred until restore or download, avoiding a
minutes-long upgrade boot for a large database.

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
   3). On quota exhaustion it evicts the oldest backup one at a time, committing
   each smaller index before deleting that payload, while protecting the newest
   recovery point until the replacement payload and metadata are committed. If the
   replacement still cannot fit, it aborts and leaves that protected backup intact.
   Backups are surfaced for restore/export/delete by `LocalBackupsModal`.
4. Always advances the stored version in `finally`, so a failed dump doesn't
   retry forever.

## Runtime data cutovers

The legacy exercise-catalogue replacement runs after WatermelonDB is live, so it
cannot use the pre-adapter raw SQLite path. Once the new catalogue is complete,
but before any retired exercise or reference is changed,
`LegacyExerciseCatalogueMigration` calls
`createPreExerciseCatalogueBackup()`. That function uses the live
WatermelonDB-backed `dumpDatabase()` path on native and the normal LokiJS export
path on web, then indexes the portable JSON with reason `exercise-catalogue`.

This backup is required: writing the file and its metadata must both succeed
before the migration enters its writer. Failure is reported, the migration
rejects, and boot can retry later with every retired row still intact. The backup
is labeled “Before exercise catalogue update” in `LocalBackupsModal`. On web,
quota recovery never deletes the last existing recovery point to make room for
this required replacement.

## Shared serialization core

Both platforms converge on `dumpRowsToJson` in `database/exportDbCore.ts`, which
takes a `CapturedTableRows` map and produces the export JSON: it applies the
`settings` exclusion list, decrypts `user_metrics` / `nutrition_logs` /
`saved_for_later_*` fields via `database/encryptionHelpers.ts`, appends the
filtered AsyncStorage dump, and optionally encrypts with a passphrase. The only
difference between callers is **how rows are captured**:

| Caller                                              | Row source                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| Native live export / pre-restore / exercise cutover | `dumpDatabaseWithQueryRunner` → `rawQueryViaWatermelon` (live WMDB) |
| Native pre-migration                                | `preMigrationCapture.ts` raw `expo-sqlite` (pre-adapter, sync)      |
| Web (all paths)                                     | `exportDb.web.ts` reads LokiJS rows (`getRawRowsFromLoki`)          |

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
4. Exercise cutover: start with retired `source='app'` rows, allow boot to finish,
   and confirm Settings → Local Backups lists “Before exercise catalogue update”.
   Simulate a write/index failure and confirm the retired rows and their foreign
   keys remain unchanged.
