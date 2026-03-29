# iOS Build & Release Plan (Musclog)

This document is a **technical runbook** for shipping the Musclog app on iOS. It is grounded in the current codebase (Expo SDK **54**, React Native **0.81**, bundle ID **`com.werules.logger`**, EAS project id in `app.json` → `extra.eas.projectId`) and in Expo / Apple’s current tooling.

**Goal:** produce installable iOS binaries (simulator, device, TestFlight, App Store) and reach **feature parity** with Android where the product requires it—especially **health sync**, which today is implemented only for **Android Health Connect**.

---

## 1. Where the project stands today

### 1.1 Already in place

| Area | Status |
|------|--------|
| Expo / RN stack | `expo` 54, `expo-router`, Hermes, NativeWind, WatermelonDB, etc.—platform-agnostic. |
| `app.json` → `ios` | `bundleIdentifier`, `buildNumber`, `supportsTablet` are set. |
| `npm run ios` | `expo run:ios` is wired in `package.json`. |
| EAS | `eas.json` exists with `development` / `preview` / `production` profiles; `appVersionSource: "remote"` (version/build numbers can follow App Store Connect when configured). |
| Sentry | `@sentry/react-native` + `metro.config.js` uses `getSentryExpoConfig`; Expo plugin in `app.json` for org `werules`, project `workout`. |
| Native modules with iOS code | e.g. `rn-mlkit-ocr` ships an `ios/` tree and an Expo config plugin—food OCR can work on iOS once the app builds. |
| Android-only config plugins | `expo-health-connect` and `react-native-android-widget` plugins only touch **Android** manifests/resources (verified in `node_modules`: Health Connect uses `withAndroidManifest`; Android Widget plugin is Android-scoped). They should **not** block `expo prebuild` for iOS by themselves. |

### 1.2 Gaps specific to this repo (must address for a credible iOS release)

1. **Health data**  
   Core logic lives under `services/healthConnect*.ts` and imports `react-native-health-connect` (Android-only). There is **no** HealthKit implementation yet. Downstream: `healthDataSync.ts`, onboarding `app/onboarding/health-connect.tsx`, `hooks/useHealthConnectPermissions.ts`, progress screen sync, workout/nutrition write paths, etc.

2. **Boot-time behavior in `app/_layout.tsx`**  
   The block that runs Health Connect sync, `configureDailyTasks`, and full `NotificationService.configure()` + scheduling is gated with `if (Platform.OS !== 'android') return;`. On **iOS**, that entire startup pipeline is **skipped** today—including notification scheduling that is not intrinsically Android-only (channels are Android-only; permission + scheduling are cross-platform).

3. **UI copy & flows**  
   Settings and onboarding assume “Health Connect” / Google ecosystem language. These need iOS-specific strings (and likely navigation adjustments) once HealthKit exists.

4. **Widgets**  
   `widgets/` + `react-native-android-widget` are **Android home screen widgets**. iOS would require a separate **WidgetKit** extension (not covered by the current dependency). Plan treats widgets as **Android-only** unless you add a native iOS target later.

5. **Advanced settings**  
   `AdvancedSettingsModal` uses `Linking.openSettings()` only on Android; iOS path is TODO (“clear app data” parity is limited by platform).

6. **EAS scripts**  
   `package.json` has `build-android` / `submit-android` but **no** `build-ios` / `submit-ios` helpers yet—easy to add for consistency.

---

## 2. Accounts, roles, and hardware

### 2.1 Apple Developer Program

