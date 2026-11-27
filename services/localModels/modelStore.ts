/**
 * The downloaded on-device models: where they live, what state each download is in, and how it gets
 * installed. There are two stores built by one factory (`createLocalModelStore`): `localModelStore`
 * for the main model (`DEFAULT_LOCAL_MODEL`, under `<root>/models` and `<root>/.partial`) and
 * `localTextModelStore` for the optional text model (`LOCAL_TEXT_MODEL`, under `<root>/text`). Each has
 * its own snapshot, listeners, queue, running download and saved-download key, and neither ever scans
 * or deletes the other's files. Module-level (like `premiumStore`), so a download keeps going while
 * the screen that started it is closed, and any number of screens can watch it through `subscribe`.
 * The named functions further down (`getLocalModelSnapshot`, …) are the main model's store.
 *
 * The install is all-or-nothing: files are fetched into `.partial/`, hashed with SHA-256 and only
 * then moved into `models/<id>@<revision>/`, with `installed.json` written LAST. The runtime reads
 * only folders whose `installed.json` matches the manifest (`getInstalledLocalModel`), so a
 * half-finished install can never be loaded.
 *
 * Resuming: a pause inside a session resumes the same file. A download killed with the app restarts
 * the file it was on (the native resume data only exists after a clean pause), and says
 * `interrupted` until the person taps retry.
 *
 * Concurrency: start, cancel cleanup, delete, refresh and the end of a pause run one at a time
 * through one promise queue (`enqueue`, the shape `llamaRuntime` uses), so no two of them interleave
 * across awaits. The long download is a `DownloadTask` outside the queue: pause and cancel only ask
 * it to stop (`task.stop`, a cancel overriding a pause) and wait for it to end, then the follow-up
 * work (resume data, leftovers) is queued. A task never enqueues anything itself, so an operation
 * waiting for its end can never deadlock with it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  DEFAULT_LOCAL_MODEL,
  LOCAL_TEXT_MODEL,
  type LocalModelManifest,
} from '@/constants/localModels';
import { LOCAL_MODEL_DOWNLOAD_STATE, LOCAL_TEXT_MODEL_DOWNLOAD_STATE } from '@/constants/misc';
import { onDeviceAiModule } from '@/modules/on-device-ai';
import {
  ensureDirectory,
  INSTALLED_FILE,
  type InstalledLocalModel,
  listFolders,
  modelPathsFromRecord,
  modelsUri,
  partialUri,
  removeQuietly,
  rootUri,
  scanModels,
} from '@/services/localModels/modelFolders';
import { reportAiEvent } from '@/utils/aiTelemetry';
import { createListeners } from '@/utils/createListeners';
import { handleError } from '@/utils/handleError';
import {
  buildInstalledRecord,
  checkSpace,
  classifyDownloadFailure,
  DEFAULT_LOCAL_MODEL_SELECTION,
  filesFor,
  installFolderName,
  installHasProjector,
  type LocalModelFailure,
  type LocalModelInstallState,
  type LocalModelSelection,
  modelFileUrl,
  NETWORK_MESSAGE,
  NOT_INSTALLED,
  type SpaceCheck,
  staleInstallFolders,
  totalDownloadBytes,
} from '@/utils/localModels/install';
import { createSerialQueue } from '@/utils/serialQueue';

export type { InstalledLocalModel };

export type LocalModelSnapshot = {
  /** False where no model can be installed (web, or a build without the native helper). */
  supported: boolean;
  state: LocalModelInstallState;
  selection: LocalModelSelection;
  /** An older revision is installed; the current manifest wants a newer one. */
  updateAvailable: boolean;
  /** The installed model includes the photo projector. */
  projectorInstalled: boolean;
};

type SavedDownload = {
  revision: string;
  path: string;
  selection: LocalModelSelection;
  resumeData: string;
};

const PROGRESS_PUBLISH_MS = 250;

type StopRequest = 'pause' | 'cancel';

