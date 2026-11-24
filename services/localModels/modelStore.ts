/**
 * The downloaded on-device model: where it lives, what state its download is in, and how it gets
 * installed. Module-level (like `premiumStore`), so a download keeps going while the screen that
 * started it is closed, and any number of screens can watch it through `subscribeLocalModel`.
 *
 * The install is all-or-nothing: files are fetched into `.partial/`, hashed with SHA-256 and only
 * then moved into `models/<id>@<revision>/`, with `installed.json` written LAST. The runtime reads
 * only folders whose `installed.json` matches the manifest (`getInstalledLocalModel`), so a
 * half-finished install can never be loaded.
 *
 * Resuming: a pause inside a session resumes the same file. A download killed with the app restarts
 * the file it was on (the native resume data only exists after a clean pause), and says
 * `interrupted` until the person taps retry.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { DEFAULT_LOCAL_MODEL, type LocalModelManifest } from '@/constants/localModels';
import { LOCAL_MODEL_DOWNLOAD_STATE } from '@/constants/misc';
import { onDeviceAiModule } from '@/modules/on-device-ai';
import { handleError } from '@/utils/handleError';
import {
  buildInstalledRecord,
  checkSpace,
  classifyDownloadFailure,
  DEFAULT_LOCAL_MODEL_SELECTION,
  filesFor,
  type InstalledRecord,
  installFolderName,
  installHasProjector,
  isCurrentInstall,
  isUpdateAvailable,
  type LocalModelFailure,
  type LocalModelInstallState,
  type LocalModelSelection,
  modelFileUrl,
  NETWORK_MESSAGE,
  NOT_INSTALLED,
  parseInstalledRecord,
  staleInstallFolders,
  totalDownloadBytes,
} from '@/utils/localModels/install';

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

export type InstalledLocalModel = {
  manifest: LocalModelManifest;
  modelPath: string;
  /** Null for a text-only install. */
  projectorPath: string | null;
};

type SavedDownload = {
  revision: string;
  path: string;
  selection: LocalModelSelection;
  resumeData: string;
};

const INSTALLED_FILE = 'installed.json';
const PROGRESS_PUBLISH_MS = 250;

const manifest = DEFAULT_LOCAL_MODEL;

let snapshot: LocalModelSnapshot = {
  supported: onDeviceAiModule !== null,
  state: NOT_INSTALLED,
  selection: DEFAULT_LOCAL_MODEL_SELECTION,
  updateAvailable: false,
  projectorInstalled: false,
};

const listeners = new Set<() => void>();

type ActiveDownload = {
  resumable: FileSystem.DownloadResumable | null;
  paused: boolean;
  cancelled: boolean;
  done: Promise<void>;
  stopTask: Promise<void> | null;
};

let active: ActiveDownload | null = null;
let unloader: (() => Promise<void>) | null = null;

function publish(patch: Partial<LocalModelSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

export function getLocalModelSnapshot(): LocalModelSnapshot {
  return snapshot;
}

export function subscribeLocalModel(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** The runtime registers how to free a loaded model, so a delete never pulls files from under it. */
export function registerLocalModelUnloader(fn: () => Promise<void>) {
  unloader = fn;
}

function rootUri(): string | null {
  return onDeviceAiModule ? onDeviceAiModule.storageDirectory() : null;
}

function modelsUri(root: string) {
  return `${root}/models`;
}

function partialUri(root: string) {
  return `${root}/.partial/${installFolderName(manifest)}`;
}

/** The folder everything local-AI lives in, for the storage screen; null where unsupported. */
export function getLocalModelRoot(): string | null {
  return rootUri();
}

async function ensureDirectory(uri: string) {
  await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
}

async function removeQuietly(uri: string) {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Nothing useful to do: the next install attempt cleans the same path again.
  }
}

async function readRecord(folderUri: string): Promise<InstalledRecord | null> {
  try {
    return parseInstalledRecord(
      await FileSystem.readAsStringAsync(`${folderUri}/${INSTALLED_FILE}`)
    );
  } catch {
    return null;
  }
}

async function listFolders(modelsDir: string): Promise<string[]> {
  try {
    return await FileSystem.readDirectoryAsync(modelsDir);
  } catch {
    return [];
  }
}

async function readSaved(): Promise<SavedDownload | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_MODEL_DOWNLOAD_STATE);
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
  } catch {
    return null;
  }
}

async function writeSaved(value: SavedDownload | null) {
  try {
    if (value) {
      await AsyncStorage.setItem(LOCAL_MODEL_DOWNLOAD_STATE, JSON.stringify(value));
    } else {
      await AsyncStorage.removeItem(LOCAL_MODEL_DOWNLOAD_STATE);
    }
  } catch {
    // Losing resume data only costs a restart of the file.
  }
}

