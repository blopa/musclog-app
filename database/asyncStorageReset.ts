import AsyncStorage from '@react-native-async-storage/async-storage';

import { isWebBackupStorageKey } from '@/constants/exportImport';

/**
 * Wipe app state out of AsyncStorage without using `AsyncStorage.clear()`.
 *
 * On web `AsyncStorage` is `window.localStorage`, and `clear()` is
 * `localStorage.clear()` — a whole-origin wipe that also destroys every stored web
 * recovery point (`musclog_backup_data_*`), the backup index and the schema-version
 * marker. A restore that begins by deleting the user's backups has no safety net left
 * when it fails, so every wipe path goes through these helpers instead. Native
 * AsyncStorage holds only app keys, so enumerating them is equivalent to `clear()`.
 */
async function removeStaleKeys(keptKeys: Set<string>): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const stale = allKeys.filter((key) => !keptKeys.has(key) && !isWebBackupStorageKey(key));
  if (stale.length > 0) {
    await AsyncStorage.multiRemove(stale);
  }
}

/** Remove every app key except `preservedKeys` (and the web recovery points). */
export async function clearAppAsyncStorage(preservedKeys: Iterable<string> = []): Promise<void> {
  await removeStaleKeys(new Set(preservedKeys));
}

/**
 * Swap AsyncStorage over to a restored snapshot.
 *
 * The pairs are written *before* the stale keys are removed, so a key the snapshot also
 * carries — `onboardingCompleted`, `seeding_complete`, `currentUserSyncId` — is overwritten
 * in place and never momentarily absent. Clearing first left a window in which the app
 * looked un-onboarded and un-seeded, and a failure inside that window made the next boot's
 * `seedProductionData()` wipe the freshly restored database and send the user back to
 * onboarding.
 */
export async function replaceAppAsyncStorage(
  pairs: [string, string][],
  preservedKeys: Iterable<string> = []
): Promise<void> {
  if (pairs.length > 0) {
    await AsyncStorage.multiSet(pairs);
  }

  await removeStaleKeys(new Set([...pairs.map(([key]) => key), ...preservedKeys]));
}
