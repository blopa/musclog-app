import {
  cacheDirectory,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  readDirectoryAsync,
} from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { DATABASE_NAME } from '@/constants/database';
import { getStoredBackups } from '@/database/preMigrationBackup';
import {
  type CacheEntry,
  type ClearableStorageCategoryId,
  planTemporaryCleanup,
  type StorageCategoryId,
  TEMPORARY_CACHE_DIRECTORIES,
  isTemporaryEntry,
} from '@/utils/storageUsage';

export type StorageCategorySize = { id: StorageCategoryId; bytes: number };
export type StorageReport = { categories: StorageCategorySize[]; totalBytes: number };

/** Photos the person took of foods, meals and custom exercises: theirs, never offered for clearing. */
const USER_PHOTO_DIRECTORIES = ['foods', 'meals', 'exercises', 'food_images'] as const;
const EXERCISE_IMAGE_CACHE_DIRECTORY = 'exercise-images';
const SENSOR_RECORDING_DIRECTORY = 'ble-workout-data';

export const isStorageUsageSupported = (): boolean =>
  Platform.OS !== 'web' && Boolean(documentDirectory) && Boolean(cacheDirectory);

const withTrailingSlash = (uri: string): string => (uri.endsWith('/') ? uri : `${uri}/`);
const stripTrailingSlash = (uri: string): string => uri.replace(/\/+$/, '');

async function infoOf(
  uri: string
): Promise<{ exists: boolean; isDirectory: boolean; size: number; modifiedMs: number | null }> {
  try {
    const info = await getInfoAsync(uri);
    if (!info.exists) {
      return { exists: false, isDirectory: false, size: 0, modifiedMs: null };
    }

    return {
      exists: true,
      isDirectory: info.isDirectory,
      size: typeof info.size === 'number' ? info.size : 0,
      modifiedMs: typeof info.modificationTime === 'number' ? info.modificationTime * 1000 : null,
    };
  } catch {
    return { exists: false, isDirectory: false, size: 0, modifiedMs: null };
  }
}

/** Total bytes of a file, or of every file below a directory. Unreadable entries count as 0. */
async function sizeOf(uri: string): Promise<number> {
  const info = await infoOf(uri);
  if (!info.exists) {
    return 0;
  }

  if (!info.isDirectory) {
    return info.size;
  }

  let children: string[];
  try {
    children = await readDirectoryAsync(uri);
  } catch {
    return 0;
  }

  const base = withTrailingSlash(uri);
  const sizes = await Promise.all(children.map((child) => sizeOf(`${base}${child}`)));

  return sizes.reduce((sum, size) => sum + size, 0);
}

async function readCacheEntries(): Promise<CacheEntry[]> {
  if (!cacheDirectory) {
    return [];
  }

  let names: string[];
  try {
    names = await readDirectoryAsync(cacheDirectory);
  } catch {
    return [];
  }

  const base = withTrailingSlash(cacheDirectory);
  const entries = await Promise.all(
    names.map(async (name): Promise<CacheEntry | null> => {
      const uri = `${base}${name}`;
      const info = await infoOf(uri);
      if (!info.exists) {
        return null;
      }

      // A directory's own `size` is not its contents; only measure the ones we may delete.
      const bytes = info.isDirectory
        ? TEMPORARY_CACHE_DIRECTORIES.has(name)
          ? await sizeOf(uri)
          : 0
        : info.size;

      return { name, uri, isDirectory: info.isDirectory, bytes, modifiedMs: info.modifiedMs };
    })
  );

  return entries.filter((entry): entry is CacheEntry => entry !== null);
}

/** The safety backups (and their sidecars) registered in the backup index: never temporary. */
async function protectedBackupUris(): Promise<Set<string>> {
  const backups = await getStoredBackups();
  const uris = new Set<string>();
  for (const backup of backups) {
    uris.add(backup.uri);
    if (backup.asyncStorageUri) {
      uris.add(backup.asyncStorageUri);
    }
  }

  return uris;
}