/** Bytes already on disk for a selection in `.partial/`. */
async function partialBytes(root: string, selection: LocalModelSelection): Promise<number> {
  let sum = 0;
  for (const file of filesFor(manifest, selection)) {
    try {
      const info = await FileSystem.getInfoAsync(`${partialUri(root)}/${file.path}`);
      if (info.exists && !info.isDirectory) {
        sum += Math.min(info.size, file.bytes);
      }
    } catch {
      // Unreadable counts as nothing.
    }
  }

  return sum;
}

/**
 * Re-reads the disk and publishes what is there: an install, an older install, a paused or
 * interrupted download, or nothing. Does nothing while a download is running here.
 */
export async function refreshLocalModel(): Promise<void> {
  const root = rootUri();
  if (!root) {
    publish({ supported: false, state: NOT_INSTALLED });

    return;
  }

  if (active) {
    return;
  }

  const modelsDir = modelsUri(root);
  const folders = await listFolders(modelsDir);
  let current: InstalledRecord | null = null;
  let older: InstalledRecord | null = null;
  for (const name of folders) {
    const record = await readRecord(`${modelsDir}/${name}`);
    if (record && isCurrentInstall(record, manifest)) {
      current = record;
    } else if (record && isUpdateAvailable(record, manifest)) {
      older = record;
    }
  }

  if (active) {
    return;
  }

  if (current) {
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

  const saved = await readSaved();
  const selection = saved?.selection ?? snapshot.selection;
  const received = await partialBytes(root, selection);
  if (active) {
    return;
  }

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
      projectorInstalled: false,
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
      projectorInstalled: false,
    });

    return;
  }

  publish({
    supported: true,
    state: NOT_INSTALLED,
    updateAvailable: older !== null,
    projectorInstalled: false,
  });
}

/** The files the runtime may open, or null when no complete install of the current revision exists. */
export async function getInstalledLocalModel(): Promise<InstalledLocalModel | null> {
  const root = rootUri();
  if (!root) {
    return null;
  }

  const folder = `${modelsUri(root)}/${installFolderName(manifest)}`;
  const record = await readRecord(folder);
  if (!isCurrentInstall(record, manifest)) {
    return null;
  }

  const model = record?.files.find((file) => file.role === 'model');
  const projector = record?.files.find((file) => file.role === 'projector');
  if (!model) {
    return null;
  }

  return {
    manifest,
    modelPath: `${folder}/${model.path}`,
    projectorPath: projector ? `${folder}/${projector.path}` : null,
  };
}

export async function getFreeDiskBytes(): Promise<number | null> {
  try {
    return await FileSystem.getFreeDiskStorageAsync();
  } catch {
    return null;
  }
}

/** Checks the space still needed after accounting for files a retry can reuse. */
export async function getLocalModelSpaceCheck(selection: LocalModelSelection) {
  const free = await getFreeDiskBytes();
  try {
    const root = rootUri();
    if (!root || free === null) {
      return checkSpace(free, manifest, selection);
    }

    const saved = await readSaved();
    let reusable = 0;
    for (const file of filesFor(manifest, selection)) {
      try {
        const info = await FileSystem.getInfoAsync(`${partialUri(root)}/${file.path}`);
        if (
          info.exists &&
          !info.isDirectory &&
          (info.size === file.bytes ||
            (saved?.path === file.path &&
              saved.selection.withProjector === selection.withProjector))
        ) {
          reusable += Math.min(info.size, file.bytes);
        }
      } catch {
        // An unreadable file cannot be counted as reusable.
      }
    }

    const result = checkSpace(free + reusable, manifest, selection);
    return result.enough
      ? result
      : { ...result, freeBytes: free, neededBytes: result.neededBytes - reusable };
  } catch {
    return checkSpace(free, manifest, selection);
  }
}

function fail(reason: LocalModelFailure) {
  publish({ state: { kind: 'failed', reason } });
}

class DownloadHttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

