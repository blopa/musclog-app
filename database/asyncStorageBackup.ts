import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ASYNC_STORAGE_EXCLUDED_KEYS,
  ASYNC_STORAGE_EXCLUDED_PREFIXES,
} from '@/constants/exportImport';

export type AsyncStorageDump = Record<string, string | null>;

export async function captureAsyncStorageDump(): Promise<AsyncStorageDump> {
  const allKeys = await AsyncStorage.getAllKeys();
  const keysToBackup = allKeys.filter(
    (key) =>
      !ASYNC_STORAGE_EXCLUDED_KEYS.has(key) &&
      !ASYNC_STORAGE_EXCLUDED_PREFIXES.some((prefix) => key.startsWith(prefix))
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
