# Musclog — Fixes and Regression Notes

This file records non-obvious production fixes, their root causes, and the conditions under which a
workaround can be removed. Keep the short guardrails in `AGENTS.md`; keep the incident history here.

## iOS widgets crashed the app at boot: a `null` in a widget snapshot (October 2026)

### Symptom

On an iOS build the app stopped on a red "Exception in HostFunction: <unknown>" thrown from
`createWidget(...)`, before any screen rendered.

### Cause

`expo-widgets` stores a widget's initial props and every timeline entry in the shared App Group
`UserDefaults`, which only accepts property-list values. A JS `null` reaches it as `NSNull`, which
it rejects. `INITIAL_NUTRITION_SNAPSHOT.targets` and `INITIAL_CAMERA_SNAPSHOT.imageUri` were `null`,
and so was the published `targets` whenever there was no goal and `imageUri` whenever the camera
artwork could not be copied.

### Fix

Widget snapshots never contain `null`: the nullable `targets` object was removed (nothing rendered it) and `imageUri` is `''`
when there is no artwork. `widgets/__tests__/widgetSnapshot.test.ts` walks the initial and built
snapshots for nulls. Any new snapshot field must be a string, number, boolean, array or object.

## Giant logo flashing on boot: the splash's classes did not exist yet (October 2026)

### Symptom

For a moment after the native splash, Android showed `assets/logo.png` blown up far past the screen
edges on the dark boot background.

### Cause

`SplashLoading` sized the logo with `className="h-24 w-24"`. The root `/` route (`app/index.tsx`)
renders it before `app/app/_layout.tsx` — the only native importer of `global.css` — has been
evaluated, so NativeWind had no rules for those classes and the 1024px image drew at its intrinsic
size.

### Fix

`SplashLoading` uses inline styles only (like `BootProgressBar` and the root layout, which render at
the same moment) and shows the default theme's app icon at a fixed 128pt. Pinned by
`components/__tests__/splashLoading.test.ts`. Anything rendered from `app/_layout.tsx` or
`app/index.tsx` must not rely on `className`.

## Raw translation keys in the live session: equipment labels built at runtime (October 2026)

### Symptom

Leg Press and cardio exercises showed `workout.exerciseTypes.plate_machine` and
`workout.exerciseTypes.cardio` under the exercise name in the live workout session.

### Cause

`getExerciseTypeTranslationKey` builds the key from the catalogue's `equipmentType` / `mechanicType`
value at runtime. The free-exercise-db import introduced `plate_machine` and `cardio` (and the
mechanic types `stretching`, `plyometric` and `mobility`) with no label, and
`npm run check-translations` only sees literal keys, so nothing flagged them.

### Fix

Labels in all five locales, plus `utils/__tests__/exerciseTranslation.test.ts`, which collects every
distinct type in `data/exercisesData.json` and asserts each locale labels it. A new catalogue value
now fails that test instead of reaching a screen.

## Emptied set fields completed the set at 0 kg / 0 reps (October 2026)

### Symptom

Clearing the weight or reps field of a set in the live session and tapping ✓ completed it without
a word: an emptied weight saved the set at 0 kg, and an emptied reps field saved a performed set of
0 reps — which progression then read as a missed session, and two of them deloaded the lift.
In a comma-decimal locale, "62.5" typed with a dot saved 625 kg.

### Cause

`valuesFromDraft` turned the draft into numbers with `parseLocalizedDecimalString` and `Number`.
The first is lenient on purpose (it reads "" and "abc" as 0 and treats the other separator as
digit grouping) and `Number('')` is 0, so nothing between the inputs and the writer could tell an
emptied field from a typed zero. The writer's own validation only rejects NaN and negatives.

### Fix

