/**
 * What a store's folders hold, read once and tidied: leftovers nothing can use are removed, and
 * what is left is an install, an older install, a paused or interrupted download, or nothing.
 */
import type { LocalModelManifest } from '@/constants/localModels';
import {
  installFolderName,
  installHasProjector,
  type LocalModelInstallState,
  type LocalModelSelection,
  NOT_INSTALLED,
  totalDownloadBytes,
} from '@/utils/localModels/install';

import { partialBytes, type SavedDownloadRecord } from './modelDownload';
import { listFolders, modelsUri, removeQuietly, scanModels } from './modelFolders';
import { pruneStaleInstalls, type UnloadRuntime } from './modelInstall';

export type DiskState = {
  state: LocalModelInstallState;
  updateAvailable: boolean;
  /** The installed model includes the photo projector. */
  projectorInstalled: boolean;
  /** Set when a partial download is on disk: what it was fetching. */
  selection?: LocalModelSelection;
};

export async function inspectDisk(options: {
  root: string;
  manifest: LocalModelManifest;
  /** What a partial download is taken to be fetching when no paused record says. */
  selection: LocalModelSelection;
  saved: SavedDownloadRecord;
  unload: UnloadRuntime;
}): Promise<DiskState> {
  const { root, manifest, saved: record, unload } = options;
  const modelsDir = modelsUri(root);
  const { folders, current, older, olderFolder, incomplete, validOlderFolders } = await scanModels(
    modelsDir,
    manifest
  );

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
    await pruneStaleInstalls(modelsDir, remaining, manifest, unload);
    const withProjector = installHasProjector(current);

    return {
      state: { kind: 'ready', revision: current.revision, withProjector },
      updateAvailable: false,
      projectorInstalled: withProjector,
    };
  }

  for (const name of validOlderFolders) {
    if (name !== olderFolder) {
      await removeQuietly(`${modelsDir}/${name}`);
    }
  }

  const saved = await record.read();
  const selection = saved?.selection ?? options.selection;
  const received = await partialBytes(root, manifest, selection);
  const olderProjector = installHasProjector(older);
  if (received > 0) {
    return {
      selection,
      // A partial file with no resume data: the app was closed mid-download.
      state: saved
        ? {
            kind: 'paused',
            receivedBytes: received,
            totalBytes: totalDownloadBytes(manifest, selection),
          }
        : { kind: 'failed', reason: 'interrupted' },
      updateAvailable: older !== null,
      projectorInstalled: olderProjector,
    };
  }

  if (older) {
    return {
      state: { kind: 'ready', revision: older.revision, withProjector: olderProjector },
      updateAvailable: true,
      projectorInstalled: olderProjector,
    };
  }

  return { state: NOT_INSTALLED, updateAvailable: false, projectorInstalled: false };
}
