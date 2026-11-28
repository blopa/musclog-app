/**
 * The on-disk layout of a downloaded on-device model: where its folders are and what a scan of
 * them finds. Pure file-system helpers, no download state (that lives in `modelStore.ts`, which
 * imports this file and never the other way round).
 */
import * as FileSystem from 'expo-file-system/legacy';

import type { LocalModelManifest } from '@/constants/localModels';
import { onDeviceAiModule } from '@/modules/on-device-ai';
import { handleError } from '@/utils/handleError';
import {
  type InstalledRecord,
  installFolderName,
  isCurrentInstall,
  isUpdateAvailable,
  parseInstalledRecord,
} from '@/utils/localModels/install';

export type InstalledLocalModel = {
  manifest: LocalModelManifest;
  modelPath: string;
  /** Null for a text-only install. */
  projectorPath: string | null;
};

export const INSTALLED_FILE = 'installed.json';

export function rootUri(): string | null {
  return onDeviceAiModule ? onDeviceAiModule.storageDirectory() : null;
}

export function modelsUri(root: string) {
  return `${root}/models`;
}

export function partialUri(root: string, manifest: LocalModelManifest) {
  return `${root}/.partial/${installFolderName(manifest)}`;
}

/** A failure of the on-device model's files or downloads, reported without a snackbar. */
export function reportModelFailure(error: unknown, operation: string) {
  void handleError(error, `localModels.${operation}`, { showSnackbar: false });
}

export async function excludeFromBackup(root: string): Promise<void> {
  await onDeviceAiModule?.setExcludedFromBackup(root).catch(() => false);
}

export async function ensureDirectory(uri: string) {
  await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
}

export async function removeQuietly(uri: string) {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Nothing useful to do: the next install attempt cleans the same path again.
  }
}

export async function readRecord(folderUri: string): Promise<InstalledRecord | null> {
  try {
    return parseInstalledRecord(
      await FileSystem.readAsStringAsync(`${folderUri}/${INSTALLED_FILE}`)
    );
  } catch {
    return null;
  }
}

export async function listFolders(modelsDir: string): Promise<string[]> {
  try {
    return await FileSystem.readDirectoryAsync(modelsDir);
  } catch {
    return [];
  }
}

export function modelPathsFromRecord(
  folderUri: string,
  record: InstalledRecord | null,
  manifest: LocalModelManifest
): InstalledLocalModel | null {
  if (!record) {
    return null;
  }

  const model = record.files.find((file) => file.role === 'model');
  const projector = record.files.find((file) => file.role === 'projector');
  if (!model) {
    return null;
  }

  return {
    manifest,
    modelPath: `${folderUri}/${model.path}`,
    projectorPath: projector ? `${folderUri}/${projector.path}` : null,
  };
}

export type ModelsScan = {
  /** Every entry of the models folder, as listed. */
  folders: string[];
  current: InstalledRecord | null;
  /** The newest usable older revision, with its folder name. */
  older: InstalledRecord | null;
  olderFolder: string | null;
  /** Entries that are not a complete install of any revision. */
  incomplete: string[];
  /** Every older revision's folder, including the newest (`olderFolder`). */
  validOlderFolders: string[];
};

/** Reads every folder's `installed.json` once and sorts them into current, older and incomplete. */
export async function scanModels(
  modelsDir: string,
  manifest: LocalModelManifest
): Promise<ModelsScan> {
  const folders = await listFolders(modelsDir);
  let current: InstalledRecord | null = null;
  let older: InstalledRecord | null = null;
  let olderFolder: string | null = null;
  const incomplete: string[] = [];
  const validOlderFolders: string[] = [];

  for (const name of folders) {
    const record = await readRecord(`${modelsDir}/${name}`);
    const wellNamed = record !== null && name === installFolderName(record);
    if (record && wellNamed && isCurrentInstall(record, manifest)) {
      current = record;
    } else if (record && wellNamed && isUpdateAvailable(record, manifest)) {
      validOlderFolders.push(name);
      if (!older || record.installedAt > older.installedAt) {
        older = record;
        olderFolder = name;
      }
    } else {
      incomplete.push(name);
    }
  }

  return { folders, current, older, olderFolder, incomplete, validOlderFolders };
}