async function downloadFiles(
  root: string,
  selection: LocalModelSelection,
  owner: ActiveDownload
): Promise<'done' | 'stopped'> {
  const dir = partialUri(root);
  await ensureDirectory(dir);
  if (owner.paused || owner.cancelled) {
    return 'stopped';
  }

  const total = totalDownloadBytes(manifest, selection);
  let completed = 0;
  let lastPublish = 0;

  for (const file of filesFor(manifest, selection)) {
    const destination = `${dir}/${file.path}`;
    const existing = await FileSystem.getInfoAsync(destination);
    if (owner.paused || owner.cancelled) {
      return 'stopped';
    }

    if (existing.exists && !existing.isDirectory && existing.size === file.bytes) {
      completed += file.bytes;
      publish({ state: { kind: 'downloading', receivedBytes: completed, totalBytes: total } });
      continue;
    }

    const saved = await readSaved();
    if (owner.paused || owner.cancelled) {
      return 'stopped';
    }

    const resumeData =
      saved && saved.path === file.path && saved.selection.withProjector === selection.withProjector
        ? saved.resumeData
        : undefined;
    if (!resumeData && existing.exists) {
      // A partial file nothing can resume: fetch it again from the start.
      await removeQuietly(destination);
    }

    if (owner.paused || owner.cancelled) {
      return 'stopped';
    }

    const baseBytes = completed;
    const resumable = FileSystem.createDownloadResumable(
      modelFileUrl(manifest, file),
      destination,
      {},
      (progress) => {
        const now = Date.now();
        if (
          active === owner &&
          !owner.paused &&
          !owner.cancelled &&
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
    owner.resumable = resumable;

    const result = await resumable.downloadAsync();
    if (owner.cancelled || owner.paused) {
      return 'stopped';
    }

    if (!result || result.status < 200 || result.status >= 300) {
      throw new DownloadHttpError(result?.status ?? 0);
    }

    await writeSaved(null);
    if (owner.cancelled || owner.paused) {
      return 'stopped';
    }

    completed += file.bytes;
    publish({ state: { kind: 'downloading', receivedBytes: completed, totalBytes: total } });
  }

  return 'done';
}

async function verifyAndInstall(
  root: string,
  selection: LocalModelSelection,
  owner: ActiveDownload
): Promise<void> {
  const checkStopped = () => {
    if (owner.cancelled || owner.paused) {
      throw new Error('Download stopped');
    }
  };

  const native = onDeviceAiModule;
  if (!native) {
    throw new Error('On-device AI module is not available');
  }

  publish({ state: { kind: 'verifying' } });
  const dir = partialUri(root);
  for (const file of filesFor(manifest, selection)) {
    const digest = await native.sha256File(`${dir}/${file.path}`);
    checkStopped();
    if (digest.toLowerCase() !== file.sha256) {
      await removeQuietly(`${root}/.partial`);
      await writeSaved(null);
      throw new ChecksumError(file.path);
    }
  }

  checkStopped();
  publish({ state: { kind: 'installing' } });
  const modelsDir = modelsUri(root);
  const target = `${modelsDir}/${installFolderName(manifest)}`;
  await removeQuietly(target);
  checkStopped();
  await ensureDirectory(target);
  checkStopped();
  for (const file of filesFor(manifest, selection)) {
    await FileSystem.moveAsync({ from: `${dir}/${file.path}`, to: `${target}/${file.path}` });
    checkStopped();
  }

  // Last: its presence is what says every file above is in place.
  await FileSystem.writeAsStringAsync(
    `${target}/${INSTALLED_FILE}`,
    JSON.stringify(buildInstalledRecord(manifest, selection, Date.now()))
  );
  if (owner.cancelled || owner.paused) {
    await removeQuietly(target);
    checkStopped();
  }

  await native.setExcludedFromBackup(root).catch(() => false);
  await removeQuietly(`${root}/.partial`);
  await writeSaved(null);

  const stale = staleInstallFolders(await listFolders(modelsDir), manifest, true);
  for (const name of stale) {
    await removeQuietly(`${modelsDir}/${name}`);
  }
}

class ChecksumError extends Error {
  constructor(readonly path: string) {
    super(`Checksum mismatch for ${path}`);
  }
}

/**
 * Starts (or restarts) the download of `selection`. Resolves when it ends in any state and never
 * rejects: callers fire it with `void`, so a throw here would be an unhandled rejection.
 */
export async function startLocalModelDownload(
  selection: LocalModelSelection = snapshot.selection
): Promise<void> {
  if (active) {
    return;
  }

  let root: string | null;
  try {
    root = rootUri();
  } catch (error) {
    fail('storage');
    void handleError(error, 'localModels.download', { showSnackbar: false });
    return;
  }

  if (!root || !onDeviceAiModule) {
    publish({ supported: false });
    return;
  }

  const owner: ActiveDownload = {
    resumable: null,
    paused: false,
    cancelled: false,
    done: Promise.resolve(),
    stopTask: null,
  };
  active = owner;
  owner.done = runLocalModelDownload(root, selection, owner);
  await owner.done;
}

async function runLocalModelDownload(
  root: string,
  selection: LocalModelSelection,
  owner: ActiveDownload
): Promise<void> {
  try {
    const space = await getLocalModelSpaceCheck(selection);
    if (owner.cancelled || owner.paused) {
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
    const outcome = await downloadFiles(root, selection, owner);
    if (outcome === 'done' && !owner.cancelled && !owner.paused) {
      owner.resumable = null;
      await verifyAndInstall(root, selection, owner);
      if (owner.cancelled || owner.paused) {
        return;
      }

      active = null;
      await refreshLocalModel();
    }
  } catch (error) {
    if (!owner.cancelled && !owner.paused && active === owner) {
      if (error instanceof ChecksumError) {
        fail('checksum');
      } else {
        const status = error instanceof DownloadHttpError ? error.status : null;
        const message = error instanceof Error ? error.message : String(error);
        const reason = classifyDownloadFailure(status, message);
        fail(reason);
        if (reason !== 'noSpace' && !NETWORK_MESSAGE.test(message)) {
          void handleError(error, 'localModels.download', { showSnackbar: false });
        }
      }
    }
  } finally {
    if (active === owner && !owner.cancelled && !owner.paused) {
      active = null;
    }
  }
}

export async function pauseLocalModelDownload(): Promise<void> {
  const owner = active;
  if (!owner?.resumable || owner.paused || owner.cancelled) {
    return;
  }

  owner.paused = true;
  const resumable = owner.resumable;
  owner.stopTask = (async () => {
    try {
      const state = await resumable.pauseAsync();
      await owner.done;
      if (owner.cancelled || active !== owner) {
        return;
      }

      const received = snapshot.state.kind === 'downloading' ? snapshot.state.receivedBytes : 0;
      if (state.resumeData) {
        await writeSaved({
          revision: manifest.revision,
          path: state.fileUri.split('/').pop() ?? '',
          selection: snapshot.selection,
          resumeData: state.resumeData,
        });
      }

      if (owner.cancelled || active !== owner) {
        return;
      }

      publish({
        state: {
          kind: 'paused',
          receivedBytes: received,
          totalBytes: totalDownloadBytes(manifest, snapshot.selection),
        },
      });
    } catch {
      owner.paused = false;
      await owner.done;
      if (active === owner && !owner.cancelled) {
        active = null;
        if (snapshot.state.kind === 'downloading') {
          await refreshLocalModel();
        }
      }
    } finally {
      if (active === owner && !owner.cancelled && owner.paused) {
        active = null;
      }
    }
  })();
  await owner.stopTask;
}

export async function resumeLocalModelDownload(): Promise<void> {
  if (active) {
    return;
  }

  await startLocalModelDownload(snapshot.selection);
}

export async function cancelLocalModelDownload(): Promise<void> {
  const root = rootUri();
  let owner = active;
  if (!owner) {
    owner = {
      resumable: null,
      paused: false,
      cancelled: true,
      done: Promise.resolve(),
      stopTask: null,
    };
    active = owner;
  } else {
    if (owner.cancelled) {
      return;
    }

    owner.cancelled = true;
    if (owner.stopTask) {
      await owner.stopTask;
    } else {
      try {
        await owner.resumable?.pauseAsync();
      } catch {
        /* Already finished. */
      }

      await owner.done;
    }
  }

  if (root) {
    if (snapshot.state.kind === 'installing') {
      await removeQuietly(`${modelsUri(root)}/${installFolderName(manifest)}`);
    }

    await removeQuietly(`${root}/.partial`);
  }

  await writeSaved(null);
  if (active === owner) {
    publish({ state: NOT_INSTALLED });
    active = null;
  }
}

/** Removes the installed model and anything half-downloaded. The runtime is unloaded first. */
export async function deleteLocalModel(): Promise<void> {
  const root = rootUri();
  if (!root) {
    return;
  }

  if (active) {
    await cancelLocalModelDownload();
  }

  if (unloader) {
    await unloader().catch(() => undefined);
  }

  await removeQuietly(modelsUri(root));
  await removeQuietly(`${root}/.partial`);
  await writeSaved(null);
  publish({ state: NOT_INSTALLED, updateAvailable: false, projectorInstalled: false });
}

/** Test seam: forget module state between tests. */
export function resetLocalModelStoreForTests() {
  active = null;
  unloader = null;
  listeners.clear();
  snapshot = {
    supported: onDeviceAiModule !== null,
    state: NOT_INSTALLED,
    selection: DEFAULT_LOCAL_MODEL_SELECTION,
    updateAvailable: false,
    projectorInstalled: false,
  };
}
