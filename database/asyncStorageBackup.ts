import AsyncStorage from '@react-native-async-storage/async-storage';

import { ASYNC_STORAGE_EXCLUDED_KEYS, isWebBackupStorageKey } from '@/constants/exportImport';

export type AsyncStorageDump = Record<string, string | null>;

export async function captureAsyncStorageDump(): Promise<AsyncStorageDump> {
  const allKeys = await AsyncStorage.getAllKeys();
  // `isWebBackupStorageKey` covers the recovery-point payloads AND their bookkeeping — the
  // index and the schema-version marker. Excluding only the payload prefix meant an export
  // embedded an index listing backups whose contents were deliberately left out, so a
  // restore wrote a phantom index whose entries read back `null`, plus another install's
  // db-version marker. One predicate, same answer on every path that touches these keys.
  const keysToBackup = allKeys.filter(
    (key) => !ASYNC_STORAGE_EXCLUDED_KEYS.has(key) && !isWebBackupStorageKey(key)
  );

  if (keysToBackup.length === 0) {
    return {};
  }

  const pairs = await AsyncStorage.multiGet(keysToBackup);
  const asyncStorageData: AsyncStorageDump = {};
  for (const [key, value] of pairs) {
    asyncStorageData[key] = value;
  }

  return asyncStorageData;
}