- **Enroll** in the [Apple Developer Program](https://developer.apple.com/programs/) (paid membership).  
- **Roles:** For EAS to create certificates and provisioning profiles automatically, the Apple ID you use must have sufficient access (Account Holder, Admin, or App Manager with certificate/profile access). See Expo: [Apple Developer Program roles and permissions for EAS Build](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/).

### 2.2 Expo account

- Same org/project as Android: EAS project id is already in `app.json` under `extra.eas.projectId`.

### 2.3 Do you need a Mac?

| Task | Mac required? |
|------|----------------|
| **EAS cloud builds** (`eas build -p ios`) | **No** — builds run on Expo’s macOS VMs. |
| **Local** `expo run:ios`, Xcode debugging, Simulator | **Yes** (or a Mac CI runner). |
| **Upload to TestFlight via EAS Submit** | **No** (EAS can handle submission). |
| **App Store Connect** metadata / review | Web only |

---

## 3. One-time EAS & Apple setup (first iOS build)

### 3.1 CLI login

```bash
npm install -g eas-cli   # or use project-local: npx eas-cli
eas login
```

Link the local project if needed:

```bash
eas init   # if not already linked; project is likely already configured
```

### 3.2 Credentials (managed by EAS)

Expo recommends **automatic credential management** for most teams: [Using automatically managed credentials](https://docs.expo.dev/app-signing/managed-credentials/).

Typical first flow:

```bash
eas build -p ios --profile production
```

The CLI will prompt to create or reuse:

- **Distribution certificate**
- **Provisioning profile** (App Store or ad hoc depending on profile)
- For push: **APNs key** (if you enable remote push later)

You can inspect or rotate credentials with:

```bash
eas credentials
```

### 3.3 Bundle identifier

- Already **`com.werules.logger`** in `app.json` → `ios.bundleIdentifier`.  
- Create the **same App ID** in Apple Developer → Certificates, Identifiers & Profiles, and enable capabilities you need (**HealthKit**, Push Notifications, etc.) *before* or *as* you enable them in the native project.

### 3.4 `appVersionSource: "remote"` (`eas.json`)

Your `eas.json` sets `appVersionSource: "remote"`. That ties versioning to **App Store Connect** for supported workflows. When you add iOS builds, confirm in Expo docs for your CLI version how **iOS build numbers** interact with `remote`—you may sync version/build from the store or override per build. If you hit confusion, switching to `local` for experimentation is valid; align with your release process.

---

## 4. Recommended npm scripts (parity with Android)

Add to `package.json` (exact flags can mirror Android):

```json
"build-ios": "eas build -p ios --profile production --clear-cache",
"build-ios-preview": "eas build -p ios --profile preview --clear-cache",
"submit-ios": "eas submit --platform ios"
```

Optional: `build-ios-local` with `--local` if you install fastlane/Xcode tooling on a Mac.

---

## 5. Expo config: `app.json` / dynamic `app.config.js`

### 5.1 Privacy usage descriptions (`ios.infoPlist`)

Apple rejects builds if user-visible features access protected APIs without **clear usage strings**. Your Expo plugins already configure some (e.g. `expo-camera`). You should **audit every sensitive API** and merge descriptions into `ios.infoPlist` (or plugin options).

**Likely / confirmed areas in this app:**

| Feature | Typical keys |
|---------|----------------|
| Camera / barcode / smart camera | Often covered by `expo-camera` plugin; verify merged `Info.plist`. |
| Photo library / picker | `NSPhotoLibraryUsageDescription`, possibly `NSPhotoLibraryAddUsageDescription` if saving. |
| Microphone | `NSMicrophoneUsageDescription` (camera plugin can include). |
| HealthKit | `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` |
| Face ID / local auth | Only if you add `expo-local-authentication` or similar. |
| Calendar | If `expo-calendar` accesses calendars: `NSCalendarsUsageDescription`, reminders if used. |

**HealthKit entitlements:**  
The draft snippet in an older version of this doc (putting `entitlements` under `ios` in JSON) may need to match **current Expo’s schema**. In practice, either:

- Use a **config plugin** that sets HealthKit (recommended for `@kingstinct/react-native-healthkit`), **or**
- Use `expo-build-properties` / a small custom plugin to merge entitlements.

Always verify the generated `ios` project after `npx expo prebuild -p ios`.

### 5.2 `expo-build-properties` (iOS)

You already use `expo-build-properties` for Android `minSdkVersion`. For iOS you may set, for example:

- `deploymentTarget` — align with Expo SDK 54’s supported range (override only if a dependency requires a higher minimum).
- `useFrameworks` / Swift settings — only if a pod requires it (Nitro / New Architecture edge cases).

Check: [BuildProperties (Expo SDK 54)](https://docs.expo.dev/versions/v54.0.0/sdk/build-properties/).

### 5.3 When to switch to `app.config.js`

If you need **environment-specific** plugins (e.g. disable a native module in dev), use `app.config.js` and export a function that returns `expo` config. For most cases, static `app.json` is enough.

### 5.4 Android-only plugins (no change required for iOS)

- `react-native-android-widget` — Android-only implementation.
- `expo-health-connect` — Android manifest only.

No conditional removal is strictly required unless a future Expo version warns; `expo-doctor` on EAS will flag issues.

---

## 6. Health: replacing Health Connect with HealthKit (major work)

### 6.1 Library choice

The previous draft suggested **`@kingstinct/react-native-healthkit`**. That remains a strong fit for Expo **prebuild** + **dev clients**:

- Ships an **Expo config plugin** (HealthKit capability + default usage descriptions).
- Requires a **custom dev client** or release build — **not Expo Go**.
- Documentation commonly pairs it with **`react-native-nitro-modules`** (check the exact version range on npm / the library README at install time).

**Install (typical):**

```bash
npx expo install @kingstinct/react-native-healthkit react-native-nitro-modules
```

Then add the plugin to `app.json` → `plugins` per upstream docs, e.g.:

```json
[
  "@kingstinct/react-native-healthkit",
  {
    "NSHealthShareUsageDescription": "…",
    "NSHealthUpdateUsageDescription": "…"
  }
]
```

**Apple Developer portal:** Enable **HealthKit** for App ID `com.werules.logger`.

> **Note:** Do **not** use the old plan’s typo `react-native-health` unless you deliberately choose that different library—the repo today has **`react-native-health-connect`** (Android).

### 6.2 Apple Health capability matrix

HealthKit permissions are **granular** (read vs write per type). Map your existing Health Connect **record types** (`services/healthConnect.ts`, `healthConnectFitness.ts`, `healthDataTransform.ts`) to **HK sample types** and **HK workout** objects. Some Android concepts may not map 1:1—plan time for QA.

### 6.3 Code architecture (recommended)

1. **Rename / split platform entrypoints**  
   - `services/healthConnect.ts` → **`services/healthConnect.android.ts`** (keep implementation).  
   - Add **`services/healthKit.ios.ts`** (or `healthApple.ios.ts`) implementing the **same public surface** your app needs (initialize, permissions, read range, write workout/nutrition/metrics).

2. **Stable facade**  
   - Add **`services/healthPlatform.ts`** (or `healthService.ts`) that re-exports the correct module:

   ```ts
   // healthPlatform.ts
   export * from './healthConnect.android'; // resolved by Metro .android.ts
   export * from './healthKit.ios';
   ```

   Or use explicit `Platform.select` / `.native` files—match existing project style.

3. **Shared errors**  
   - `healthConnectErrors.ts` is branded “Health Connect”. Consider a neutral **`HealthSyncError`** (or platform-specific subclasses) so UI can stay consistent.

4. **Sync orchestration**  
   - `healthDataSync.ts` currently imports `healthConnectService` directly. Point it at the facade and implement **`syncFromHealthKit`** or a single **`syncFromSystemHealth`** that delegates.

5. **Fitness / workout / nutrition helpers**  
   - Split `healthConnectFitness.ts`, `healthConnectWorkout.ts`, `healthConnectNutrition.ts` into `.android.ts` / `.ios.ts` **or** keep one file that calls the facade with shared transformation in `healthDataTransform.ts` (add `*.ios.ts` if transforms diverge).

6. **Hooks**  
   - `useHealthConnectPermissions.ts`: today auto-inits **only on Android** (`useEffect` with `Platform.OS === 'android'`). Mirror for iOS once HealthKit init exists.

7. **UI**  
   - `app/onboarding/health-connect.tsx`, `components/HealthConnectIllustration.tsx`, `BasicSettingsModal`, `progress.tsx`, `PastWorkoutDetailModal` (sync button): use **`Platform.select`** or shared copy keys for “Apple Health” vs “Health Connect”.

8. **`app/_layout.tsx`**  
   - After iOS health sync is safe to call, extend the boot effect to **`Platform.OS === 'ios'`** (or `!== 'web'` with Android/iOS branches) so iOS users get parity with Android’s background import where appropriate.

---

## 7. Notifications on iOS (boot path fix)

`NotificationService.configure()` is **not** Android-only; only **channels** are Android-only (see `services/NotificationService.ts`).  

But `app/_layout.tsx` currently wraps **configure + scheduling** inside the Android-only `useEffect`. For iOS you should:

1. Run **`NotificationService.configure()`** on iOS too (respecting user settings).  
2. Keep **`setNotificationChannelAsync`** guarded with `Platform.OS === 'android'`.  
3. Re-test **permission prompts** (iOS notification permission is stricter UX-wise).

---

## 8. Widgets

- **Android:** current `widgets/` + `react-native-android-widget`.  
- **iOS:** Home Screen widgets need a **WidgetKit extension** target, shared data via App Groups, and separate SwiftUI views—**out of scope** unless you schedule a dedicated feature. Document in App Store marketing that widgets are Android-only until shipped.

---

## 9. Sentry, symbols, and environment variables

- **EAS Build:** Set `EXPO_PUBLIC_SENTRY_DSN` in EAS secrets or `eas.json` env if you need it at build time for embedded config.  
- **dSYM / source maps:** The `@sentry/react-native` Expo plugin + SDK integration usually uploads debug files when correctly configured; verify in Sentry docs for **Expo + EAS** and add any **`SENTRY_AUTH_TOKEN`** as EAS secret if required by your org’s workflow.  
- After first iOS release, confirm crashes symbolicate in Sentry for iOS builds.

---

## 10. EAS build pipeline (what happens on the server)

High level from Expo’s [iOS build process](https://docs.expo.dev/build-reference/ios-builds/):

1. Upload project → macOS VM.  
2. `npm install` → `npx expo-doctor`.  
3. **Managed workflow:** `npx expo prebuild` generates `ios/`.  
4. `pod install` → **Fastlane gym** → `.ipa` artifact.

If anything fails, **read the first red error** in the EAS log—often CocoaPods, signing, or a config plugin.

---

## 11. Local development (optional, requires Mac)

```bash
npx expo prebuild -p ios
cd ios && pod install && cd ..
npx expo run:ios
```

Use a **development build** (`eas build --profile development`) when testing native modules not in Expo Go.

---

## 12. App Store Connect & compliance

### 12.1 TestFlight

- Upload with **`eas submit -p ios`** or Xcode Organizer.  
- Internal testing → external beta → production.

### 12.2 Privacy nutrition labels

Declare data collected (health, fitness, photos, crash data, etc.) to match actual SDK behavior—especially after adding HealthKit.

### 12.3 Export compliance / encryption

Apple asks whether your app uses encryption. Many apps using HTTPS-only can select the **standard exemption**; answer truthfully based on your code (local DB encryption, custom crypto, etc.—see `database/encryptionHelpers.ts`).

### 12.4 HealthKit review

Health-related apps may receive **extra scrutiny**. Ensure strings explain **why** you read/write each data type.

---

## 13. QA checklist (before “ready for store”)

- [ ] `npx expo-doctor` clean locally and on CI.  
- [ ] Cold start on iOS: no red box, Sentry test event.  
- [ ] Onboarding completes without Android-only routes breaking iOS.  
- [ ] Health: permission flows, sync, write workout/nutrition, error handling offline.  
- [ ] Notifications: permission, scheduled local notifications, tap-to-open.  
- [ ] Camera, OCR, barcode flows on real device.  
- [ ] Tablet layout (`supportsTablet: true`).  
- [ ] Dark mode / `userInterfaceStyle: automatic`.  
- [ ] Regression on Android after refactors (Metro `.android.ts` resolution).

---

## 14. Files likely to change (reference)

| Area | Files / dirs |
|------|----------------|
| Config | `app.json`, `eas.json`, optionally `app.config.js` |
| Health core | `services/healthConnect.ts` → split; `healthDataSync.ts`, `healthConnectFitness.ts`, `healthConnectWorkout.ts`, `healthConnectNutrition.ts`, `healthDataTransform.ts`, `healthConnectErrors.ts` |
| App shell | `app/_layout.tsx` |
| Hooks | `hooks/useHealthConnectPermissions.ts`, `hooks/useSyncTracking.ts` |
| Screens | `app/onboarding/health-connect.tsx`, `app/progress.tsx`, `components/modals/PastWorkoutDetailModal.tsx`, `components/modals/BasicSettingsModal.tsx` |
| DB services | `database/services/NutritionService.ts`, `WorkoutService.ts`, `UserMetricService.ts` (Android guards) |
| i18n | `lang/**` — Apple Health vs Health Connect strings |
| Widgets | `widgets/*` (Android only until WidgetKit exists) |

---

## 15. Open questions (for you)

1. **Minimum iOS version:** Any business requirement (e.g. iOS 16+) beyond Expo’s default?  
2. **Health scope v1:** Full parity with Android Health Connect on day one, or phased (read-only first)?  
3. **Push vs local notifications:** Remote push needs APNs key + possibly `expo-notifications` channel changes—confirm product requirements (`enableBackgroundRemoteNotifications` is currently `false` in `app.json`).  
4. **Widgets on iOS:** Planned for v1 or explicitly out of scope?  
5. **Team:** Who can log into Apple Developer for EAS credential generation?

---

## 16. Quick command reference

| Command | Purpose |
|---------|---------|
| `npm run ios` | Local dev build (needs Mac + Xcode). |
| `npx expo prebuild -p ios` | Generate `ios/` native project. |
| `eas build -p ios --profile production` | Cloud release candidate. |
| `eas submit -p ios` | Upload to App Store Connect. |
| `eas credentials` | Manage signing assets. |
| `npm run lint:all` / `npm run typecheck` | Repo gates from `CLAUDE.md`. |

---

**Plan status:** Living document — update as HealthKit integration lands and EAS/Apple requirements change.
