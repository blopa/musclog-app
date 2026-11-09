import { formatAppRoundedDecimal } from './formatAppNumber';

/**
 * Pure rules for the Settings → Storage screen: what the categories are, which cache entries the
 * app may delete, and how sizes read. The file system itself is `services/storageUsage.ts`.
 */

export const STORAGE_CATEGORY_IDS = [
  'database',
  'photos',
  'sensorRecordings',
  'recoveryPoints',
  'exerciseImages',
  'temporary',
] as const;
export type StorageCategoryId = (typeof STORAGE_CATEGORY_IDS)[number];

/** The only categories the app offers to clear: both are rebuilt or recreated on demand. */
export const CLEARABLE_STORAGE_CATEGORY_IDS = ['exerciseImages', 'temporary'] as const;
export type ClearableStorageCategoryId = (typeof CLEARABLE_STORAGE_CATEGORY_IDS)[number];

export function isClearableStorageCategory(
  id: StorageCategoryId
): id is ClearableStorageCategoryId {
  return (CLEARABLE_STORAGE_CATEGORY_IDS as readonly StorageCategoryId[]).includes(id);
}

/** A temporary file younger than this may still be in use (a share sheet, a photo being edited). */
export const TEMPORARY_MIN_AGE_MS = 60 * 60 * 1000;

/**
 * Directories inside the cache the app (or a library it drives) fills with throwaway files. Any
 * other cache directory belongs to a library's own cache (image loaders keep journals there) and
 * is never touched. The live sensor recording (`ble-workout-tracking`) is deliberately absent.
 */
export const TEMPORARY_CACHE_DIRECTORIES: ReadonlySet<string> = new Set([
  'ble-workout-share',
  'ImageManipulator',
  'ImagePicker',
]);

export type CacheEntry = {
  name: string;
  uri: string;
  isDirectory: boolean;
  bytes: number;
  /** Milliseconds since epoch, or null when the platform did not say. */
  modifiedMs: number | null;
};

export type TemporaryCleanupPlan = {
  remove: CacheEntry[];
  /** Counted as temporary but too new to delete now. */
  tooNew: CacheEntry[];
};

/**
 * Splits the cache's top-level entries into what a cleanup removes and what is not temporary.
 * `protectedUris` are the safety backups (and their sidecars) registered in the backup index —
 * they live in the cache directory too, and a cleanup must never delete a recovery point.
 */
export function planTemporaryCleanup(
  entries: readonly CacheEntry[],
  protectedUris: ReadonlySet<string>,
  now: number
): TemporaryCleanupPlan {
  const remove: CacheEntry[] = [];
  const tooNew: CacheEntry[] = [];

  for (const entry of entries) {
    if (!isTemporaryEntry(entry, protectedUris)) {
      continue;
    }

    // An entry whose age is unknown is treated as new: deleting it is never worth a guess.
    if (entry.modifiedMs === null || now - entry.modifiedMs < TEMPORARY_MIN_AGE_MS) {
      tooNew.push(entry);
      continue;
    }

    remove.push(entry);
  }

  return { remove, tooNew };
}

/** Whether an entry of the cache counts as a temporary file (before the age check). */
export function isTemporaryEntry(entry: CacheEntry, protectedUris: ReadonlySet<string>): boolean {
  if (protectedUris.has(entry.uri)) {
    return false;
  }

  return entry.isDirectory ? TEMPORARY_CACHE_DIRECTORIES.has(entry.name) : true;
}

export type StorageUnitKey = 'b' | 'kb' | 'mb' | 'gb';

const STORAGE_UNIT_STEPS: readonly StorageUnitKey[] = ['b', 'kb', 'mb', 'gb'];

/** Decimal (1000-based) like the phone's own storage screen. */
export function splitStorageSize(bytes: number): { value: number; unit: StorageUnitKey } {
  let value = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  let step = 0;
  while (value >= 1000 && step < STORAGE_UNIT_STEPS.length - 1) {
    value /= 1000;
    step += 1;
  }

  return { value, unit: STORAGE_UNIT_STEPS[step] };
}

/**
 * "12.4 MB", "830 KB", "0 B". `unitLabels` come from the translations so each language writes its
 * own abbreviations.
 */
export function formatStorageSize(
  locale: string,
  bytes: number,
  unitLabels: Record<StorageUnitKey, string>
): string {
  const { value, unit } = splitStorageSize(bytes);
  // Whole bytes and kilobytes need no fraction; larger sizes keep one digit.
  const digits = unit === 'b' || unit === 'kb' || value >= 100 ? 0 : 1;

  return `${formatAppRoundedDecimal(locale, value, digits)} ${unitLabels[unit]}`;
}
