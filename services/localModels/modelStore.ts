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
  installFolderName,
  installHasProjector,
  isCurrentInstall,
  isUpdateAvailable,
  type InstalledRecord,
  type LocalModelFailure,
  type LocalModelInstallState,
  type LocalModelSelection,
  modelFileUrl,
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
  selection: LocalModelSelection
): Promise<'done' | 'stopped'> {
  const dir = partialUri(root);
  await ensureDirectory(dir);
  const total = totalDownloadBytes(manifest, selection);
  let completed = 0;
  let lastPublish = 0;

  for (const file of filesFor(manifest, selection)) {
    const destination = `${dir}/${file.path}`;
    const existing = await FileSystem.getInfoAsync(destination);
    if (existing.exists && !existing.isDirectory && existing.size === file.bytes) {
      completed += file.bytes;
      publish({ state: { kind: 'downloading', receivedBytes: completed, totalBytes: total } });
      continue;
    }

    const saved = await readSaved();
    const resumeData = saved && saved.path === file.path ? saved.resumeData : undefined;
    if (!resumeData && existing.exists) {
      // A partial file nothing can resume: fetch it again from the start.
      await removeQuietly(destination);
    }

    const baseBytes = completed;
    const resumable = FileSystem.createDownloadResumable(
      modelFileUrl(manifest, file),
      destination,
      {},
      (progress) => {
        const now = Date.now();
        if (now - lastPublish >= PROGRESS_PUBLISH_MS) {
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
    if (active) {
      active.resumable = resumable;
    }

    const result = await resumable.downloadAsync();
    if (active?.cancelled || active?.paused) {
      return 'stopped';
    }

    if (!result || result.status < 200 || result.status >= 300) {
      throw new DownloadHttpError(result?.status ?? 0);
    }

    await writeSaved(null);
    completed += file.bytes;
    publish({ state: { kind: 'downloading', receivedBytes: completed, totalBytes: total } });
  }

  return 'done';
}

async function verifyAndInstall(root: string, selection: LocalModelSelection): Promise<void> {
  const native = onDeviceAiModule;
  if (!native) {
    throw new Error('On-device AI module is not available');
  }

  publish({ state: { kind: 'verifying' } });
  const dir = partialUri(root);
  for (const file of filesFor(manifest, selection)) {
    const digest = await native.sha256File(`${dir}/${file.path}`);
    if (digest.toLowerCase() !== file.sha256) {
      await removeQuietly(`${root}/.partial`);
      await writeSaved(null);
      throw new ChecksumError(file.path);
    }
  }

  publish({ state: { kind: 'installing' } });
  const modelsDir = modelsUri(root);
  const target = `${modelsDir}/${installFolderName(manifest)}`;
  await removeQuietly(target);
  await ensureDirectory(target);
  for (const file of filesFor(manifest, selection)) {
    await FileSystem.moveAsync({ from: `${dir}/${file.path}`, to: `${target}/${file.path}` });
  }

  // Last: its presence is what says every file above is in place.
  await FileSystem.writeAsStringAsync(
    `${target}/${INSTALLED_FILE}`,
    JSON.stringify(buildInstalledRecord(manifest, selection, Date.now()))
  );
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

/** Starts (or restarts) the download of `selection`. Resolves when it ends in any state. */
export async function startLocalModelDownload(
  selection: LocalModelSelection = snapshot.selection
): Promise<void> {
  const root = rootUri();
  if (!root || !onDeviceAiModule) {
    publish({ supported: false });

    return;
  }

  if (active) {
    return;
  }

  const space = checkSpace(await getFreeDiskBytes(), manifest, selection);
  if (!space.enough) {
    publish({ selection });
    fail('noSpace');

    return;
  }

  active = { resumable: null, paused: false, cancelled: false };
  publish({
    selection,
    state: {
      kind: 'downloading',
      receivedBytes: 0,
      totalBytes: totalDownloadBytes(manifest, selection),
    },
  });

  try {
    const outcome = await downloadFiles(root, selection);
    if (outcome === 'done') {
      await verifyAndInstall(root, selection);
      active = null;
      await refreshLocalModel();

      return;
    }
  } catch (error) {
    const wasStopped = active?.cancelled || active?.paused;
    if (!wasStopped) {
      active = null;
      if (error instanceof ChecksumError) {
        fail('checksum');
      } else {
        const status = error instanceof DownloadHttpError ? error.status : null;
        const message = error instanceof Error ? error.message : String(error);
        const reason = classifyDownloadFailure(status, message);
        fail(reason);
        if (reason === 'network' && !/network|timed out|offline|connection/i.test(message)) {
          // Anything we cannot name is worth a report; plain connectivity is not.
          void handleError(error, 'localModels.download', { showSnackbar: false });
        }
      }

      return;
    }
  }

  // Stopped by pause or cancel; those functions publish their own state.
  active = null;
}

export async function pauseLocalModelDownload(): Promise<void> {
  if (!active?.resumable || active.paused) {
    return;
  }

  active.paused = true;
  try {
    const state = await active.resumable.pauseAsync();
    const received = snapshot.state.kind === 'downloading' ? snapshot.state.receivedBytes : 0;
    const path = state.fileUri.split('/').pop() ?? '';
    if (state.resumeData) {
      await writeSaved({
        revision: manifest.revision,
        path,
        selection: snapshot.selection,
        resumeData: state.resumeData,
      });
    }

    publish({
      state: {
        kind: 'paused',
        receivedBytes: received,
        totalBytes: totalDownloadBytes(manifest, snapshot.selection),
      },
    });
  } catch {
    // The task already ended: the runner publishes the real outcome.
  }
}

export async function resumeLocalModelDownload(): Promise<void> {
  active = null;
  await startLocalModelDownload(snapshot.selection);
}

export async function cancelLocalModelDownload(): Promise<void> {
  const root = rootUri();
  if (active) {
    active.cancelled = true;
    try {
      await active.resumable?.pauseAsync();
    } catch {
      // Already finished or never started.
    }

    active = null;
  }

  if (root) {
    await removeQuietly(`${root}/.partial`);
  }

  await writeSaved(null);
  publish({ state: NOT_INSTALLED });
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
