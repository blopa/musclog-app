import { requireOptionalNativeModule } from 'expo';

/**
 * Why Apple Intelligence can or cannot answer, as `SystemLanguageModel.default.availability`
 * reports it. `unsupportedOs` covers iOS before 26 and every non-Apple platform; `unknown` is a
 * case a newer SDK added that this build does not know.
 */
export type AppleAvailability =
  | 'available'
  | 'deviceNotEligible'
  | 'appleIntelligenceNotEnabled'
  | 'modelNotReady'
  | 'unsupportedOs'
  | 'unknown';

/**
 * The small native helper behind on-device AI (`ios/OnDeviceAiModule.swift`,
 * `android/…/OnDeviceAiModule.kt`):
 * - `appleAvailability` / `appleSupportsLocale`: the reasons `@react-native-ai/apple` 0.12 hides
 *   behind one boolean.
 * - `storageDirectory`: where downloaded models live. On Android that is `noBackupFilesDir`, which
 *   Auto Backup never copies (a 300 MB model would exceed its 25 MB limit and stop the app's data
 *   backups); on iOS it is the document directory, excluded from iCloud backups below.
 * - `sha256File`: hashes a file in 1 MB chunks off the shared module queue (JS hashing 300 MB
 *   would block the thread for tens of seconds).
 * - `setExcludedFromBackup`: iOS `isExcludedFromBackup`; a no-op on Android.
 *
 * `null` on web, in Jest, and in a build made before the module existed. Callers treat that as
 * "no local model can be installed here", never as an error.
 */
export type OnDeviceAiNativeModule = {
  appleAvailability(): AppleAvailability;
  appleSupportsLocale(languageTag: string): boolean;
  /** A `file://` URI, with no trailing slash. */
  storageDirectory(): string;
  /** Lowercase hex digest of the whole file. Rejects when the file cannot be read. */
  sha256File(path: string): Promise<string>;
  setExcludedFromBackup(path: string): Promise<boolean>;
};

// A runtime without the native-module loader (a unit test, an old Expo) reads as "no module", the
// same as a build that does not contain it; every caller already copes with `null`.
export const onDeviceAiModule: OnDeviceAiNativeModule | null =
  typeof requireOptionalNativeModule === 'function'
    ? requireOptionalNativeModule<OnDeviceAiNativeModule>('OnDeviceAi')
    : null;
