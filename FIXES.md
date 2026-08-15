# Musclog — Fixes and Regression Notes

This file records non-obvious production fixes, their root causes, and the conditions under which a
workaround can be removed. Keep the short guardrails in `AGENTS.md`; keep the incident history here.

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

## Android cold-boot gallery stall

### Symptom

The first gallery action soon after a cold boot could block for about 25 seconds on a release build;
later attempts were immediate.

### Cause

Expo Modules Core runs default `AsyncFunction`/`Coroutine` work on one modules queue.
`expo-secure-store` 57.0.1 performed cold Android Keystore and SharedPreferences work directly on
that queue, blocking unrelated native operations such as the image picker and crop activity.

### Fix

- `patches/expo-secure-store+57.0.1.patch` moves SecureStore operations to a dedicated serial
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

Expo Router 57.0.13 misparses platform extensions on catch-all names such as
`[...slug].web.tsx`, leaves the extension in loader context keys, and uses the wrong development
loader path for route groups. `patches/expo-router+57.0.13.patch` fixes all three behaviors and
`utils/__tests__/expoRouterLoaderPatch.test.ts` pins them.

Keep blog indexes inside their route directory (`blog/index.web.tsx`) when the index and catch-all
both use loaders; a `blog.web.tsx` file collides with the `blog/` loader directory during export.
Static manifests still call the literal `[...slug]` loader, so the server loader must tolerate it.

Metro sees `.web.tsx` route files before Expo Router applies platform selection. Dynamic `import()`
does not provide native code splitting, so `metro.config.js` must map `blogPosts.server` to
`blog-posts-server-stub.js` on native to keep Node built-ins and parser packages out of the bundle.
Do not replace this with a `.native.ts` sibling; the Jest native platform resolution would hijack
the real server tests.

## NativeWind box-shadow parser crash

In `react-native-css-interop` 0.2.6, `parseDeclaration` falls through from a fully parsed literal
`box-shadow` into `aspect-ratio` and reads a missing `ratio`. Native export crashes with a misleading
`parseAspectRatio` stack; web can remain fine. `patches/react-native-css-interop+0.2.6.patch` adds the
missing return and `utils/__tests__/nativewindBoxShadowPatch.test.ts` pins it. Remove it only after
the installed upstream version contains the equivalent fix.

## Health Connect duplicate classes

Do not install `expo-health-connect` beside `react-native-health-connect` 4.x. Both register an Expo
module in `expo.modules.healthconnect`, causing release `mergeDex` duplicate-class failures.
`react-native-health-connect` already includes the required config plugin and Android manifest
entries, so the standalone package adds nothing.

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

## Removing workarounds

When upgrading Expo or a patched dependency:

1. Check the installed source or release notes for the exact upstream fix.
2. Remove one workaround at a time, including its configuration and documentation.
3. Keep or update the regression test before rebuilding.
4. Verify the platform and build type where the bug originally appeared; several incidents were
   release-only or native-only.
