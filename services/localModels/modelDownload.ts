/**
 * Fetching a model's files into `.partial/`: the download loop and its stop requests, the record a
 * paused download resumes from, and the room a download still needs. It publishes nothing: the
 * store (`modelStore.ts`) owns the state and hears about progress through callbacks.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import type { LocalModelManifest } from '@/constants/localModels';
import {
  ensureDirectory,
  excludeFromBackup,
  listFolders,
  partialUri,
  removeQuietly,
  reportModelFailure,
} from '@/services/localModels/modelFolders';
import {
  checkSpace,
  filesFor,
  type LocalModelSelection,
  modelFileUrl,
  type SpaceCheck,
  totalDownloadBytes,
} from '@/utils/localModels/install';

const PROGRESS_PUBLISH_MS = 250;

type StopRequest = 'pause' | 'cancel';

export type DownloadTask = {
  resumable: FileSystem.DownloadResumable | null;
  /** What was asked of the running download; a cancel overrides a pause. */
  stop: StopRequest | null;
  /** The download loop has reached a stop point and returned. */
  reachedStop: boolean;
  /** The task ended on a pause or cancel, so the requester (not the task) finishes up and releases it. */
  handoff: boolean;
  completedPaths: Set<string>;
  completedBytes: number;
  done: Promise<void>;
};

export function createDownloadTask(): DownloadTask {
  return {
    resumable: null,
    stop: null,
    reachedStop: false,
    handoff: false,
    completedPaths: new Set(),
    completedBytes: 0,
    done: Promise.resolve(),
  };
}

/** A function, so TypeScript does not narrow `stop` across the awaits that change it. */
export function stopOf(task: DownloadTask): StopRequest | null {
  return task.stop;
}

export function isCancelled(task: DownloadTask): boolean {
  return stopOf(task) === 'cancel';
}

class DownloadStopped extends Error {}

export class DownloadHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

/**
 * The one stop check of the download loop: throws once a pause or cancel was requested (and records
 * that the loop has stopped), so `downloadFiles` catches it once instead of at every await.
 * `cancelledOnly` ignores a pause.
 */
function checkpoint(task: DownloadTask, cancelledOnly = false): void {
  const requested = cancelledOnly ? isCancelled(task) : stopOf(task) !== null;
  if (requested) {
    task.reachedStop = true;
    throw new DownloadStopped();
  }
}

export type SavedDownload = {
  revision: string;
  path: string;
  selection: LocalModelSelection;
  resumeData: string;
};

export type SavedDownloadRecord = {
  /** The paused download of the current revision, or null. */
  read(): Promise<SavedDownload | null>;
  write(value: SavedDownload | null): Promise<void>;
};

/** The AsyncStorage record one store keeps its paused download in. */
export function savedDownloadRecord(
  storageKey: string,
  manifest: LocalModelManifest
): SavedDownloadRecord {
  return {
    async read() {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const value = raw ? (JSON.parse(raw) as Partial<SavedDownload>) : null;
        if (
          !value ||
          value.revision !== manifest.revision ||
          typeof value.path !== 'string' ||
          typeof value.resumeData !== 'string' ||
          !value.selection
        ) {
          return null;
        }

        return value as SavedDownload;
      } catch (error) {
        reportModelFailure(error, 'savedDownload');
        return null;
      }
    },
    async write(value) {
      try {
        if (value) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(value));
        } else {
          await AsyncStorage.removeItem(storageKey);
        }
      } catch (error) {
        // Losing resume data only costs a restart of the file, but it should not go unnoticed.
        reportModelFailure(error, 'savedDownload');
      }
    },
  };
}

/** The size of a regular file, or null when it is missing, a directory or unreadable. */
async function fileSizeOf(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory && typeof info.size === 'number' ? info.size : null;
  } catch {
    // Unreadable counts as nothing.
    return null;
  }
}

/** Bytes already on disk for a selection in `.partial/`. */
export async function partialBytes(
  root: string,
  manifest: LocalModelManifest,
  selection: LocalModelSelection
): Promise<number> {
  let sum = 0;
  for (const file of filesFor(manifest, selection)) {
    const size = await fileSizeOf(`${partialUri(root, manifest)}/${file.path}`);
    if (size !== null) {
      sum += Math.min(size, file.bytes);
    }
  }

  return sum;
}

