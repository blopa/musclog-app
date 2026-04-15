# Plan: Web Pre-Migration Backup

## Context

The native adapter (`database/adapter.ts`) has `migrationEvents.onStart` which fires
`createPreMigrationBackup()` before any migration SQL runs. The web adapter
(`database/adapter.web.ts`) uses LokiJS which has no equivalent migration event hook.

Additionally, both `exportDb.ts` (native) and `exportDb.web.ts` (web) should avoid
going through the WatermelonDB singleton during a pre-migration backup — once WatermelonDB
calls `setUp()` internally it immediately runs pending migrations, so there is no safe
window to read data through it.

This plan covers how to add a web pre-migration backup without triggering migrations, and
what changes `exportDb.web.ts` requires to support raw reads.

---

## LokiJS Storage Internals (Verified)

These are the concrete facts needed for implementation:

| Detail | Value |
|--------|-------|
| LokiJS package | `@nozbe/lokijs` (v1.5.12-wmelon6) |
| IndexedDB database name | `"musclog"` (from `adapter.web.ts`) |
| IndexedDB object store | `"LokiIncrementalData"` (hardcoded in `IncrementalIndexedDBAdapter`) |
| Schema version key | `_loki_schema_version` stored in the `local_storage` Loki collection |
| Migration trigger | `_databaseVersion < schema.version` in `DatabaseDriver.js` |
| Data format per collection | Array of plain objects (same snake_case column names as SQLite `_raw`) |
| LokiJS-internal fields | `$loki` (row id) and `meta` (timestamps) — must be stripped from export rows |

When `useIncrementalIndexedDB: false` (i.e. `isStaticExport: true`), LokiJS does not
persist to IndexedDB at all — the database is fully in-memory and reset on each page
load. No backup is needed for that case.

---

## Approach: Bare Loki Instance + App-Level Guard

### Why not hook into the adapter/database-instance?

`adapter.web.ts` and `database-instance.ts` both run synchronously at module import
time. WatermelonDB calls `setUp()` (and therefore migrations) asynchronously but
immediately after the `Database` object is constructed. There is no exposed callback
between construction and migration run — adding one would require forking WatermelonDB.

### Solution: App-level async guard before any database use

1. Call `runWebPreMigrationBackupIfNeeded()` from the app's root layout **before** any
   component that touches the database is rendered.
2. The root layout shows a loading screen until the check resolves.
3. Only then does the normal app render begin — which triggers WatermelonDB init and
   migrations.

This is the same pattern used for other async startup tasks (e.g. seeding, health
permission requests).

---

## Files to Create / Modify

### New: `database/preMigrationBackup.web.ts`

Exports:

```
runWebPreMigrationBackupIfNeeded(): Promise<void>
```

**Implementation steps:**

1. **Guard for static exports**: If `isStaticExport` is true, return immediately (no
   IndexedDB persistence, nothing to back up).

2. **Version check via bare Loki**:
   ```
   import Loki from '@nozbe/lokijs';
   import IncrementalIndexedDBAdapter from '@nozbe/lokijs/src/incremental-indexeddb-adapter';

   const adapter = new IncrementalIndexedDBAdapter();
   const loki = new Loki('musclog', { adapter, autosave: false });
   await new Promise((resolve) => loki.loadDatabase({}, resolve));

   const schemaVersion = loki
     .getCollection('local_storage')
     ?.by('key', '_loki_schema_version')
     ?.value ?? null;
   ```

3. **Skip if no migration needed**: If `schemaVersion === null` (fresh install) or
   `Number(schemaVersion) >= CURRENT_DATABASE_VERSION`, return.

4. **Dump data from bare Loki** (reuse helper — see `exportDb.web.ts` changes below):
   ```
   const jsonString = await dumpDatabaseFromLoki(loki);
   ```

5. **Trigger browser download**:
   ```
   const blob = new Blob([jsonString], { type: 'application/json' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `pre-migration-v${schemaVersion}-to-v${CURRENT_DATABASE_VERSION}.json`;
   a.click();
   URL.revokeObjectURL(url);
   ```

6. Store a record in `localStorage` (not AsyncStorage — too early for RN) noting the
   backup was done for this version pair, to avoid re-downloading on refresh.

---

### Update: `database/exportDb.web.ts`

Add and export a new function:

```
dumpDatabaseFromLoki(loki: LokiConstructor): Promise<string>
```

This is the raw-Loki equivalent of `dumpDatabase()`:

1. For each table in `RESTORE_ORDER`:
   - `const col = loki.getCollection(tableName)` — skip if null (table doesn't exist yet)
   - `const rows = col.find()` — returns all LokiJS records
   - Strip LokiJS internal fields from each row: `const { $loki, meta, ...row } = record`
   - Filter `_status === 'deleted'` rows (WatermelonDB soft-deletes)
   
2. Apply same special-casing as native `exportDb.ts`:
   - **`settings`**: filter out `SETTINGS_EXCLUDED_TYPES`
   - **`user_metrics`**: decrypt `value` + `unit` via `decryptNumber`/`decryptOptionalString`
   - **`nutrition_logs`**: decrypt all 7 encrypted columns; re-stringify `logged_micros_json`

3. AsyncStorage dump (same as current — `getAllKeys`, filter exclusions, `multiGet`)

4. Return `JSON.stringify(dbData, null, 2)` (optionally encrypted if `encryptionPhrase`
   is passed — same as current `dumpDatabase`)

The existing `dumpDatabase(encryptionPhrase?)` in `exportDb.web.ts` (used for
user-triggered exports) can keep using WatermelonDB — by the time a user taps "Export"
the database is already fully initialized and post-migration. **Do not change the
existing `dumpDatabase` function.**

---

### Update: `app/_layout.tsx` (or `app/_layout.web.tsx`)

In the root layout's startup effect (before any database-touching components render):

```typescript
import { runWebPreMigrationBackupIfNeeded } from '@/database/preMigrationBackup.web';

// In the root layout component, before rendering children:
const [dbReady, setDbReady] = useState(false);

useEffect(() => {
  runWebPreMigrationBackupIfNeeded().finally(() => setDbReady(true));
}, []);

if (!dbReady) return <SplashScreen />;
```

If a `.web.tsx` layout split already exists or is preferred, add this only there to avoid
any native impact.

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Static export (`isStaticExport: true`) | Skip entirely — no IndexedDB, no data to back up |
| Fresh install (no `_loki_schema_version`) | Skip — no pre-existing data |
| User already backed up this version pair | Skip (check `localStorage` guard key) |
| Backup download blocked by browser | Log warning; proceed with migration anyway (backup is best-effort, like native) |
| `useIncrementalIndexedDB: false` with non-static export | Currently not possible in config, but if added later: adapt to use `LokiMemoryAdapter` instead |

---

## Verification

1. In browser DevTools, manually set `_loki_schema_version` in the `LokiIncrementalData`
   IDB store to a value less than `CURRENT_DATABASE_VERSION`, then reload — browser
   should auto-download a `.json` backup before the app finishes loading.
2. Confirm the downloaded JSON matches the format produced by a manual Settings → Export
   on native (same keys, decrypted values, no API keys in settings).
3. Import the backup file on native via Settings → Import — data should restore correctly.
4. Confirm user-triggered web export (Settings → Export on web) still works and produces
   the same format.
