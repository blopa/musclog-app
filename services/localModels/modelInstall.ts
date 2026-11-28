/**
 * Turning downloaded files into an install: hash them against the manifest, move them into
 * `models/<id>@<revision>/` through a staging folder, write `installed.json` last, then drop the
 * revisions this one replaces. It publishes nothing: the store hears about each phase through
 * `onPhase`.
 */
import * as FileSystem from 'expo-file-system/legacy';

import type { LocalModelManifest } from '@/constants/localModels';
import { onDeviceAiModule } from '@/modules/on-device-ai';
import {
  buildInstalledRecord,
  filesFor,
  installFolderName,
  type LocalModelSelection,
  staleInstallFolders,
} from '@/utils/localModels/install';

import { type DownloadTask, isCancelled, type SavedDownloadRecord } from './modelDownload';
import {
  ensureDirectory,
  excludeFromBackup,
  INSTALLED_FILE,
  listFolders,
  modelsUri,
  partialUri,
  removeQuietly,
} from './modelFolders';

export class ChecksumError extends Error {
  constructor(readonly path: string) {
    super(`Checksum mismatch for ${path}`);
  }
}

/** Frees the loaded model, so no file is pulled from under it. */
export type UnloadRuntime = () => Promise<void>;

/**
 * Removes the installs the current revision replaces. The runtime is unloaded first when there is
 * anything to remove, because it may hold one of them open.
 */
export async function pruneStaleInstalls(
  modelsDir: string,
  folders: readonly string[],
  manifest: LocalModelManifest,
  unload: UnloadRuntime
): Promise<void> {
  const stale = staleInstallFolders([...folders], manifest, true);
  if (stale.length === 0) {
    return;
  }

  await unload();
  for (const name of stale) {
    await removeQuietly(`${modelsDir}/${name}`);
  }
}

export async function verifyAndInstall(options: {
  root: string;
  manifest: LocalModelManifest;
  selection: LocalModelSelection;
  task: DownloadTask;
  saved: SavedDownloadRecord;
  unload: UnloadRuntime;
  onPhase: (phase: 'verifying' | 'installing') => void;
}): Promise<void> {
  const { root, manifest, selection, task, saved, unload, onPhase } = options;
  const checkCancelled = () => {
    if (isCancelled(task)) {
      throw new Error('Download stopped');
    }
  };

  const native = onDeviceAiModule;
  if (!native) {
    throw new Error('On-device AI module is not available');
  }

  onPhase('verifying');
  const dir = partialUri(root, manifest);
  for (const file of filesFor(manifest, selection)) {
    const digest = await native.sha256File(`${dir}/${file.path}`);
    checkCancelled();
    if (digest.toLowerCase() !== file.sha256) {
      await removeQuietly(`${root}/.partial`);
      await saved.write(null);
      throw new ChecksumError(file.path);
    }
  }

  checkCancelled();
  onPhase('installing');
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
  await saved.write(null);
  await pruneStaleInstalls(modelsDir, await listFolders(modelsDir), manifest, unload);
}