/** The room a download still needs, after what a retry can reuse or discard is accounted for. */
export async function checkDownloadSpace(options: {
  freeBytes: number | null;
  /** Null where no model can be installed. */
  root: string | null;
  manifest: LocalModelManifest;
  selection: LocalModelSelection;
  saved: SavedDownloadRecord;
}): Promise<SpaceCheck> {
  const { freeBytes: free, root, manifest, selection, saved: record } = options;
  if (!root || free === null) {
    return checkSpace(free, manifest, selection);
  }

  const saved = await record.read();
  const wanted = filesFor(manifest, selection);
  const wantedPaths = new Set(wanted.map((file) => file.path));
  const partialDir = partialUri(root, manifest);
  let reusable = 0;
  let reclaimable = 0;

  // An unreadable file (fileSizeOf null) cannot be counted as reusable or reclaimable.
  for (const file of wanted) {
    const size = await fileSizeOf(`${partialDir}/${file.path}`);
    if (size === null) {
      continue;
    }

    const isResumable =
      size === file.bytes ||
      (saved?.path === file.path && saved.selection.withProjector === selection.withProjector);
    if (isResumable) {
      reusable += Math.min(size, file.bytes);
    } else {
      reclaimable += size;
    }
  }

  for (const name of await listFolders(partialDir)) {
    if (wantedPaths.has(name)) {
      continue;
    }

    reclaimable += (await fileSizeOf(`${partialDir}/${name}`)) ?? 0;
  }

  const result = checkSpace(free + reusable + reclaimable, manifest, selection);
  return result.enough
    ? result
    : {
        ...result,
        freeBytes: free,
        neededBytes: Math.max(0, result.neededBytes - reusable - reclaimable),
      };
}

type DownloadFilesOptions = {
  root: string;
  manifest: LocalModelManifest;
  selection: LocalModelSelection;
  task: DownloadTask;
  saved: SavedDownloadRecord;
  /** Whether `task` is still the download in flight; progress of a replaced one is dropped. */
  isCurrent: () => boolean;
  onProgress: (receivedBytes: number, totalBytes: number) => void;
};

/** Runs the download; a pause or cancel resolves 'stopped' instead of throwing. */
export async function downloadFiles(options: DownloadFilesOptions): Promise<'done' | 'stopped'> {
  try {
    await downloadUntilStopped(options);

    return 'done';
  } catch (error) {
    if (error instanceof DownloadStopped) {
      return 'stopped';
    }

    throw error;
  }
}

async function downloadUntilStopped({
  root,
  manifest,
  selection,
  task,
  saved: record,
  isCurrent,
  onProgress,
}: DownloadFilesOptions): Promise<void> {
  const dir = partialUri(root, manifest);
  await ensureDirectory(dir);
  await excludeFromBackup(root);
  checkpoint(task);

  const wanted = filesFor(manifest, selection);
  const wantedPaths = new Set(wanted.map((file) => file.path));
  for (const name of await listFolders(dir)) {
    if (!wantedPaths.has(name)) {
      await removeQuietly(`${dir}/${name}`);
    }
  }

  checkpoint(task);

  const total = totalDownloadBytes(manifest, selection);
  let completed = 0;
  let lastPublish = 0;
  const completeFile = (path: string, bytes: number) => {
    task.completedPaths.add(path);
    completed += bytes;
    task.completedBytes = completed;
  };

  for (const file of wanted) {
    checkpoint(task);

    const destination = `${dir}/${file.path}`;
    const existing = await FileSystem.getInfoAsync(destination);
    checkpoint(task);

    if (existing.exists && !existing.isDirectory && existing.size === file.bytes) {
      completeFile(file.path, file.bytes);
      onProgress(completed, total);
      continue;
    }

    const saved = await record.read();
    checkpoint(task);

    const resumeData =
      saved &&
      saved.path === file.path &&
      saved.selection.withProjector === selection.withProjector &&
      saved.resumeData
        ? saved.resumeData
        : undefined;
    if (!resumeData && existing.exists) {
      // A partial file nothing can resume: fetch it again from the start.
      await removeQuietly(destination);
    }

    checkpoint(task);

    const baseBytes = completed;
    const resumable = FileSystem.createDownloadResumable(
      modelFileUrl(manifest, file),
      destination,
      {},
      (progress) => {
        const now = Date.now();
        if (isCurrent() && stopOf(task) === null && now - lastPublish >= PROGRESS_PUBLISH_MS) {
          lastPublish = now;
          onProgress(Math.min(total, baseBytes + progress.totalBytesWritten), total);
        }
      },
      resumeData
    );
    task.resumable = resumable;

    let result: FileSystem.FileSystemDownloadResult | undefined;
    try {
      result = await resumable.downloadAsync();
    } finally {
      if (task.resumable === resumable) {
        task.resumable = null;
      }
    }

    checkpoint(task, true);

    const failed = !result || result.status < 200 || result.status >= 300;
    if (failed) {
      checkpoint(task);
      throw new DownloadHttpError(result?.status ?? 0);
    }

    await record.write(null);
    checkpoint(task, true);

    completeFile(file.path, file.bytes);
    if (stopOf(task) !== 'pause') {
      onProgress(completed, total);
    }
  }
}
