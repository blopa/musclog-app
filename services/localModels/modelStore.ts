/**
 * The downloaded on-device models: where they live, what state each download is in, and how it gets
 * installed. There are two stores built by one factory (`createLocalModelStore`): `localModelStore`
 * for the main model (`DEFAULT_LOCAL_MODEL`, under `<root>/models` and `<root>/.partial`) and
 * `localTextModelStore` for the optional text model (`LOCAL_TEXT_MODEL`, under `<root>/text`). Each has
 * its own snapshot, listeners, queue, running download and saved-download key, and neither ever scans
 * or deletes the other's files. Module-level (like `premiumStore`), so a download keeps going while
 * the screen that started it is closed, and any number of screens can watch it through `subscribe`.
 * This file owns the state and the order of operations; the file work lives beside it:
 * `modelDownload.ts` (fetch and resume), `modelInstall.ts` (verify and install) and
 * `modelDiskScan.ts` (read what is there).
 *
 * The install is all-or-nothing: files are fetched into `.partial/`, hashed with SHA-256 and only
 * then moved into `models/<id>@<revision>/`, with `installed.json` written LAST. The runtime reads
 * only folders whose `installed.json` matches the manifest (`getInstalled`), so a
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
import * as FileSystem from 'expo-file-system/legacy';

import {
  DEFAULT_LOCAL_MODEL,
  LOCAL_TEXT_MODEL,
  type LocalModelManifest,
} from '@/constants/localModels';
import { LOCAL_MODEL_DOWNLOAD_STATE, LOCAL_TEXT_MODEL_DOWNLOAD_STATE } from '@/constants/misc';
import { onDeviceAiModule } from '@/modules/on-device-ai';
import { inspectDisk } from '@/services/localModels/modelDiskScan';
import {
  checkDownloadSpace,
  createDownloadTask,
  downloadFiles,
  DownloadHttpError,
  type DownloadTask,
  isCancelled,
  partialBytes,
  savedDownloadRecord,
  stopOf,
} from '@/services/localModels/modelDownload';
import {
  type InstalledLocalModel,
  modelPathsFromRecord,
  modelsUri,
  removeQuietly,
  reportModelFailure,
  rootUri,
  scanModels,
} from '@/services/localModels/modelFolders';
import { ChecksumError, verifyAndInstall } from '@/services/localModels/modelInstall';
import { reportAiEvent } from '@/utils/aiTelemetry';
import { createListeners } from '@/utils/createListeners';
import {
  checkSpace,
  classifyDownloadFailure,
  DEFAULT_LOCAL_MODEL_SELECTION,
  installFolderName,
  type LocalModelFailure,
  type LocalModelInstallState,
  type LocalModelSelection,
  NETWORK_MESSAGE,
  NOT_INSTALLED,
  type SpaceCheck,
  totalDownloadBytes,
} from '@/utils/localModels/install';
import { createSerialQueue } from '@/utils/serialQueue';

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

export async function getFreeDiskBytes(): Promise<number | null> {
  try {
    return await FileSystem.getFreeDiskStorageAsync();
  } catch (error) {
    reportModelFailure(error, 'freeSpace');
    return null;
  }
}

/** Set by the runtime (`registerLocalModelUnloader`); null until it has loaded. */
let unloadRuntime: (() => Promise<void>) | null = null;

