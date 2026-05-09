import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cacheDirectory,
  deleteAsync,
  documentDirectory,
  readDirectoryAsync,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { DATABASE_NAME, ENCRYPTION_KEY } from '@/constants/database';
import { database } from '@/database/database-instance';
import { reloadApp } from '@/utils/app';
import { deleteStoredEncryptionKey } from '@/utils/encryptionKeyStorage';

const DATABASE_FILE_NAMES = new Set([
  `${DATABASE_NAME}.db`,
  `${DATABASE_NAME}.db-shm`,
  `${DATABASE_NAME}.db-wal`,
]);

function joinUri(baseUri: string, childName: string): string {
  return `${baseUri.replace(/\/?$/, '/')}${childName}`;
}

async function deleteDirectoryContents(
  directoryUri: string | null,
  shouldSkip?: (childName: string) => boolean
): Promise<void> {
  if (!directoryUri || Platform.OS === 'web') {
    return;
  }

  let childNames: string[];
  try {
    childNames = await readDirectoryAsync(directoryUri);
  } catch {
    return;
  }

  await Promise.all(
    childNames
      .filter((childName) => !shouldSkip?.(childName))
      .map((childName) => deleteAsync(joinUri(directoryUri, childName), { idempotent: true }))
  );
}

export async function clearAllAppData(): Promise<void> {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });

  await AsyncStorage.clear();
  await deleteStoredEncryptionKey(ENCRYPTION_KEY);

  await Promise.all([
    deleteDirectoryContents(cacheDirectory),
    deleteDirectoryContents(documentDirectory, (childName) => DATABASE_FILE_NAMES.has(childName)),
  ]);

  await reloadApp();
}