async function databaseBytes(): Promise<number> {
  if (!documentDirectory) {
    return 0;
  }

  // WatermelonDB's file sits in the document directory on iOS and the app-data root on Android;
  // `wdbDir()` knows which, but only the document directory is reachable here, so on Android the
  // sibling `files/..` path is used.
  const roots =
    Platform.OS === 'android'
      ? [stripTrailingSlash(documentDirectory).replace(/\/files$/, '')]
      : [stripTrailingSlash(documentDirectory)];
  const names = [`${DATABASE_NAME}.db`, `${DATABASE_NAME}.db-wal`, `${DATABASE_NAME}.db-shm`];
  const sizes = await Promise.all(
    roots.flatMap((root) => names.map((name) => sizeOf(`${root}/${name}`)))
  );

  return sizes.reduce((sum, size) => sum + size, 0);
}

/** Measures every category; null where the platform has no file system access (web). */
export async function measureStorage(): Promise<StorageReport | null> {
  if (!isStorageUsageSupported() || !documentDirectory) {
    return null;
  }

  const documents = withTrailingSlash(documentDirectory);
  const [database, photoSizes, sensor, exerciseImages, cacheEntries, protectedUris] =
    await Promise.all([
      databaseBytes(),
      Promise.all(USER_PHOTO_DIRECTORIES.map((name) => sizeOf(`${documents}${name}`))),
      sizeOf(`${documents}${SENSOR_RECORDING_DIRECTORY}`),
      sizeOf(`${documents}${EXERCISE_IMAGE_CACHE_DIRECTORY}`),
      readCacheEntries(),
      protectedBackupUris(),
    ]);

  const recoveryPoints = cacheEntries
    .filter((entry) => protectedUris.has(entry.uri))
    .reduce((sum, entry) => sum + entry.bytes, 0);
  const temporary = cacheEntries
    .filter((entry) => isTemporaryEntry(entry, protectedUris))
    .reduce((sum, entry) => sum + entry.bytes, 0);

  const categories: StorageCategorySize[] = [
    { id: 'database', bytes: database },
    { id: 'photos', bytes: photoSizes.reduce((sum, size) => sum + size, 0) },
    { id: 'sensorRecordings', bytes: sensor },
    { id: 'recoveryPoints', bytes: recoveryPoints },
    { id: 'exerciseImages', bytes: exerciseImages },
    { id: 'temporary', bytes: temporary },
  ];

  return {
    categories,
    totalBytes: categories.reduce((sum, category) => sum + category.bytes, 0),
  };
}

async function deleteAll(uris: string[]): Promise<void> {
  await Promise.all(uris.map((uri) => deleteAsync(uri, { idempotent: true })));
}

/** Deletes the downloaded exercise pictures; they download again the next time one is shown. */
async function clearExerciseImages(): Promise<number> {
  if (!documentDirectory) {
    return 0;
  }

  const uri = `${withTrailingSlash(documentDirectory)}${EXERCISE_IMAGE_CACHE_DIRECTORY}`;
  const before = await sizeOf(uri);
  await deleteAll([uri]);

  return before;
}

/**
 * Deletes leftover export, share and photo-editing files older than an hour. Registered safety
 * backups, the live sensor recording and every library-owned cache directory are left alone.
 */
async function clearTemporaryFiles(): Promise<number> {
  const [entries, protectedUris] = await Promise.all([readCacheEntries(), protectedBackupUris()]);
  const { remove } = planTemporaryCleanup(entries, protectedUris, Date.now());
  await deleteAll(remove.map((entry) => entry.uri));

  return remove.reduce((sum, entry) => sum + entry.bytes, 0);
}

/** Clears one category and returns the bytes it freed. Throws if the platform has no storage. */
export async function clearStorageCategory(id: ClearableStorageCategoryId): Promise<number> {
  if (!isStorageUsageSupported()) {
    throw new Error('Storage cleanup is not available on this platform');
  }

  return id === 'exerciseImages' ? clearExerciseImages() : clearTemporaryFiles();
}