type DownloadTask = {
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

/** A function, so TypeScript does not narrow `stop` across the awaits that change it. */
function stopOf(task: DownloadTask): StopRequest | null {
  return task.stop;
}

function reportFailure(error: unknown, operation: string) {
  void handleError(error, `localModels.${operation}`, { showSnackbar: false });
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

async function excludeFromBackup(root: string): Promise<void> {
  await onDeviceAiModule?.setExcludedFromBackup(root).catch(() => false);
}

function isCancelled(task: DownloadTask): boolean {
  return stopOf(task) === 'cancel';
}

/**
 * The one stop check of the download loop: throws once a pause or cancel was requested (and records
 * that the loop has stopped), so `downloadFiles` catches it once instead of at every await.
 * `cancelledOnly` ignores a pause.
 */
function checkpoint(task: DownloadTask, cancelledOnly = false): void {
  if (stopRequested(task, cancelledOnly)) {
    throw new DownloadStopped();
  }
}

function stopRequested(task: DownloadTask, cancelledOnly = false): boolean {
  const requested = cancelledOnly ? isCancelled(task) : stopOf(task) !== null;
  if (requested) {
    task.reachedStop = true;
  }

  return requested;
}

class DownloadStopped extends Error {}

class DownloadHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

class ChecksumError extends Error {
  constructor(readonly path: string) {
    super(`Checksum mismatch for ${path}`);
  }
}

export async function getFreeDiskBytes(): Promise<number | null> {
  try {
    return await FileSystem.getFreeDiskStorageAsync();
  } catch (error) {
    reportFailure(error, 'freeSpace');
    return null;
  }
}

/** What tells one store from the other. */
type LocalModelStoreConfig = {
  manifest: LocalModelManifest;
  /** Folder under the local-AI root this store keeps its `models/` and `.partial/` in; null is the root itself. */
  subfolder: string | null;
  /** AsyncStorage key of the paused-download record. */
  downloadStateKey: string;
  defaultSelection: LocalModelSelection;
};

export type LocalModelStore = {
  readonly manifest: LocalModelManifest;
  getSnapshot(): LocalModelSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  getInstalled(): Promise<InstalledLocalModel | null>;
  getSpaceCheck(selection: LocalModelSelection): Promise<SpaceCheck>;
  start(selection?: LocalModelSelection): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  remove(): Promise<void>;
};

/** The store plus what only this module needs. */
type LocalModelStoreInternals = LocalModelStore & {
  registerUnloader(fn: () => Promise<void>): void;
  /** `remove` for a caller that has unloaded the runtime already. */
  removeWithoutUnload(): Promise<void>;
  /** Unloads once, removes `other`'s files, then this store's (one pass through this store's queue). */
  removeAlongside(other: LocalModelStoreInternals): Promise<void>;
  resetForTests(): void;
};

function createLocalModelStore(config: LocalModelStoreConfig): LocalModelStoreInternals {
  const { manifest } = config;

  let snapshot: LocalModelSnapshot = {
    supported: onDeviceAiModule !== null,
    state: NOT_INSTALLED,
    selection: config.defaultSelection,
    updateAvailable: false,
    projectorInstalled: false,
  };

  const { subscribe, notify, clear: clearListeners } = createListeners();

  /** The one download in flight (or ended and waiting for its pause/cancel follow-up). */
  let running: DownloadTask | null = null;
  /** Lifecycle operations run one at a time through this queue (see the module comment). */
  const queue = createSerialQueue();
  let unloader: (() => Promise<void>) | null = null;

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return queue.run(operation);
  }

  function publish(patch: Partial<LocalModelSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    notify();
  }

  /** The folder this store keeps its own `models/` and `.partial/` in; null where unsupported. */
  function baseUri(): string | null {
    const root = rootUri();
    if (!root) {
      return null;
    }

    return config.subfolder ? `${root}/${config.subfolder}` : root;
  }

  async function readSaved(): Promise<SavedDownload | null> {
    try {
      const raw = await AsyncStorage.getItem(config.downloadStateKey);
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
      reportFailure(error, 'savedDownload');
      return null;
    }
  }

  async function writeSaved(value: SavedDownload | null) {
    try {
      if (value) {
        await AsyncStorage.setItem(config.downloadStateKey, JSON.stringify(value));
      } else {
        await AsyncStorage.removeItem(config.downloadStateKey);
      }
    } catch {
      // Losing resume data only costs a restart of the file.
    }
  }

  /** Bytes already on disk for a selection in `.partial/`. */
  async function partialBytes(root: string, selection: LocalModelSelection): Promise<number> {
    let sum = 0;
    for (const file of filesFor(manifest, selection)) {
      const size = await fileSizeOf(`${partialUri(root, manifest)}/${file.path}`);
      if (size !== null) {
        sum += Math.min(size, file.bytes);
      }
    }

    return sum;
  }

  /** Reads the disk and publishes what is there. Runs only as a queue operation or inside a task. */
  async function scanDisk(): Promise<void> {
    const root = baseUri();
    if (!root) {
      publish({ supported: false, state: NOT_INSTALLED });

      return;
    }

    const modelsDir = modelsUri(root);
    const { folders, current, older, olderFolder, incomplete, validOlderFolders } =
      await scanModels(modelsDir, manifest);

    for (const name of incomplete) {
      await removeQuietly(`${modelsDir}/${name}`);
    }

    const partialRoot = `${root}/.partial`;
    const currentFolderName = installFolderName(manifest);
    for (const name of await listFolders(partialRoot)) {
      if (name !== currentFolderName) {
        await removeQuietly(`${partialRoot}/${name}`);
      }
    }

    if (current) {
      const remaining = folders.filter((name) => !incomplete.includes(name));
      const stale = staleInstallFolders(remaining, manifest, true);
      if (stale.length > 0 && unloader) {
        await unloader().catch(() => undefined);
      }

      for (const name of stale) {
        await removeQuietly(`${modelsDir}/${name}`);
      }

      publish({
        supported: true,
        state: {
          kind: 'ready',
          revision: current.revision,
          withProjector: installHasProjector(current),
        },
        updateAvailable: false,
        projectorInstalled: installHasProjector(current),
      });

      return;
    }

    for (const name of validOlderFolders) {
      if (name !== olderFolder) {
        await removeQuietly(`${modelsDir}/${name}`);
      }
    }

    const saved = await readSaved();
    const selection = saved?.selection ?? snapshot.selection;
    const received = await partialBytes(root, selection);
    const olderProjector = installHasProjector(older);
    if (saved && received > 0) {
      publish({
        supported: true,
        selection,
        state: {
          kind: 'paused',
          receivedBytes: received,
          totalBytes: totalDownloadBytes(manifest, selection),
        },
        updateAvailable: older !== null,
        projectorInstalled: olderProjector,
      });

      return;
    }

    if (received > 0) {
      // A partial file with no resume data: the app was closed mid-download.
      publish({
        supported: true,
        selection,
        state: { kind: 'failed', reason: 'interrupted' },
        updateAvailable: older !== null,
        projectorInstalled: olderProjector,
      });

      return;
    }

    if (older) {
      publish({
        supported: true,
        state: {
          kind: 'ready',
          revision: older.revision,
          withProjector: olderProjector,
        },
        updateAvailable: true,
        projectorInstalled: olderProjector,
      });

      return;
    }

    publish({
      supported: true,
      state: NOT_INSTALLED,
      updateAvailable: false,
      projectorInstalled: false,
    });
  }

  /**
   * Re-reads the disk and publishes what is there: an install, an older install, a paused or
   * interrupted download, or nothing. Does nothing while a download is running here.
   */
  function refresh(): Promise<void> {
    return enqueue(async () => {
      try {
        if (running) {
          return;
        }

        await scanDisk();
      } catch (error) {
        reportFailure(error, 'refresh');
      }
    });
  }

  /** The files the runtime may open: current revision first, or a usable older revision until updated. */
  async function getInstalled(): Promise<InstalledLocalModel | null> {
    const root = baseUri();
    if (!root) {
      return null;
    }

    const modelsDir = modelsUri(root);
    const { current, older, olderFolder } = await scanModels(modelsDir, manifest);
    if (current) {
      return modelPathsFromRecord(`${modelsDir}/${installFolderName(current)}`, current, manifest);
    }

    return olderFolder
      ? modelPathsFromRecord(`${modelsDir}/${olderFolder}`, older, manifest)
      : null;
  }

  /** Checks the space still needed after accounting for files a retry can reuse or discard. */
  async function getSpaceCheck(selection: LocalModelSelection): Promise<SpaceCheck> {
    const free = await getFreeDiskBytes();
    try {
      const root = baseUri();
      if (!root || free === null) {
        return checkSpace(free, manifest, selection);
      }

      const saved = await readSaved();
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
    } catch (error) {
      reportFailure(error, 'spaceCheck');
      return checkSpace(free, manifest, selection);
    }
  }

  function fail(reason: LocalModelFailure) {
    publish({ state: { kind: 'failed', reason } });
  }

  /** Runs the download; a pause or cancel resolves 'stopped' instead of throwing. */
  async function downloadFiles(
    root: string,
    selection: LocalModelSelection,
    task: DownloadTask
  ): Promise<'done' | 'stopped'> {
    try {
      return await downloadFilesUntilStopped(root, selection, task);
    } catch (error) {
      if (error instanceof DownloadStopped) {
        return 'stopped';
      }

      throw error;
    }
  }

  async function downloadFilesUntilStopped(
    root: string,
    selection: LocalModelSelection,
    task: DownloadTask
  ): Promise<'done' | 'stopped'> {
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

    for (const file of wanted) {
      checkpoint(task);

      const destination = `${dir}/${file.path}`;
      const existing = await FileSystem.getInfoAsync(destination);
      checkpoint(task);

      if (existing.exists && !existing.isDirectory && existing.size === file.bytes) {
        task.completedPaths.add(file.path);
        completed += file.bytes;
        task.completedBytes = completed;
        publish({ state: { kind: 'downloading', receivedBytes: completed, totalBytes: total } });
        continue;
      }

      const saved = await readSaved();
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
          if (
            running === task &&
            stopOf(task) === null &&
            now - lastPublish >= PROGRESS_PUBLISH_MS
          ) {
            lastPublish = now;
            publish({
              state: {
                kind: 'downloading',
                receivedBytes: Math.min(total, baseBytes + progress.totalBytesWritten),
                totalBytes: total,
              },
            });
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

      await writeSaved(null);
      checkpoint(task, true);

      task.completedPaths.add(file.path);
      completed += file.bytes;
      task.completedBytes = completed;
      if (stopOf(task) !== 'pause') {
        publish({ state: { kind: 'downloading', receivedBytes: completed, totalBytes: total } });
      }
    }

    return 'done';
  }

  async function verifyAndInstall(
    root: string,
    selection: LocalModelSelection,
    task: DownloadTask
  ): Promise<void> {
    const checkCancelled = () => {
      if (isCancelled(task)) {
        throw new Error('Download stopped');
      }
    };

    const native = onDeviceAiModule;
    if (!native) {
      throw new Error('On-device AI module is not available');
    }

    publish({ state: { kind: 'verifying' } });
    const dir = partialUri(root, manifest);
    for (const file of filesFor(manifest, selection)) {
      const digest = await native.sha256File(`${dir}/${file.path}`);
      checkCancelled();
      if (digest.toLowerCase() !== file.sha256) {
        await removeQuietly(`${root}/.partial`);
        await writeSaved(null);
        throw new ChecksumError(file.path);
      }
    }

    checkCancelled();
    publish({ state: { kind: 'installing' } });
    const modelsDir = modelsUri(root);
    await ensureDirectory(modelsDir);
    const folderName = installFolderName(manifest);
    const staging = `${modelsDir}/.${folderName}.staging`;
    const target = `${modelsDir}/${folderName}`;
    await removeQuietly(staging);
    checkCancelled();
    await ensureDirectory(staging);
    let committing = false;
    try {
      checkCancelled();
      for (const file of filesFor(manifest, selection)) {
        await FileSystem.moveAsync({ from: `${dir}/${file.path}`, to: `${staging}/${file.path}` });
        checkCancelled();
      }

      committing = true;
      await removeQuietly(target);
      checkCancelled();
      await FileSystem.moveAsync({ from: staging, to: target });
      // Last: its presence is what says every file above is in place.
      await FileSystem.writeAsStringAsync(
        `${target}/${INSTALLED_FILE}`,
        JSON.stringify(buildInstalledRecord(manifest, selection, Date.now()))
      );
      if (isCancelled(task)) {
        await removeQuietly(target);
        checkCancelled();
      }
    } catch (error) {
      await removeQuietly(staging);
      if (committing) {
        await removeQuietly(target);
      }

      throw error;
    }

    await excludeFromBackup(root);
    await removeQuietly(`${root}/.partial`);
    await writeSaved(null);

    const stale = staleInstallFolders(await listFolders(modelsDir), manifest, true);
    if (stale.length > 0 && unloader) {
      await unloader().catch(() => undefined);
    }

    for (const name of stale) {
      await removeQuietly(`${modelsDir}/${name}`);
    }
  }

  /** Admits a download if none is in flight; a queue operation. Returns the task, or null if none started. */
  async function admitDownload(selection: LocalModelSelection): Promise<DownloadTask | null> {
    if (running) {
      return null;
    }

    let root: string | null;
    try {
      root = baseUri();
    } catch (error) {
      fail('storage');
      reportFailure(error, 'download');
      return null;
    }

    if (!root || !onDeviceAiModule) {
      publish({ supported: false });
      return null;
    }

    const task: DownloadTask = {
      resumable: null,
      stop: null,
      reachedStop: false,
      handoff: false,
      completedPaths: new Set(),
      completedBytes: 0,
      done: Promise.resolve(),
    };
    running = task;
    task.done = runLocalModelDownload(root, selection, task);

    return task;
  }

  /**
   * Starts (or restarts) the download of `selection`. Resolves when it ends in any state and never
   * rejects: callers fire it with `void`, so a throw here would be an unhandled rejection. Behind a
   * delete (or any other lifecycle operation) it waits for that to finish first.
   */
  async function start(selection: LocalModelSelection = snapshot.selection): Promise<void> {
    const task = await enqueue(() => admitDownload(selection));
    await task?.done;
  }

  /** Never rejects and never enqueues: operations waiting for `task.done` must not wait on the queue. */
  async function runLocalModelDownload(
    root: string,
    selection: LocalModelSelection,
    task: DownloadTask
  ): Promise<void> {
    try {
      const space = await getSpaceCheck(selection);
      if (stopOf(task) !== null) {
        return;
      }

      if (!space.enough) {
        publish({ selection });
        fail('noSpace');
        return;
      }

      publish({
        selection,
        state: {
          kind: 'downloading',
          receivedBytes: 0,
          totalBytes: totalDownloadBytes(manifest, selection),
        },
      });
      const outcome = await downloadFiles(root, selection, task);
      if (outcome === 'done' && !isCancelled(task)) {
        // A pause that arrives as the last file lands has nothing left to pause: the install goes on.
        if (stopOf(task) === 'pause') {
          task.stop = null;
        }

        task.resumable = null;
        await verifyAndInstall(root, selection, task);
        if (isCancelled(task)) {
          return;
        }

        try {
          await scanDisk();
        } catch (error) {
          reportFailure(error, 'refresh');
        }
      }
    } catch (error) {
      if (stopOf(task) === null) {
        if (error instanceof ChecksumError) {
          fail('checksum');
          // A published file that no longer hashes to its manifest: a corrupt or swapped download.
          reportAiEvent('local-model-checksum-mismatch', {
            model: manifest.id,
            revision: manifest.revision,
            file: error.path,
          });
        } else {
          const status = error instanceof DownloadHttpError ? error.status : null;
          const message = error instanceof Error ? error.message : String(error);
          const reason = classifyDownloadFailure(status, message);
          fail(reason);
          if (reason !== 'noSpace' && !NETWORK_MESSAGE.test(message)) {
            reportFailure(error, 'download');
          }
        }
      }
    } finally {
      // After a pause or cancel the requester finishes up and releases the task.
      task.handoff = stopOf(task) !== null;
      if (!task.handoff && running === task) {
        running = null;
      }
    }
  }

  async function publishPaused(task: DownloadTask): Promise<void> {
    const root = baseUri();
    const diskBytes = root ? await partialBytes(root, snapshot.selection) : 0;
    const snapshotReceived =
      snapshot.state.kind === 'downloading' ? snapshot.state.receivedBytes : 0;
    const total = totalDownloadBytes(manifest, snapshot.selection);
    const received = Math.min(total, Math.max(snapshotReceived, task.completedBytes, diskBytes));

    publish({
      state: {
        kind: 'paused',
        receivedBytes: received,
        totalBytes: total,
      },
    });
  }

  type PauseState = Awaited<ReturnType<FileSystem.DownloadResumable['pauseAsync']>>;

  /** The queued end of a pause: keep the resume data and publish `paused`, unless a cancel took over. */
  async function finishPause(task: DownloadTask, state: PauseState | null): Promise<void> {
    if (running !== task || stopOf(task) !== 'pause') {
      return;
    }

    try {
      const filePath = state?.fileUri.split('/').pop() ?? '';
      if (state?.resumeData && !task.completedPaths.has(filePath)) {
        await writeSaved({
          revision: manifest.revision,
          path: filePath,
          selection: snapshot.selection,
          resumeData: state.resumeData,
        });
      }

      await publishPaused(task);
    } catch (error) {
      reportFailure(error, 'pause');
    } finally {
      if (running === task) {
        running = null;
      }
    }
  }

  async function pause(): Promise<void> {
    const task = running;
    const resumable = task?.resumable;
    if (!task || !resumable || stopOf(task) !== null) {
      return;
    }

    task.stop = 'pause';
    let state: PauseState | null = null;
    try {
      state = await resumable.pauseAsync();
    } catch (error) {
      // The native pause failed: if the loop has not stopped, the download simply goes on.
      if (!task.reachedStop && stopOf(task) === 'pause') {
        task.stop = null;
      }

      // A file that already finished is the expected race, not a fault.
      if (task.resumable === resumable) {
        reportFailure(error, 'pause');
      }
    }

    await task.done;
    if (task.handoff && stopOf(task) === 'pause') {
      await enqueue(() => finishPause(task, state));
    }
  }

  async function resume(): Promise<void> {
    await start(snapshot.selection);
  }

  async function removeDownloadLeftovers(root: string) {
    const folderName = installFolderName(manifest);
    await removeQuietly(`${modelsUri(root)}/.${folderName}.staging`);
    if (snapshot.state.kind === 'installing') {
      await removeQuietly(`${modelsUri(root)}/${folderName}`);
    }

    await removeQuietly(`${root}/.partial`);
    await writeSaved(null);
  }

  /** Asks the running download to stop for good and waits until it has. */
  async function stopForCancel(task: DownloadTask, operation: string): Promise<void> {
    task.stop = 'cancel';
    const resumable = task.resumable;
    if (resumable) {
      try {
        await resumable.pauseAsync();
      } catch (error) {
        // A file that already finished is the expected race, not a fault.
        if (task.resumable === resumable) {
          reportFailure(error, operation);
        }
      }
    }

    await task.done;
  }

  async function cancel(): Promise<void> {
    // Read behind any start already queued, so a cancel right after a start reaches that download.
    const task = await enqueue(async () => running);
    if (task) {
      if (isCancelled(task)) {
        return;
      }

      await stopForCancel(task, 'cancel');
    }

    await enqueue(async () => {
      if (running && running !== task) {
        // A newer download owns the files now; this cancel was for the one before it.
        return;
      }

      try {
        const root = baseUri();
        if (root) {
          await removeDownloadLeftovers(root);
        } else {
          await writeSaved(null);
        }

        running = null;
        await scanDisk();
      } catch (error) {
        reportFailure(error, 'cancel');
      }
    });
  }

  /**
   * Removes the installed model and anything half-downloaded. The runtime is unloaded first, unless
   * `unload` is false (the caller already did); `beforeFiles` runs after the unload and before this
   * store's files go, so one delete can take the other store's files out in between.
   */
  function removeStore(unload: boolean, beforeFiles?: () => Promise<void>): Promise<void> {
    return enqueue(async () => {
      const task = running;
      try {
        const root = baseUri();
        if (!root) {
          return;
        }

        if (task) {
          await stopForCancel(task, 'delete');
        }

        if (unload && unloader) {
          await unloader().catch(() => undefined);
        }

        await beforeFiles?.();
        await removeQuietly(modelsUri(root));
        await removeQuietly(`${root}/.partial`);
        await writeSaved(null);
        publish({ state: NOT_INSTALLED, updateAvailable: false, projectorInstalled: false });
      } catch (error) {
        reportFailure(error, 'delete');
      } finally {
        if (task && running === task) {
          running = null;
        }
      }
    });
  }

  return {
    manifest,
    getSnapshot: () => snapshot,
    subscribe,
    refresh,
    getInstalled,
    getSpaceCheck,
    start,
    pause,
    resume,
    cancel,
    remove: () => removeStore(true),
    removeWithoutUnload: () => removeStore(false),
    removeAlongside: (other) => removeStore(true, other.removeWithoutUnload),
    registerUnloader(fn) {
      unloader = fn;
    },
    resetForTests() {
      running = null;
      queue.reset();
      unloader = null;
      clearListeners();
      snapshot = {
        supported: onDeviceAiModule !== null,
        state: NOT_INSTALLED,
        selection: config.defaultSelection,
        updateAvailable: false,
        projectorInstalled: false,
      };
    },
  };
}

const mainStore = createLocalModelStore({
  manifest: DEFAULT_LOCAL_MODEL,
  subfolder: null,
  downloadStateKey: LOCAL_MODEL_DOWNLOAD_STATE,
  defaultSelection: DEFAULT_LOCAL_MODEL_SELECTION,
});

const textStore = createLocalModelStore({
  manifest: LOCAL_TEXT_MODEL,
  subfolder: 'text',
  downloadStateKey: LOCAL_TEXT_MODEL_DOWNLOAD_STATE,
  defaultSelection: { withProjector: false },
});

const stores = [mainStore, textStore];

/** The main on-device model (LFM2.5-VL 450M): reads photos and answers everything else. */
export const localModelStore: LocalModelStore = mainStore;

/** The optional text model, downloaded only from AI settings; its files live under `<root>/text`. */
export const localTextModelStore: LocalModelStore = textStore;

export function getLocalModelSnapshot(): LocalModelSnapshot {
  return mainStore.getSnapshot();
}

export const subscribeLocalModel = mainStore.subscribe;

/**
 * The runtime registers how to free a loaded model, so a delete never pulls files from under it.
 * It holds one loaded model of either kind, so both stores get it.
 */
export function registerLocalModelUnloader(fn: () => Promise<void>) {
  for (const store of stores) {
    store.registerUnloader(fn);
  }
}

/** The folder everything local-AI lives in, for the storage screen; null where unsupported. */
export function getLocalModelRoot(): string | null {
  return rootUri();
}

export const refreshLocalModel = mainStore.refresh;
export const getInstalledLocalModel = mainStore.getInstalled;
export const getLocalModelSpaceCheck = mainStore.getSpaceCheck;
export const startLocalModelDownload = mainStore.start;
export const pauseLocalModelDownload = mainStore.pause;
export const resumeLocalModelDownload = mainStore.resume;
export const cancelLocalModelDownload = mainStore.cancel;

/**
 * Removes every downloaded model and anything half-downloaded, the optional text model first (without
 * the main model on-device AI does not run, so it would be dead weight). The runtime is unloaded first.
 */
export function deleteLocalModel(): Promise<void> {
  return mainStore.removeAlongside(textStore);
}

/** Test seam: forget module state between tests. */
export function resetLocalModelStoreForTests() {
  for (const store of stores) {
    store.resetForTests();
  }
}