/** Frees the loaded model. A failure is reported and never stops the file work behind it. */
async function unloadRuntimeQuietly(): Promise<void> {
  try {
    await unloadRuntime?.();
  } catch (error) {
    reportModelFailure(error, 'unload');
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
  /** `remove`, with `beforeFiles` in place of the unload that runs before the files go. */
  removeAfter(beforeFiles: () => Promise<void>): Promise<void>;
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
  const saved = savedDownloadRecord(config.downloadStateKey, manifest);

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

  /** Reads the disk and publishes what is there. Runs only as a queue operation or inside a task. */
  async function scanDisk(): Promise<void> {
    const root = baseUri();
    if (!root) {
      publish({ supported: false, state: NOT_INSTALLED });

      return;
    }

    const found = await inspectDisk({
      root,
      manifest,
      selection: snapshot.selection,
      saved,
      unload: unloadRuntimeQuietly,
    });
    publish({ supported: true, ...found });
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
        reportModelFailure(error, 'refresh');
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
    const freeBytes = await getFreeDiskBytes();
    try {
      return await checkDownloadSpace({
        freeBytes,
        root: baseUri(),
        manifest,
        selection,
        saved,
      });
    } catch (error) {
      reportModelFailure(error, 'spaceCheck');
      return checkSpace(freeBytes, manifest, selection);
    }
  }

  function fail(reason: LocalModelFailure) {
    publish({ state: { kind: 'failed', reason } });
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
      reportModelFailure(error, 'download');
      return null;
    }

    if (!root || !onDeviceAiModule) {
      publish({ supported: false });
      return null;
    }

    const task = createDownloadTask();
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
      const outcome = await downloadFiles({
        root,
        manifest,
        selection,
        task,
        saved,
        isCurrent: () => running === task,
        onProgress: (receivedBytes, totalBytes) =>
          publish({ state: { kind: 'downloading', receivedBytes, totalBytes } }),
      });
      if (outcome === 'done' && !isCancelled(task)) {
        // A pause that arrives as the last file lands has nothing left to pause: the install goes on.
        if (stopOf(task) === 'pause') {
          task.stop = null;
        }

        task.resumable = null;
        await verifyAndInstall({
          root,
          manifest,
          selection,
          task,
          saved,
          unload: unloadRuntimeQuietly,
          onPhase: (kind) => publish({ state: { kind } }),
        });
        if (isCancelled(task)) {
          return;
        }

        try {
          await scanDisk();
        } catch (error) {
          reportModelFailure(error, 'refresh');
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
            reportModelFailure(error, 'download');
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
    const diskBytes = root ? await partialBytes(root, manifest, snapshot.selection) : 0;
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
        await saved.write({
          revision: manifest.revision,
          path: filePath,
          selection: snapshot.selection,
          resumeData: state.resumeData,
        });
      }

      await publishPaused(task);
    } catch (error) {
      reportModelFailure(error, 'pause');
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
        reportModelFailure(error, 'pause');
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
    await saved.write(null);
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
          reportModelFailure(error, operation);
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
          await saved.write(null);
        }

        running = null;
        await scanDisk();
      } catch (error) {
        reportModelFailure(error, 'cancel');
      }
    });
  }

  /**
   * Removes the installed model and anything half-downloaded. `beforeFiles` runs once this store's
   * download has stopped and before any of its files go (unloading the runtime).
   */
  function removeAfter(beforeFiles: () => Promise<void>): Promise<void> {
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

        await beforeFiles();
        await removeQuietly(modelsUri(root));
        await removeQuietly(`${root}/.partial`);
        await saved.write(null);
        publish({ state: NOT_INSTALLED, updateAvailable: false, projectorInstalled: false });
      } catch (error) {
        reportModelFailure(error, 'delete');
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
    remove: () => removeAfter(unloadRuntimeQuietly),
    removeAfter,
    resetForTests() {
      running = null;
      queue.reset();
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

/**
 * The runtime registers how to free a loaded model, so a delete never pulls files from under it.
 * It holds one loaded model of either kind, so there is one of these for both stores.
 */
export function registerLocalModelUnloader(fn: () => Promise<void>) {
  unloadRuntime = fn;
}

/** The folder everything local-AI lives in, for the storage screen; null where unsupported. */
export function getLocalModelRoot(): string | null {
  return rootUri();
}

/**
 * Removes every downloaded model and anything half-downloaded, the optional text model's files first
 * (without the main model on-device AI does not run, so it would be dead weight). The runtime is
 * unloaded once, before either store's files go. Both removals are queued at once, so nothing can
 * start on either store while the other's files are going.
 */
export function deleteLocalModel(): Promise<void> {
  let unloading: Promise<void> | undefined;
  const unloadOnce = () => (unloading ??= unloadRuntimeQuietly());
  const textRemoved = textStore.removeAfter(unloadOnce);

  return mainStore.removeAfter(async () => {
    await unloadOnce();
    await textRemoved;
  });
}

/** Test seam: forget module state between tests. */
export function resetLocalModelStoreForTests() {
  unloadRuntime = null;
  for (const store of stores) {
    store.resetForTests();
  }
}
