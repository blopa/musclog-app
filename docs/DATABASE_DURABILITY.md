# Database Durability: the WAL-unlink data-loss incident

> **Read this before opening any raw SQLite connection to `musclog.db`, or
> touching the export / backup / boot / durability code.** It explains a
> silent, catastrophic data-loss bug, its root cause, and the rules that prevent
> it from recurring. The short version: **never have a second SQLite library
> hold a connection to `musclog.db` while WatermelonDB is live.**

## What happened (June 2026 field incident)

Users reported that nutrition logs they had visibly saved — and could still see
in the UI during the session — were **completely gone** after the app was closed
and reopened hours later. Not soft-deleted: there were no WatermelonDB tombstones
(`_status = 'deleted'`), no error, no Sentry event. The rows simply did not exist
in the database on the next launch. It reproduced most reliably when the OS killed
the backgrounded process under memory pressure (e.g. the user opened a heavy game,
then used "close all apps").

Forensics on user exports confirmed: a boot found fewer `nutrition_logs` than the
previous session had committed, and the on-disk `-wal`/`-shm` files were **absent**
at boot (`bootFileStats: { walBytes: null, shmBytes: null }`) — even though the
data had been committed. The production build was running the WatermelonDB
**bridge** adapter (`adapterMode: "asynchronous"`), i.e. Android's framework
SQLite, not JSI.

## Root cause: two SQLite libraries, one file

The app links **two independent SQLite libraries** in the same process:

- **WatermelonDB**'s bundled SQLite (its JSI or bridge adapter), which holds the
  long-lived connection to `musclog.db` for the app's entire lifetime.
- **`expo-sqlite`**, used in a few places for raw reads (exports, backups,
  version probes, repair).

SQLite on POSIX uses **advisory file locks, which never conflict between
connections opened by the same process.** So when an `expo-sqlite` connection to
`musclog.db` **closes**, that library concludes it is the _last_ connection to the
file. It performs a checkpoint and then **unlinks the `-wal` and `-shm` files** —
out from under WatermelonDB's still-open connection.

WatermelonDB doesn't notice. It keeps appending committed transactions to the
WAL, but that WAL is now an **unlinked inode**: the data is reachable only through
WatermelonDB's open file descriptor, and it is **never** folded back into the main
`musclog.db` file. When the process is killed, the kernel frees the unlinked
inode and every commit written after the unlink **silently vanishes**. There is
no error and no tombstone because, from SQLite's point of view, nothing was
deleted — the writes were simply never durable.

This is documented SQLite behavior; see ["How To Corrupt An SQLite Database
File"](https://www.sqlite.org/howtocorrupt.html), §2.1 (multiple processes/links)
and the WAL docs on checkpointing and the "last connection" unlink.

### Why it looked random

The data survived in exactly the sessions where a _second_ raw connection had
also been opened **and closed cleanly while the app was still alive** (a manual
export, a pre-migration backup) — because that clean close checkpointed the WAL
back into the main file first. Sessions with no such checkpoint, ended by a
process kill, lost their tail. That made it look intermittent and unrelated to any
single user action.

## The rules (do not regress these)

1. **Never open `expo-sqlite` (or any second SQLite library) on `musclog.db`
   while WatermelonDB is live.** Not for a "quick read", not in a `try/finally`,
   not "just this once". The danger is the _close_, and you cannot close safely.

2. **Run raw SQL through WatermelonDB's own connection.** Use
   `rawQueryViaWatermelon()` in `database/wmdbRaw.ts` for reads/PRAGMAs, and
   `database.adapter.unsafeExecute({ sqls })` for writes. Because these use the
   live connection, a `PRAGMA wal_checkpoint` through them even _rescues_ frames
   from an already-unlinked WAL by copying them into the main file.

3. **The one sanctioned `expo-sqlite` open on `musclog.db`** is
   `preparePreMigrationBackupBeforeAdapter()` in `database/preMigrationCapture.ts`,
   imported solely by `database/adapter.ts` **before `new SQLiteAdapter`**. It is
   safe only because WatermelonDB has not opened the file yet. It opens, reads
   `user_version`, and — **only when a data-touching migration is pending**
   (purely-additive migrations — `createTable` / `addColumns` — skip it; see
   `database/migrationSafety.ts`) — writes a consistent `.db` snapshot with
   **`VACUUM INTO`** (one standalone file, WAL folded in, so a session killed with
   uncheckpointed commits is captured correctly), then closes — all before the
   adapter exists. `VACUUM INTO` is near-instant vs. reading every row into JSON,
   which stalled upgrade boots for minutes. `database/preMigrationBackup.ts`
   registers that `.db` snapshot and, when captured successfully, an
   AsyncStorage sidecar from the same boot moment; the `.db` → JSON conversion
   is deferred to restore/download time (`database/sqliteBackupConvert.ts`,
   which opens the _copy_ — a different file, rule #4 — never the live DB — and
   injects the captured sidecar instead of reading live AsyncStorage, or omits
   AsyncStorage if no sidecar exists). Keep this isolated:
   `database/preMigrationBackup.ts` (runtime backup paths) imports **no**
   `expo-sqlite`, so the invariant is structural, not advisory.

4. **A different database file is fine.** `database/services/MigrationService.ts`
   opens the _legacy_ `workoutLoggerDatabase.db` with `expo-sqlite`. That's a
   separate file WatermelonDB never touches, so there is no shared-file lock
   conflict. The rule is specifically about `musclog.db`.

5. **Checkpoint on background.** `dbDurability.ts` runs
   `PRAGMA wal_checkpoint(TRUNCATE)` through the live connection on every
   `AppState → background`, so committed data is folded into the main file before
   the process can be killed. It also runs a rescue checkpoint once at boot.

6. **Loss detection stays on.** `dbDurability.ts` keeps a `nutrition_logs` row
   count baseline and reports to Sentry when a boot finds fewer rows than the
   previous session left (`ENABLE_DB_LOSS_DETECTION`). This is how the incident
   was confirmed; don't remove it without a replacement signal.

## Where this is enforced / referenced

- `AGENTS.md` → "Raw SQL — never open expo-sqlite on `musclog.db`" rule.
- `database/wmdbRaw.ts` — the canonical safe raw-query helper.
- `database/preMigrationCapture.ts` — the single sanctioned pre-adapter open.
- `database/dbDurability.ts` — background checkpoint + loss detection.
- `database/adapter.ts` — pre-adapter capture wiring; `onStart` is a no-op.
- `docs/plan-web-pre-migration-backup.md` — how this constrains the backup design.