`setDraftProblem` (`components/workout/session/setDraft.ts`) checks a set's inputs before it is
completed, with `parseStrictLocalizedNumber` (`utils/localizedDecimalInput.ts`), which accepts a
number only as the locale writes it. A failure names the field in a snackbar and outlines it
(`NumericTextField`'s `invalid`) until the user edits it. Zero reps is refused as well: a set that
was not done is skipped. The Weekly Review targets editor had the same lenient read and now uses
the same strict parser (`components/weeklyReview/targetsDraft.ts`). Validation that decides whether
a value may be SAVED must never use the lenient parser.

## Cycle config observation and transaction failures (October 2026)

Cycle config-only emissions reused the same WatermelonDB model object in React state, leaving decrypted preferences and predictions stale until an unrelated render. The provider now captures the emitted ciphertext in immutable state, triggering immediate decryption for active and paused cycles and discarding obsolete async results.

Cycle writers prepared model mutations without restoring cached values when an adapter batch failed. They now use `commitPrepared` for updates and deletes, and finish reads/encryption before preparation. The legacy encryption migration previously split conversion and plaintext cleanup into 500-operation batches, allowing partial commits that made retry skip already-marked cycles. It now reads one authoritative snapshot inside its writer and commits replacements, config blanking and source destruction in one transaction; permanent cycle deletion also commits once. Regression tests reject the adapter commit, verify cached state, retry, and exercise migrations above 500 operations and concurrent migration passes.

Cycle preference controls also submitted full config snapshots, so independent edits could overwrite each other. `updateConfig` merges patches against the latest decrypted config inside the writer, merges nested reminder fields, and supports synchronous list updaters. Controls now submit only changed fields and compute list changes from that current config. Integration tests cover concurrent patches and list edits; provider tests cover same-object emissions and obsolete decryption results.

## Cycle tracking: counter wrapped, switch dropped, clears ignored

### Symptom

Six defects shipped in the first cycle tracking release. After the average cycle length passed
without a newly logged period the day counter showed "Day 1" again while the phase stayed
luteal and the predicted date was in the past. The profile "track my cycle" switch did nothing,
and a user who skipped setup had no way to start tracking. Deselecting every symptom and saving
kept the old symptoms. Four period starts 70 days apart reported "high" confidence while the
prediction fell back to a 28-day cycle. The phase wheel placed ovulation differently from the
phase the app said it was in. Any IUD was stored as hormonal.

### Cause

- `getCycleDay` took `diffDays % avgCycleLength`, while `getPhaseAtTimestamp` and
  `predictNextPeriod` never rolled forward, so the three disagreed as soon as a period was late.
- `EditPersonalInfoModal.handleSave` destructured the form without `trackCycle`, and
  `getActive()` filtered on `is_active`, so a paused cycle vanished from the context and could
  never be resumed.
- `CycleLogModal` wrote flow and symptoms only when something was selected.
- Confidence counted raw logs, and intervals outside 15-60 days were dropped without a trace.
- `PhaseWheel` used a fixed 3-day ovulation and a 40/60 split of its own.
- The hormonal flag was `birthControlType !== 'none'`.

### Fix

`utils/cycle/` holds the pure model: `cycleHistory.ts` keeps every cycle and tags the ones that
should not feed predictions with a reason, `cycleStats.ts` derives confidence from usable cycles
and their spread, and `cycleTimeline.ts` is the one phase and prediction layout the wheel, the
cycle screen, reminders and charts read. The day counter never wraps; an overdue period is a
`late` state with no segments. The context observes the latest cycle, exposes `pausedCycle` and
`resumeTracking`, and the profile switch goes through `resolveTrackingToggle`.
Clearing a day removes its record (`CycleDayLogService.save` deletes an emptied form). The hormonal flag is
gone: `CONTRACEPTION_TRAITS` records whether a method is hormonal, unknown or neither, so a copper IUD is
no longer called hormonal.

Predicted dates were also computed as `start + N * 24h`, which lands at 23:00 or 01:00 across a daylight-saving
change: the card said "Oct 26 – 28" while the calendar marked 27–28. They now use `addCalendarDays`.

Starts and ends are stored as local-midnight instants, and one logged in another timezone can
fall hours after today's local midnight; the timeline anchors them to their local calendar day
before comparing, or that period reads as "in the future".

## Database durability: never mix SQLite connections on `musclog.db`

### Symptom

In June 2026, nutrition rows that had been committed and remained visible during a session vanished
after the OS killed the app. There were no tombstones or SQLite errors. Boot diagnostics showed that
the WAL and SHM files had disappeared.

### Cause

WatermelonDB and `expo-sqlite` bundle independent SQLite libraries. POSIX advisory locks do not
conflict between connections in the same process. Closing an `expo-sqlite` connection to the live
`musclog.db` could therefore make that library believe it was the last connection and unlink the
WAL/SHM files while WatermelonDB still held its long-lived connection. Later WatermelonDB commits
went to an unlinked inode and disappeared when the process died.

### Permanent rules

- While WatermelonDB is live, run raw reads/PRAGMAs through
  `rawQueryViaWatermelon()` in `database/wmdbRaw.ts` and writes through
  `database.adapter.unsafeExecute`.
- The only allowed `expo-sqlite` open on `musclog.db` is
  `preparePreMigrationBackupBeforeAdapter()` in `database/preMigrationCapture.ts`, before
  `new SQLiteAdapter` exists.
- Opening a different file, such as a backup copy or legacy database, is safe.
- Keep the background `PRAGMA wal_checkpoint(TRUNCATE)` and boot rescue checkpoint in
  `database/dbDurability.ts`.
- Keep row-count loss detection until an equal or better durability signal replaces it.

The pre-migration exception reads `user_version` and uses `VACUUM INTO` only when a pending migration
can touch existing data. Pure `createTable`/`addColumns` changes skip it. The resulting database copy
and AsyncStorage sidecar are registered before WatermelonDB opens; JSON conversion happens only when
the user downloads or restores it. Runtime catalogue cutovers instead use the live WatermelonDB
export path. The backup metadata index is the commit point: never prune old recovery points before a
new payload and index entry are durable.

Key coverage: database durability, pre-migration capture, backup conversion, and migration-safety
tests under `database/**/__tests__` and `utils/__tests__`.

## Automatic progression judged a session by its first set (and by 63 kg)

### Symptom

A lifter who did set 1 of 3 and skipped the rest was moved up next session; unrated sets of
10 / 6 / 5 against a plan of 10 became 11 on every set; a metric lifter with no gym progressed
60 → 63 → 66 kg, loads no plate set can make. The "why" sentence claimed checks nobody ran.

### Cause

`summarize()` (`utils/progressionProjection.ts`) read only the first working set and ignored
`allPrescribedSetsPerformed`; `loadStepFor` rounded to whole kilograms after a 2.5 kg step.

### Rules now

- `LastWorkingSession` carries `complete` and `lowestReps`: an incomplete session holds, and the
  session is judged by its weakest set. The explicit rules already did this.
- With no gym, metric loads land on a 2.5 kg multiple (imperial keeps whole pounds).
- A deload is 10% of the load (never less than one step), matching the linear rule.
- A load step above 25% of the load (`MAX_LOAD_STEP_SHARE`) is not used: the exercise keeps adding
  reps. Light lateral raises no longer jump 40%.
- `utils/sameLoad.ts` is the one epsilon for "same load".
- Draft edits in the live session are written after 400 ms of quiet and flushed on backgrounding,
  completion, discard and unmount.

## Weekly Review spun forever after re-opening the same history row

### Symptom

On a new account, marking training reviewed puts the current week in Review history. Tapping that
row, then tapping it again, left an empty page under "Back to latest review" with a spinner that
never stopped.

### Cause

The screen emptied the overview itself (`clear()` from `useWeeklyReviewOverview`) and then set the
selected review, relying on the selection change to trigger a reload. Re-selecting the review
already open is not a change, so nothing reloaded and `data` stayed `null`.

### Rules now

- `useWeeklyReviewOverview` stores each result with the selection it was loaded for and returns it
  only while that selection is current. There is no `clear()`: switching reviews shows the spinner
  by itself, and re-selecting the open review keeps it. A load error is scoped the same way.
- Pinned by `hooks/__tests__/useWeeklyReviewOverview.test.ts`.

## Exercise catalogue cutover safety

The 256-entry legacy catalogue was replaced with 873 free-exercise-db entries and 1,746 images.
Stable catalogue IDs are `fx-<slug>`; `exerciseIndex` is display order, never identity. Referenced
legacy exercises are cloned deterministically as `lx-<old id>`, references are repointed, and only
then are retired rows destroyed.

The cutover must remain resumable and must create a portable backup before retiring data. A backup
or index failure aborts the destructive phase. The old order in `data/legacyExercisesData.json`
cannot change because historic IDs and Game Boy save indices depend on it. Regenerate structural,
English, and localized catalogues with the scripts documented in `AGENTS.md`; never hand-edit
generated JSON.

In 2.12.0 the cutover's final step, `purgeRetiredExerciseImageCache()`, was added to
`utils/exerciseImageCache.ts` but not to its `.web.ts` stub, so on web it resolved to `undefined`
and threw `purgeRetiredExerciseImageCache is not a function` right after the migration's writer had
committed. The data cutover itself completed, and the next boot found no retired rows and never
reached the call, so each web user reported it once. The stub now exports a no-op, and
`utils/__tests__/exerciseImage.test.ts` fails if the stub lacks any function the native module
exports.

## Importing an Android backup on web (quota error, then back to onboarding)

### Symptom

Importing a real Android export into the web build restored the data and showed the dashboard, then
the app dropped the user back into onboarding. Every boot afterwards logged
`Web backup quota exceeded while preserving the latest recovery point` from
`createPreExerciseCatalogueBackup`, so `LegacyExerciseCatalogueMigration` never ran.

### Cause

Three separate problems. The first two came from `localStorage` being treated as general-purpose
storage on web; the third survived them and reproduced the same symptom on its own.

1. **Web recovery points were stored in `localStorage`.** They are full database dumps. An origin
   gets ~5 MB, counted in UTF-16 code units, so the ceiling is around 2.5M characters — less than
   one ordinary user's export (the reported one was 3.7 MB of JSON). `createPreExerciseCatalogueBackup()`
   could therefore never succeed once a database held real data, and because a failed backup
   deliberately aborts the catalogue cutover, the migration failed on every boot and reported to
   Sentry each time.
2. **`restoreDatabase()` cleared AsyncStorage first and restored it last.** On web `AsyncStorage`
   _is_ `window.localStorage` and `clear()` is `localStorage.clear()` — a whole-origin wipe. Three
   consequences: the import deleted every stored recovery point before creating its own; the
   pre-restore backup, taken after the wipe, embedded an empty `_async_storage_`, so restoring it
   produced an un-onboarded, un-seeded app; and for the whole restore — a full dump, a database
   reset, thousands of inserts and the 873-entry catalogue sync — `onboardingCompleted`,
   `seeding_complete` and `currentUserSyncId` were absent. Any failure in that window left a fully
   populated database with no `seeding_complete`, and the next boot's `seedProductionData()` reset
   the database, wiped AsyncStorage and sent the user to onboarding.
3. **`reloadApp()` on web reloaded the URL the restore was started from.** With both fixes above in
   place the same report came back: the data imported, the dashboard rendered, and the tab then
   landed on the onboarding screen. `app/app/onboarding/landing.tsx` offers file import and optical
   receive, so a first-time restore runs at `/app/onboarding/landing`, and
   `window.location.reload()` re-requests exactly that URL — on top of a fully restored,
   already-onboarded database. `reloadApp()` called `router.replace('/app')` first, but expo-router
   commits that `history.replaceState` on a later tick, so the reload was issued against the old URL
   while React had already rendered the dashboard; that flash is what made it look like a
   redirect _away_ from a working app. Native never had the bug: `DevSettings.reload()` and
   `reloadAppAsync()` restart at the entry route, which sends an onboarded user to `/app`. The
   giveaway in the report's console log was `✅ All database tables verified` plus
   `Production data seeding already completed, skipping` — both only ever logged by the onboarding
   landing screen, so that screen had mounted again after the reload.

### Permanent rules

- Web recovery-point payloads live in IndexedDB via `database/webBackupPayloadStore.ts`; only the
  small metadata index stays in localStorage. Reads still fall back to the old
  `musclog_backup_data_*` keys, and deletes clear both, so an upgrade keeps existing backups.
- No wipe path calls `AsyncStorage.clear()`. `database/asyncStorageReset.ts` owns both
  `clearAppAsyncStorage(preserved)` and `replaceAppAsyncStorage(pairs, preserved)`, and both skip
  the web recovery-point keys (`isWebBackupStorageKey`). `clearAllAppData()` is the one deliberate
  exception — clearing everything is what it is for.
- `restoreDatabase()` swaps AsyncStorage over only after the database is populated, and writes the
  restored pairs _before_ pruning stale keys, so a key the snapshot also carries is overwritten in
  place and never momentarily absent.
- Web restores decide where to land through `restoreReloadTarget(pathname)` in `utils/app.web.ts`,
  never through a `router` navigation raced against `window.location`. An onboarding path is
  `location.replace`d to `/app` (via `withExpoBaseUrl`, and `replace` so the back button cannot
  return to onboarding); every other surface reloads in place, which the website progress page
  (`app/(website)/progress.web.tsx`) depends on — it imports a dump only to draw its own charts and
  must not navigate a visitor into the app. Pinned by `utils/__tests__/appWebReload.test.ts`.

## Android cold-boot gallery stall

### Symptom

The first gallery action soon after a cold boot could block for about 25 seconds on a release build;
later attempts were immediate.

### Cause

Expo Modules Core runs default `AsyncFunction`/`Coroutine` work on one modules queue.
`expo-secure-store` 57.0.3 performed cold Android Keystore and SharedPreferences work directly on
that queue, blocking unrelated native operations such as the image picker and crop activity.

### Fix

- `patches/expo-secure-store+58.0.2.patch` moves SecureStore operations to a dedicated serial
  `Dispatchers.IO` lane.
- `package.json` keeps `expo.autolinking.android.buildFromSource: ["expo-secure-store"]`; SDK 57
  otherwise uses the prebuilt AAR and ignores the Kotlin patch.
- `getEncryptionKey()` coalesces concurrent reads and the API-key migration runs once.
- `patches/@bsky.app+expo-image-crop-tool+0.5.1.patch` launches the crop activity on the main queue.

Revalidate this on every Expo/SecureStore upgrade with a release APK and `adb logcat`, filtering
`CameraCaptureFlow`. The underlying Expo report is
[expo/expo#34531](https://github.com/expo/expo/issues/34531).

## Android camera startup and shutter latency

All native camera paths use `react-native-vision-camera`. Adding a second CameraX consumer such as
`expo-camera` can upgrade CameraX behind vision-camera and cause a release boot crash such as
`NoClassDefFoundError: Camera2CameraInfoImpl`. Do not add a second camera library.

Two `CameraView.tsx` props prevent the historical multi-second shutter path:

- `androidPreviewViewType="texture-view"` gives snapshot capture a reliable bitmap; SurfaceView /
  PixelCopy failures silently fall back to slower photo capture.
- `photoQualityBalance="speed"` avoids device-specific CameraX zero-shutter-lag stalls.

Verify camera changes on a release APK; the original issue did not reproduce in development.
Shutter and warm-up telemetry is emitted to logcat and Sentry.

The shared gallery entry point is `utils/galleryImagePicker.ts`. It uses the modern system picker,
needs no media-library permission, selects at quality 1, and leaves the single lossy re-encode to the
crop step. Do not restore `legacy: true`, duplicate picker calls, or double-compress images.

## Apple Silicon iOS simulator binary compatibility

Legacy OpenCV, MLImage, and ML Kit frameworks can contain arm64 device objects or pod settings that
exclude simulator arm64. Xcode 26 then reports that an iOS object is being linked for the simulator,
or that x86_64 was found when arm64 is required.

Use:

```bash
npm run prebuild-ios-simulator
# or
npm run prebuild:ios
```

`plugins/withIosSimulatorBuildFix.js` installs a guarded CocoaPods `post_install` hook that clears
the exclusion and runs `scripts/fix_opencv_simulator.py`, `fix_mlimage_simulator.py`, and
`fix_mlkit_simulator.py`. It is local-development-only and skips EAS, CI, Intel hosts, and runs with
`MUSCLOG_IOS_SIMULATOR_BUILD_FIX=0`. For a physical-device prebuild, use
`npm run prebuild-ios-device`.

The patchers validate every Mach-O member and are idempotent; “already simulator-compatible” is a
successful second run. Remove the plugin and scripts only when the full OCR/barcode dependency tree
ships valid arm64 simulator XCFramework slices and no longer excludes that architecture. Re-test
both simulator and device prebuilds before removal.

## iOS modal presentation hierarchy

React Native presents a native `Modal` from a `UIViewController`. When modal A remains visible and
opens modal B as its React sibling, iOS may ask the blocked original controller to present B and
silently drop the request.

The rule is based on whether the opener remains visible:

- If A remains visible while B opens, render B within A's children tree. `FoodSearchModal` and
  `SmartCameraShell` are reference hosts.
- If A closes first, B must be its sibling. A child of a closing host is unmounted before it can
  appear. `BottomPopUpMenu` usually follows this branch because its item closes the menu before
  invoking the action.
- Prefer a navigator inside one full-screen modal for a long multi-step flow.

`eslint-rules/no-sibling-modals.js` and `npm run report-modal-issue` catch the common unsafe shape.
Accepted false positives must explain that the host closes first.

## iOS header and tap-target consistency

- A component placed in React Navigation's `headerRight`/`headerLeft` is wrapped in an iOS native
  bar-button container and receives the system glass/blur appearance. Use an in-content custom
  header when cross-platform visual parity is required; use a native header only intentionally.
- iOS discards touches outside a parent view's bounds. Never combine negative margins around a
  tappable control with `hitSlop`; grow the target with padding while keeping it inside the parent.
  Be equally careful with absolutely positioned buttons flush to a clipped edge.

## Expo Router blog route patch

Expo Router 57.0.18 misparsed platform extensions on catch-all names such as
`[...slug].web.tsx`, left the extension in loader context keys, and used the wrong development
loader path for route groups. 57.0.26 fixed the first two upstream; only the development loader
path remains patched, in `patches/expo-router+58.0.23.patch`. The old 57.0.18 patch failed
`patch-package` in CI (`npm ci` postinstall) once the dependency moved to 57.0.26.
`utils/__tests__/expoRouterLoaderPatch.test.ts` pins all three behaviors.

Keep blog indexes inside their route directory (`blog/index.web.tsx`) when the index and catch-all
both use loaders; a `blog.web.tsx` file collides with the `blog/` loader directory during export.
Static manifests still call the literal `[...slug]` loader, so the server loader must tolerate it.

Metro sees `.web.tsx` route files before Expo Router applies platform selection. Dynamic `import()`
does not provide native code splitting, so `metro.config.js` must map `blogPosts.server` to
`blog-posts-server-stub.js` on native to keep Node built-ins and parser packages out of the bundle.
Do not replace this with a `.native.ts` sibling; the Jest native platform resolution would hijack
the real server tests.

## NativeWind box-shadow parser crash

In `react-native-css-interop` 0.2.6, `parseDeclaration` fell through from a fully parsed literal
`box-shadow` into `aspect-ratio` and read a missing `ratio`. Native export crashed with a misleading
`parseAspectRatio` stack; web could remain fine. This was carried as
`patches/react-native-css-interop+0.2.6.patch` until **0.2.7 shipped the equivalent fix upstream**
(`return parseBoxShadow(...)`), at which point the patch was removed. The behavioral test
`utils/__tests__/nativewindBoxShadowPatch.test.ts` still pins it against the installed package, so
a downgrade below 0.2.7 fails the suite rather than silently reintroducing the crash.

## Invisible alpha-tinted backgrounds

`theme.tokens.js` gives JavaScript 10%-opacity colours such as `accent.primary10` and
`status.warning10`, but the Tailwind palette only contains the base colours. A class spelled
`bg-accent-primary10` compiles to nothing: no build error, no type error, a transparent
background. About thirty such classes shipped (done set rows, guidance badges, the ready Weekly
Review card, goal and cycle modals). Use Tailwind's opacity modifier, `bg-accent-primary/10`.
`utils/__tests__/tailwindAlphaClasses.test.ts` fails the suite on the broken spelling.

A long-running web dev server can also serve a stale stylesheet that lacks classes added since it
started (seen with `px-3.5` and `gap-x-2`), which looks like the same bug. Restart it with
`--clear` before chasing a missing utility.

## Health Connect duplicate classes

Do not install `expo-health-connect` beside `react-native-health-connect` 4.x. Both register an Expo
module in `expo.modules.healthconnect`, causing release `mergeDex` duplicate-class failures.
`react-native-health-connect` already includes the required config plugin and Android manifest
entries, so the standalone package adds nothing.

## EAS `npm ci` lockfile rejection

EAS builds ignore `.nvmrc` and `engines`; a profile without a `node` field runs on the image default
(Node 22 / npm 10). The lockfile is written by npm 11 on Node 26, and the two npm majors disagree
about optional peers that the root cannot satisfy: `eas-cli` pins `@expo/config@55`, whose
`@expo/require-utils` declares an optional `typescript@^5` peer against our `typescript ~6`. npm 11
leaves it unmet; npm 10 wants a nested `typescript@5.9.3`, so `npm ci` fails with
`Missing: typescript@5.9.3 from lock file`. `eas.json` therefore pins an exact Node 26 release in a
`base` profile that every other profile extends. `utils/__tests__/easNodeVersion.test.ts` requires
every profile to resolve an exact version whose major matches `engines`, `.nvmrc`, and the GitHub
workflows — bump them together.

## EAS builder rejects `eas.json` after an `eas-cli` bump

The builder reads `eas.json` with the `eas-cli` baked into its own image, not the one in our
`devDependencies`, and that image trails npm by days. Raising `cli.version` to the freshly released
`>= 24.7.0` failed every iOS build with `You are on eas-cli@24.6.0 which does not satisfy the CLI
version constraint` / `Failed to read the build profile production from eas.json`, before any
native step ran. `cli.version` is therefore a major-only floor (`>= N.0.0`) that only moves when
`eas.json` starts using a feature that needs it; `utils/__tests__/easNodeVersion.test.ts` enforces
the shape.

## Local Android builds fail on JDK 25

After a Fedora update left JDK 25 as the only installed Java, every local Android build failed in
Gradle with `Error resolving plugin [id: 'com.facebook.react.settings'] > 25.0.4.1` — the message is
just the Java version string, because Gradle 8.13 (then pinned by `plugins/withGradleVersion`) cannot run
on Java 25. Android Studio's bundled JBR is also 25, so it is no fallback. Android builds need JDK
17 or 21. `scripts/run-eas-local-android-build.sh` keeps a `JAVA_HOME` that is already 17/21,
otherwise picks one from `~/.jdks/jdk-17*`/`jdk-21*` or `/usr/lib/jvm`, and exits with an install
hint when there is none. The EAS working copy also has no `local.properties`, so the script defaults
`ANDROID_HOME` to `~/Android/Sdk` (Android Studio's location) when it is unset — otherwise Gradle
stops with `SDK location not found` right after the JDK check passes. SDK 58 removes that obsolete pin and uses Gradle 9.4.1; the launcher now accepts Java 17–26.

## Android release optimization

`app.json` enables both `enableMinifyInReleaseBuilds` and
`enableShrinkResourcesInReleaseBuilds`. Resource shrinking requires minification, so keep them
together and keep committed `android/gradle.properties` synchronized through Prebuild. This closes
the Play Console R8 warning.

The separate `rn-mlkit-ocr` bitmap warning cannot be fixed with Expo configuration: its native
module downloads remote images and decodes them directly. App paths should pass local cropped file
URIs, avoiding the package's remote downloader. A full fix belongs upstream or in a replacement
library.

## Optical transfer regressions

The protocol design and benchmarks are in [RESEARCH.md](RESEARCH.md#optical-transfer). Fixed bugs
that should remain pinned:

- The sender loop self-schedules with `setTimeout`; `setInterval` queued work faster than Hermes
  could encode it and progressively collapsed frame rate.
- Every displayed `SkImage` is disposed; its native allocation is invisible to JS garbage
  collection.
- The frame cache is all-or-nothing. Looping fewer unique frames than decoding requires deadlocks
  near completion.
- Receiver/sender async work is cancelled by a generation token so a stale unpack or pack cannot
  publish over a newer session.
- Receiver progress tracks collected frames and explicitly publishes 100% after reassembly; LT
  block solving is back-loaded and is not suitable for the primary progress bar.
- Compression precedes optional encryption. Reversing them made transfers roughly nine times
  larger.
- Share payloads cannot enter the destructive database branch. Require `payloadKind === 0` for a
  full restore; never treat “not a recognized share” as a database.
- Optional envelope fields are omitted, not serialized as `null`. Compatibility parsing accepts
  the v2.11.0 null mistake, and end-to-end JSON tests pin the distinction.
- Food barcode scanners suppress the first recognized optical frame as well as later detection;
  otherwise the first frame opens “food not found” and tears down the camera.
- `DevSettings.reload()` is development-only; `reloadApp()` must keep its separate production path,
  and post-restore UI must always offer an explicit restart action.

## Home screen crashed after a database import (`useMemo is not defined`)

### Symptom

On a dev web build, importing an exported JSON backup from the landing screen appeared to fail: the
restore ran to completion, `reloadApp()` navigated to `/app`, and the home screen then died in the
error boundary with `ReferenceError: useMemo is not defined`. The import had actually succeeded — the
data was in IndexedDB — but the only screen that could show it never rendered. The landing screen was
the sole entry point reached beforehand, so nothing had rendered the home screen earlier to reveal
that it was already broken for every user, imported data or not.

### Cause

The configurable-home-actions branch was merged with the feature only half present. `app/app/index.tsx`
gained two `useMemo` calls without the matching `react` import, `VisualSettingsModal.tsx` called
`isHomeActionAvailable` without importing it, and the entire persistence chain behind
`useSettings().homeActions` was absent: no `HOME_ACTIONS_SETTING_TYPE`, no
`SettingsService.getHomeActions`/`setHomeActions`, no `homeActions` field on the settings context.

`npm run lint:eslint` does not catch any of it. The TypeScript parser is configured without
`no-undef`, so an undefined identifier is not a lint error — `tsc` is the only check that sees it, and
these four faults were sitting on `dev` as plain `TS2304`/`TS2339` errors. CI does run
`npm run typecheck` on pull requests, so the merge landed red rather than the check being missing.

### Permanent rules

- `npm run lint:eslint` passing says nothing about undefined identifiers. Run `npm run typecheck`
  (or `npm run lint:all`) before merging, and treat a red `typecheck` on a merge as a blocker.
- A feature whose UI is compiler-enforced through `Record<Key, …>` tables can still be missing its
  entire settings/persistence half with no type error at the call sites that matter. See the home
  actions rule in `AGENTS.md` for the four edits that chain is.

## Removing workarounds

When upgrading Expo or a patched dependency:

1. Check the installed source or release notes for the exact upstream fix.
2. Remove one workaround at a time, including its configuration and documentation.
3. Keep or update the regression test before rebuilding.
4. Verify the platform and build type where the bug originally appeared; several incidents were
   release-only or native-only.

## Starting a workout while one is already open

### Symptom

Sentry reported `Failed to start workout: There is already an active workout` (2.12.0+304). The
user saw only a generic "Something went wrong" snackbar.

### Cause

The guard in `WorkoutService.startWorkoutFromTemplate` worked as designed. The screen passed its
refusal to `handleError` like any other failure, so it went to Sentry with no explanation for the
user. `startFreeWorkout` had the opposite bug: its guard threw inside the `try` around the
active-workout lookup, so its own `catch` swallowed the throw, cleared the open session's id and
started a second workout on top of it. This also affected `processParsedWorkouts` (AI workout
import), which calls `startFreeWorkout`.

### Permanent rules

- Both start paths throw `ActiveWorkoutExistsError` (exported from `WorkoutService.ts`). They
  rethrow it without wrapping and skip the database-repair retry.
- Guard only the lookup. The "still open" check must stay outside that `try`.
- Callers treat the error as user state rather than a failure. `workouts.tsx` shows
  `workouts.interruptedSession.alreadyActive`, refreshes the resume/discard banner and does not
  report the error to Sentry.

## Restoring a backup during boot migrations

### Symptom

Sentry reported `Cannot call database.adapter.underlyingAdapter while the database is being reset`
from `runDatabaseBootSequence` → a boot migration's query (2.12.0, handled).

### Cause

The DB-ready gate only covers the reset inside `seedProductionData()`. Once seeding marks the DB
ready, the boot migration chain starts, and on a fresh install it takes seconds (the 873-entry
catalogue sync plus the legacy catalogue migration). The onboarding landing screen offers file
import and optical receive as soon as seeding finishes, so `restoreDatabase` could call
`unsafeResetDatabase()` while a migration was still querying.

### Permanent rules

- `dbBootCoordinator.ts` registers the migration chain with `trackBootMigrations`, and every
  destructive reset (`restoreDatabase`, `clearAllAppData`) awaits `waitForBootMigrations()` from
  `database/dbReady.ts` first. A new `unsafeResetDatabase()` call site outside seeding needs the
  same wait.
- Track only the migration chain, never the wait for readiness, so a boot that never becomes
  ready cannot block a restore. `waitForBootMigrations()` never rejects.

## AI rate limits reported as bugs (`429 status code (no body)`)

### Symptom

Sentry reported `Error: 429 status code (no body)` (2.12.0+304): an OpenAI SDK `RateLimitError`,
marked handled. The user saw the "AI credits exhausted" / "try again later" message, which was the
correct outcome.

### Cause

Not a bug in the app. The provider (the user's own OpenAI-compatible key or the Musclog gateway's
daily cap) refused the request. `withLlmRetry` had already retried it three times with backoff.
Every AI `catch` in `utils/coachAI.ts` called `handleError`, which reports to Sentry by default,
before it checked `isAiCreditsError`. So an expected refusal was reported to Sentry as if it were a
failure in the app.

### Permanent rules

- AI catch sites in `coachAI.ts` report through `reportAiError`. This helper passes
  `sendToSentry: !isAiCreditsError(error)`, so rate limits and quota or billing errors stay out of
  Sentry, and every other AI failure is still reported. Do not call `handleError` directly from a
  new AI catch site. `utils/__tests__/coachAIErrorReporting.test.ts` checks this.
- Dropped connections are excluded the same way (2.12.2+306: `Connection error.` caused by
  `fetch failed: java.io.IOException: unexpected end of stream on https://gateway.ai.cloudflare.com/...`
  in `coachAI.generateMealPlan`). The OpenAI SDK retries connection failures twice on its own
  (`maxRetries` defaults to 2), so one that surfaces is the device's network, not the app.
  `reportAiError` also skips Sentry when `isAiConnectionError(error)` is true: an OpenAI
  `APIConnectionError` (including its timeout subclass), or a raw `fetch failed: …` or
  `Network request failed` error from the Gemini path. The user still sees the feature's error message, and
  their text is restored so they can retry.

## Sentry events without a call site (`Record foods#null not found`)

### Symptom

Sentry reported `Diagnostic error: Record foods#null not found` (2.12.0+304). The event carried
only WatermelonDB frames, and nothing in it showed which feature made the lookup.

### Cause

Two separate problems:

- `Collection.find` rejects a non-string id earlier with a different message ("Invalid record ID"),
  so this `find` received the **string** `"null"`. Model setters cannot produce that string,
  because WatermelonDB's sanitizer turns `null` into `''` or `null`. The value came from outside a
  model. The most likely source is an LLM `foodId`: the foundation-foods prompt told the model to
  "leave `foodId` null", and models sometimes return that as text. Thinking-mode `trackMeal`
  treated any truthy `foodId` as a confirmed match. Such an ingredient skipped macro estimation
  and was logged at 0 kcal once `normalizeAiMealIngredients` stripped the bad id.
- The exact caller could not be found because `handleError` and `captureBootException` sent their
  `context` in the Sentry hint's `data` field. Sentry never serializes that field onto the event,
  so every handled error arrived without saying where it came from.

### Permanent rules

- Report context through `captureContext` (`tags.context`, plus `extra` for structured data), never
  through a hint's `data`. `utils/__tests__/handleError.test.ts` checks this.
- Treat an LLM `foodId` as a claim that the database must confirm. `trackMealWithThinking` runs
  claimed ids through `normalizeAiMealIngredients` before splitting known from unknown ingredients,
  and sends unconfirmed ones to estimation. `utils/__tests__/coachAITrackMealThinking.test.ts`
  checks this. The prompt now says to omit `foodId` rather than leave it null.

## `syncDailySteps is not a function` on web and iOS

### Symptom

v2.12.2's home screen threw `TypeError: _servicesHealthConnectFitness.syncDailySteps is not a
function` on web as soon as the app came to the foreground. iOS was broken the same way. Android
was fine, and neither `npm run typecheck` nor ESLint said anything.

### Cause

`services/healthConnectFitness` is a platform-variant module: Metro picks `.ts`, `.web.ts` or
`.ios.ts` per platform, and every import site names a symbol without knowing which file it will
land in. The daily-steps feature added `syncDailySteps` to the Android file only — the web stub
never gained it, and the iOS file had the function but forgot the `export` keyword. TypeScript
type-checks the base module regardless of which variant ships, so a symbol missing from a sibling
is not a type error anywhere; it is a runtime `TypeError` on exactly one platform.

The same gap existed in `utils/onDeviceAi.web.ts` (`sendOnDeviceStructured`, reachable from
`coachAI.ts` whenever a restored backup carries an `on-device` provider setting) and
`utils/notifications.web.ts` (`setupNotificationConfig`).

### Permanent rules

- A platform sibling may export **more** than the base module, never less. A web-only helper such
  as `restoreReloadTarget` is legitimate; a missing stub is a crash.
- `utils/__tests__/platformModuleParity.test.ts` enforces this across `constants/`, `database/`,
  `hooks/`, `services/` and `utils/`. It compares named **value** exports only — types are erased
  at runtime and cannot produce this failure. A deliberate asymmetry goes in its `ALLOWED_OMISSIONS`
  table **with its reason** (today: `preMigrationBackup`'s two native-only filesystem functions), so
  a new one cannot be introduced silently.
- Route and component files are out of scope: their contract is the default export, and their named
  exports are file-local helpers.

## Review writes, prepared model cache, and session prescriptions

WatermelonDB `prepareUpdate` changes the model cache before the adapter commits a batch. A rejected weekly approval could therefore appear reviewed in memory despite no stored decision. `commitPrepared` snapshots existing raw records/prepared state and restores them on failure; the review and target-period changes use one batch and remain retryable. The same boundary protects set completion and mode switching. Legacy Readjust now acknowledges only after the goal write succeeds, retaining reviewed check-ins across goal changes.

Explicit rule history uses stable template-exercise identity, preventing one routine from borrowing another routine’s carried state for the same movement. Skipped sets preserve their prescribed positions and prevent full-session success. Each session freezes its rule/TM and prescription metadata. Missing new RIR has an explicit false flag, avoiding automatic guidance based on a placeholder zero. Switching to/from weekly nutrition closes target intervals rather than changing the meaning of earlier approved dates.

## Session forgot its progression rule after the first completed set

`WorkoutService.getWorkoutWithDetails` built its enriched sets without each log exercise's `progressionJson`. The live session's `refresh` reloads through that path after every save, so from the second set on an exercise with a rule read as rule-free: its badge fell back to "Suggested · Automatic" while the reason underneath still described the rule. The reactive pipeline (`useWorkoutSessionState`) already passed the field, which is why the first render looked right. The field is now passed on both paths, pinned by "keeps the exercise rule on sets reloaded after a save" in `weeklyProgressionSession.integration.test.ts` (verified to fail without the fix).

## Summary "Total Time" read "0in m"

The web summary split its duration label with `/\s*(m|min|minutes?)/` — unanchored, so "0 min" matched the leading "m" and rendered "0in" + "m"; the pattern could never match a localized unit either. Both summary cards now use `splitDurationLabel` (`utils/workout.ts`), which splits on the last space. The web stats card also needed `flexShrink: 0`: as a flex-column item it shrank, and was clipped, once "Next time" was added below it.

## Large-text Playwright profile skewed every sheet

The progression spec emulated 1.3× text with `document.documentElement.style.zoom`. react-native-web sizes sheets from JS window dimensions, which CSS zoom does not change, so every `BottomPopUp` rendered 1.3× too tall and wide and its footer left the viewport — a failure no device can produce. The `phone-large-text` project now uses the layout that text size really yields: a 318×689 viewport at `deviceScaleFactor: 1.3`.

## Progression and Weekly Review: state ownership regressions

Goal editors changed mode/macros without closing dated weekly periods, which continued to outrank
edited goals. All mode changes now use `NutritionGoalService.updateGoal`; goal and period writes
share one rollback-safe batch, preserving earlier days. Empirical expenditure formerly divided the
whole weight change by food-logging coverage. Intake is now bounded to the weight-anchor interval,
and the calculator divides intake by coverage days and tissue energy by elapsed anchor days.

Add/Swap used a separate history reader that treated unrecorded RIR as zero. Both now use the same
completed-history projection as preview/start. AI substitutions look up the chosen movement's load,
not the rejected movement's. A swap after logging splits pending sets into a new block; performed
sets keep their movement and rule, and the original prescription's working-set count prevents a
partial block from being interpreted as complete. Split replacements retain an explicit superset slot
(v33), so the movement change does not reorder rounds or change rest boundaries. Swap is disabled
when no planned sets remain. Session and overview actions identify log blocks,
so two instances of the same exercise remain independent. BLE files retain their captured owner
set, movement and device, and cannot be attached to a different Inline row.

Use the plan clears only pending weight/rep overrides, preserving effort and persisting the result.
Weekly Review refreshes evidence when focused after logging, and never offers completed-only
candidates as Next up. Optional subjective ratings and notes are available on the summary; failed
saves retain the form. Narrow session rows place Last time below the inputs rather than truncating
it. Photo gestures clamp the fitted image, rather than its letterboxed container.

Regression coverage includes Loki integration tests for goal transitions and historical movement
identity, controller restart/undo tests, focus/recording-owner tests, gesture-bound tests, and browser
checks of complete previous values, edited-draft undo and summary feedback across four layouts.

## Weekly Review dead ends and leftovers from a discarded workout

Weekly Review evidence is counted over the week that has already closed, yet its "Log weight" and
"Complete food entries" buttons opened today's progress screen and food diary, and applying needed
food on all seven days with flagged fasting days ignored — so the buttons could never unlock the
week, and anyone using the fasting-day feature could never apply. The copy promised "at least three
days". Applying now needs food (or a flagged fast) on 5 of 7 days and two weigh-ins, the sentence
interpolates those constants, and each button opens the diary or a dated weight entry on the exact
day still missing (`overview().gaps`).

Discarding a live workout deleted only the log: the stored active workout survived (Home offered to
resume a deleted log), a scheduled "rest over" reminder still fired, and the drafts stayed in storage
and in every backup. `useWorkoutSessionController().discard` now clears all of them. Finishing used
to navigate twice (once without the feedback flag); the `completedAt` effect is now the only
navigation. The controller's once-a-second clock ran for the whole session and re-rendered every set
row; it now runs only during a rest.

Progression deloaded after a single session at failure (automatic) or below the rep range (double
progression, top set); it now holds once and deloads on the second consecutive miss at that load.
Automatic `reps_first` used a fixed 8–12 / 12–16 range whatever the plan said, walking a 5×5 up to
12 reps; it now climbs from the planned reps. Cardio, mobility and stretching were excluded from
progression only at session start, so previews could promise changes the session never made.

On web every `MaterialIcons` glyph rendered as a tofu box showing its private-use code point (e.g.
"EA 0B" for `bolt`): nothing registered a `@font-face` for the icon font, and the
`@react-native-vector-icons` config plugin only bundles it for native builds. `utils/webIconFonts.web.ts`
now loads `MaterialIcons.ttf` through `expo-font` under the family name `MaterialIcons-Regular` (the
icon set's `postScriptName`, which the library uses as the web `font-family`); `app/_layout.tsx` calls
it during rendering. The native sibling is a no-op. A new icon set needs its own entry there.

The initial module-scope registration broke SDK 57 static web export with
`expo-font server context accessed outside of withServerContext()`: Expo imports routes while
building the manifest, before entering the font collection context. Keep registration inside
`RootLayout`'s render, where each exported page collects its own font resources; moving it to an
effect would omit the font from server-rendered HTML. Browser font loads are deduplicated by
`expo-font`. `utils/__tests__/webIconFonts.test.ts` covers import safety and per-page registration.

## Progression stalls hidden by rounding, bodyweight load, and protein that fell in a cut

A deload rounded its target to the NEAREST loadable weight, so a 10% cut of a 10 kg dumbbell (9 kg)
landed back on 10 kg: the linear rule then counted another miss at an unchanged load, forever. Every
deload now goes through `loadBelow` (`utils/setProgression.ts`), which snaps down and guarantees a
strictly lighter load whenever one exists. The percentage rule's training max could only go up or
hold, so a lifter who outgrew it was held there indefinitely; it now resets after repeated misses.
The automatic progression treated an unloaded bodyweight exercise like any other at the top of its
range and prescribed "2.5 kg × 10" push-ups; it now climbs reps to a per-exercise ceiling
(`exercise_user_settings.rep_ceiling`, v35) and says how to progress beyond it. A Weekly Review
repeat/lighter week handed the previous session's training max on next to the CURRENT rule, so a
starting max the user had just changed was silently ignored (`carriedSessionState`).

Without body fat — which became opt-in — `calculateMacros` set protein as a percentage of calories,
so the Weekly Review recommended cutting protein from 180 g to 113 g alongside a calorie cut. Protein
is now g/kg of a reference bodyweight whenever a weight is known.

A failed exercise swap cleared the values the user had typed, because `runSaving` swallowed the error
and the caller carried on as if the swap had worked; it now returns whether it succeeded.

## Cycle daily mood consistency and same-timestamp edits

Mood entered from the cycle sheet is the shared Home/Progress metric. The former clear-day
path only removed the cycle payload, and cycle CSV/PDF exports omitted mood. Daily observations
and an optional mood change now commit in one writer; an explicit clear-day includes shared
mood, while permanent cycle deletion retains it with a visible explanation. Cycle exports and
comparison cells read an observable, deduplicated mood history.

CycleRepository's decrypted cache previously keyed only `(id, updated_at)`. Two rapid edits
can share the same millisecond, leaving a stale DTO after an import or quick log. The cache now
keeps one entry per record id and compares ciphertext as well as the timestamp before reusing it.

Quick-log taps now resolve their toggles inside the database writer, so two rapid symptom taps
retain both symptoms and optional observations. A failed bleeding save never offers a period start.

## Cycle tracking completion (October 2026)

- Automatically excluded long cycles previously had no user correction path. `confirmedLongCycle` now restores a genuine long interval to prediction inputs without bypassing physiology or explicit exclusions.
- A single start previously produced a narrow fallback date range. Unknown-length setup suppresses fallback dates, and sparse history now produces a wider heuristic range.
- Cycle import previously required an existing record, so a new-phone restore needed placeholder setup. Cycle transfer can now create its parent and all records in the same batch after validation.
- Setup previously applied the current contraception/life stage from the earliest past period. It now begins today; older context changes are recorded explicitly in dated history.
- HealthKit 14's generated metadata type for intermenstrual bleeding is `Record<string, never>` even though native HealthKit accepts standard sync metadata. The cycle adapter uses a narrow documented type assertion for spotting and the actual `HKSyncIdentifier`/`HKSyncVersion` keys; adapter tests pin both. Recheck the assertion on library upgrades.

## Cycle tracking review: privacy leaks, contradictions and reminder noise (October 2026)

- **The lock did not cover what it seemed to.** A sheet left open when the app locked stayed readable, because a native Modal is its own window and the root `AppLockOverlay` sat below it; the app switcher's snapshot showed the diary, because the overlay only appeared when the app came back; the Progress screen drew logged periods with the cycle area locked; and the cycle screen's sheets sat outside `AreaLockGate`, so a re-lock left an open day sheet on screen. The overlay is now drawn inside the shared `components/theme/Modal` primitive as well, draws a blank privacy cover while backgrounded (`isObscured`), and every cycle surface sits behind the gate. Pinned by `components/__tests__/appLockCoverage.test.ts`.
- **Deleted cycle text stayed on the device, decryptable.** A cleared day, a removed context and a removed period were soft-deleted, and exports filter WatermelonDB's `_status`, not `deleted_at`, so every full export — including the automatic recovery points in the cache folder — wrote them out decrypted. Recovery points also stored every live cycle payload in plaintext, and the encryption migration's own safety backup was a plaintext copy of the very rows it "must not let linger". Fixed by destroying cleared days and contexts, purging removed periods at boot (`CycleRecordPurge`), dropping deleted cycle rows from exports, keeping recovery points encrypted (`keepCycleCiphertext`, decrypted only on download) and deleting the safety backup once the conversion reads back.
- **The fertility opt-in leaked through the phase.** With the estimate off, the wheel and header still said "Ovulatory": follicular/ovulatory/luteal are placed by assuming ovulation at cycle length minus 14, i.e. they are the fertility estimate under another name. Without the opt-in the layout is now only `menstrual` + `between`.
- **The screen contradicted itself about bleeding.** The banner treated an open period as ongoing for up to 14 days while the phase counted only the average duration, so day 7 of an open period read "Period, day 7" beside "Follicular". Both now read `isOngoingPeriod`.
- **Detailed reminder copy was wrong.** It hard-coded "in 2 days" whatever lead time was set, and the fertile-window text said it was "useful for tracking your energy levels" — the phase-energy claim the redesign removed everywhere else.
- **Daily reminders were 28 one-shot notifications** that never skipped a logged day; iOS caps an app at 64 pending notifications, so they crowded out workout and weekly-review reminders. It is one repeating trigger now.
- **A mood that failed to load blocked saving the whole day**, the symptom chip took four taps to deselect, and "clear day" erased shared mood without asking. Mood is read from the provider and never blocks Save; a tap toggles a symptom (severity is a separate optional choice); clearing asks first.
- **Updating a deleted period said "end before start".** It throws `period_not_found` now; `end()` also normalises its date to local midnight like `start()`.

## Expo SDK 58 migration

Expo 58.0.14 / React Native 0.88 use scene-based iOS startup and stricter instance ref types.
Static metadata now comes from route-level `generateMetadata`, and the custom HTML document renders
Expo’s head/body nodes so hydration assets survive. JSON-LD is direct prerendered script markup.
The production root renders the marketing page itself; the previous redirect exported no actual
landing content. The site remains statically hosted, with the existing base-path and blog helpers.

All six package patches remain necessary in the versions selected for this upgrade. Router’s grouped
development loader paths and SecureStore’s serial I/O queue are rebased to SDK 58; SecureStore still
builds from source. Crop launch remains on Main, LokiJS preserves lazy-copy/save integrity, and the
barcode detector still removes jcenter. The Gutenye OCR patch now contains only its Gradle/codegen
workaround: generated build outputs and OpenCV binaries were accidentally captured in the old patch
and have been removed. The Gradle 8.13 pin is no longer configured: RN’s Foojay resolver is 1.0.0,
and the generated SDK 58 wrapper is Gradle 9.4.1. Simulator binary fixes remain until the affected
OCR/ML Kit distributions supply proper simulator slices. BLE writes and handle reads use their
synchronous SDK 58 methods; otherwise recording and JSON export could race unfinished promises.

Widgets now use Expo Widgets. Its published Android plugin requires `enableAndroid: true`. The
initial-layout registry stubs nonrelative app imports, so initial palette imports use documented
relative paths. A native generated-provider hook preserves camera/nutrition shortcut behavior after
Android process death; the app’s JS interaction listener alone cannot do that. Widget snapshots are
refreshed by one mounted owner after database/settings readiness, and are cleared on restore/reset.

- SDK 58 native compilation also requires `patches/@nozbe+watermelondb+0.28.0.patch`: enable Android BuildConfig generation under AGP 9, and use an iOS `WMDatabaseJSIBridge` TurboModule to install the existing SQLite JSI bindings. Guard the legacy `RCTCxxBridge` installer when that header is absent. The adapter and stored database format are unchanged; remove only after upstream includes equivalent native support.

## EAS Android build: out of memory, then out of time

After the SDK 58 migration (which also bumped `@shopify/react-native-skia` 2.6.2 → 2.14.0, the version SDK 58 pins), production Android builds on the free EAS worker (no paid plan, so no `large` resource class) failed three times, always inside `shopify_react-native-skia:buildCMakeRelWithDebInfo[arm64-v8a]`. The last good build (2.13.2) took 22 minutes:

1. After 19 min: `Gradle build daemon disappeared unexpectedly`, with no Java error. The OS killed the daemon because the worker ran out of RAM.
2. With `org.gradle.workers.max=2` (`plugins/withGradleJvmArgs.js`): the same failure after 37 min. That setting limits Gradle tasks, not the one-clang-per-CPU `ninja` each CMake task starts.
3. With ninja job pools (2 compiles, 1 link per project): no error, the log just stops. EAS cancelled the build at exactly 45 min (`buildDuration: 2700003` in `eas build:list --json`), the free tier's limit. The worker was swapping.

Measured locally: Skia's `RNSkManager.cpp` peaks at ~3.5 GB and ~75 s per ABI on a 16-core machine (`RNSkPictureView.cpp` and `ViewProperty.cpp` are next at ~30 s). With `-g0` it is ~2.9 GB, ~30% faster and 7x smaller. `plugins/withNativeBuildJobPools.js` now:

- adds ninja job pools to every Android CMake module from the root `android/build.gradle`, with Skia at 1 compile at a time;
- builds release C/C++ without debug info (`CMAKE_{C,CXX}_FLAGS_RELWITHDEBINFO=-O2 -g0 -DNDEBUG`). The NDK puts its own `-g` earlier on the command line, so the flag must be in the per-config flags. Debug builds keep symbols. Native frames in crash reports lose line numbers.

The block must sit above `apply plugin: "com.facebook.react.rootproject"`, which evaluates `:app` immediately.

`buildArchs` also dropped 32-bit `x86` (`armeabi-v7a`, `arm64-v8a`, `x86_64` remain). It does not lower the peak, but it removes a quarter of the native compile time, and essentially no real devices use it.

To verify, run a configure-only build, e.g. `./gradlew -PreactNativeArchitectures=arm64-v8a ":shopify_react-native-skia:configureCMakeRelWithDebInfo[arm64-v8a]"`. Then check `pool compile` in `.cxx/**/CMakeFiles/rules.ninja` and the `-g0` in `compile_commands.json`. `eas build:list --platform android --json` shows `buildDuration` per build.

### Screenshot theme reverted after selection

The screenshot setup selected a theme through the public preferences picker and
immediately unloaded the page. Its checked radio reflects the synchronous browser
mirror; WatermelonDB’s LokiJS web adapter persists writes on a 500ms autosave
interval. The reload could discard the new database value and restore the previous
theme (often `kinetic-light`), failing the theme assertion before the first capture.
The suite now waits 1500ms before leaving the picker and still checks the resolved
app theme after navigation. Screenshot npm commands explicitly select the capture
spec instead of also running SDK compatibility tests.

The capture targets also follow the split from Advanced Settings into Data Settings
and App Preferences. Modal actions have a 15-second timeout, recover by reloading
the fixture after a failure, and report missing captures as a failed suite instead
of silently succeeding with incomplete output.

Normal production web exports redirect `/app/test/modals` to Home. Screenshot
commands now use `screenshots:build`, which sets `EXPO_PUBLIC_SCREENSHOT_MODE=1`
to allow only that fixture on web. The exception is absent from ordinary web and
native production builds.

Each modal capture reloads the fixture before the next one. Escape alone leaves
non-dismissible modals (such as session feedback) open, blocking subsequent
buttons and causing missing captures.
