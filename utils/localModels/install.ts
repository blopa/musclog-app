/**
 * Pure rules of installing a downloaded model: what is fetched from where, whether there is room,
 * what counts as a complete install, and the states a download moves through. The service
 * (`services/localModels/modelStore.ts`) does the I/O; everything decidable lives here so it is
 * tested without a phone.
 */
import type { LocalModelFile, LocalModelManifest } from '@/constants/localModels';
import { LOCAL_MODEL_FREE_SPACE_MARGIN_BYTES } from '@/constants/localModels';

export type LocalModelFailure =
  'noSpace' | 'network' | 'checksum' | 'interrupted' | 'http' | 'storage';

export type LocalModelInstallState =
  | { kind: 'notInstalled' }
  | { kind: 'downloading'; receivedBytes: number; totalBytes: number }
  | { kind: 'paused'; receivedBytes: number; totalBytes: number }
  | { kind: 'verifying' }
  | { kind: 'installing' }
  | { kind: 'ready'; revision: string; withProjector: boolean }
  | { kind: 'failed'; reason: LocalModelFailure };

export const NOT_INSTALLED: LocalModelInstallState = { kind: 'notInstalled' };

/** What the person chose to download: the model alone, or with the photo projector. */
export type LocalModelSelection = { withProjector: boolean };

export const DEFAULT_LOCAL_MODEL_SELECTION: LocalModelSelection = { withProjector: true };

/** The files a selection downloads, in the order they are fetched (model first). */
export function filesFor(
  manifest: LocalModelManifest,
  selection: LocalModelSelection
): LocalModelFile[] {
  return manifest.files.filter((file) => !file.optional || selection.withProjector);
}

export function totalDownloadBytes(
  manifest: LocalModelManifest,
  selection: LocalModelSelection
): number {
  return filesFor(manifest, selection).reduce((sum, file) => sum + file.bytes, 0);
}

/** `https://huggingface.co/<repo>/resolve/<revision>/<path>`: always the pinned commit. */
export function modelFileUrl(manifest: LocalModelManifest, file: LocalModelFile): string {
  return `https://huggingface.co/${manifest.repo}/resolve/${manifest.revision}/${encodeURI(file.path)}`;
}

export function requiredFreeBytes(
  manifest: LocalModelManifest,
  selection: LocalModelSelection
): number {
  return totalDownloadBytes(manifest, selection) + LOCAL_MODEL_FREE_SPACE_MARGIN_BYTES;
}

export type SpaceCheck =
  { enough: true } | { enough: false; neededBytes: number; freeBytes: number };

/** An unreadable free-space figure does not block: the download itself fails with `noSpace`. */
export function checkSpace(
  freeBytes: number | null | undefined,
  manifest: LocalModelManifest,
  selection: LocalModelSelection
): SpaceCheck {
  if (typeof freeBytes !== 'number' || !Number.isFinite(freeBytes)) {
    return { enough: true };
  }

  const neededBytes = requiredFreeBytes(manifest, selection);

  return freeBytes >= neededBytes ? { enough: true } : { enough: false, neededBytes, freeBytes };
}

/** `0..1` of the whole selection; 0 until the total is known. */
export function downloadFraction(receivedBytes: number, totalBytes: number): number {
  if (!(totalBytes > 0) || !(receivedBytes > 0)) {
    return 0;
  }

  return Math.min(1, receivedBytes / totalBytes);
}

/** What `installed.json` holds; written LAST, so its presence means every file is in place. */
export type InstalledRecord = {
  id: string;
  revision: string;
  files: { role: LocalModelFile['role']; path: string; bytes: number; sha256: string }[];
  installedAt: number;
};

export function buildInstalledRecord(
  manifest: LocalModelManifest,
  selection: LocalModelSelection,
  installedAt: number
): InstalledRecord {
  return {
    id: manifest.id,
    revision: manifest.revision,
    files: filesFor(manifest, selection).map(({ role, path, bytes, sha256 }) => ({
      role,
      path,
      bytes,
      sha256,
    })),
    installedAt,
  };
}

/**
 * A file path from `installed.json` is joined onto the model folder (services/localModels/
 * modelFolders.ts), so anything that could leave that folder or name another location is refused:
 * an absolute path, a backslash, a URL scheme, or a `..` segment.
 */
export function isSafeInstallPath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('://')) {
    return false;
  }

  return !path.split('/').includes('..');
}

/** Tolerant parse: anything that is not a record of ours reads as "not installed". */
export function parseInstalledRecord(text: string | null | undefined): InstalledRecord | null {
  if (!text) {
    return null;
  }

  try {
    const value = JSON.parse(text) as Partial<InstalledRecord> | null;
    if (
      !value ||
      typeof value.id !== 'string' ||
      typeof value.revision !== 'string' ||
      typeof value.installedAt !== 'number' ||
      !Array.isArray(value.files)
    ) {
      return null;
    }

    const files = value.files.filter(
      (file): file is InstalledRecord['files'][number] =>
        !!file &&
        (file.role === 'model' || file.role === 'projector') &&
        typeof file.path === 'string' &&
        isSafeInstallPath(file.path) &&
        typeof file.bytes === 'number' &&
        typeof file.sha256 === 'string'
    );

    return { id: value.id, revision: value.revision, installedAt: value.installedAt, files };
  } catch {
    return null;
  }
}

/**
 * Is this record a complete, current install of `manifest`? Same id and pinned revision, and every
 * non-optional file present with the manifest's size and hash. A newer manifest revision makes an
 * older install "stale" (`isUpdateAvailable`), not "ready".
 */
export function isCurrentInstall(
  record: InstalledRecord | null,
  manifest: LocalModelManifest
): boolean {
  if (!record || record.id !== manifest.id || record.revision !== manifest.revision) {
    return false;
  }

  return manifest.files
    .filter((file) => !file.optional)
    .every((required) =>
      record.files.some(
        (file) =>
          file.role === required.role &&
          file.path === required.path &&
          file.bytes === required.bytes &&
          file.sha256 === required.sha256
      )
    );
}

export function installHasProjector(record: InstalledRecord | null): boolean {
  return !!record && record.files.some((file) => file.role === 'projector');
}

/** An install of the same model at an older revision: usable until the new one is installed. */
export function isUpdateAvailable(
  record: InstalledRecord | null,
  manifest: LocalModelManifest
): boolean {
  return (
    !!record &&
    record.id === manifest.id &&
    record.revision !== manifest.revision &&
    record.revision.length > 0 &&
    record.files.some((file) => file.role === 'model' && file.path.length > 0)
  );
}

/** Folder names `<id>@<revision>` inside the models folder. */
export function installFolderName(manifest: Pick<LocalModelManifest, 'id' | 'revision'>): string {
  return `${manifest.id}@${manifest.revision}`;
}

/** Install folders to delete: everything but the current one, once it is complete. */
export function staleInstallFolders(
  folders: readonly string[],
  manifest: LocalModelManifest,
  currentIsComplete: boolean
): string[] {
  if (!currentIsComplete) {
    return [];
  }

  const keep = installFolderName(manifest);

  return folders.filter((name) => name !== keep);
}

/** Messages of a transport that really is offline or flaky. */
export const NETWORK_MESSAGE =
  /network|timed out|timeout|offline|connection|unable to resolve|unknownhost|socket|ssl|internet/i;

/**
 * A failure from the transport, mapped to a reason the UI can say in words. `status` is the HTTP
 * status when there was one; `message` the thrown error's text.
 */
export function classifyDownloadFailure(
  status: number | null | undefined,
  message: string | null | undefined
): LocalModelFailure {
  if (typeof status === 'number' && status >= 400) {
    return 'http';
  }

  const text = (message ?? '').toLowerCase();
  if (text.includes('enospc') || text.includes('no space') || text.includes('not enough space')) {
    return 'noSpace';
  }

  if (
    text.includes('writable') ||
    text.includes('readable') ||
    text.includes('eacces') ||
    text.includes('permission') ||
    text.includes('directory') ||
    text.includes('ioexception') ||
    text.includes('read-only')
  ) {
    return 'storage';
  }

  if (text.includes('cancel') || text.includes('abort')) {
    return 'interrupted';
  }

  if (NETWORK_MESSAGE.test(text)) {
    return 'network';
  }

  // Not something we can name: say "interrupted, try again" rather than blaming the connection.
  return 'interrupted';
}

/** Does the app's language appear in the model's trained languages? `pt-BR` matches `pt`. */
export function modelSupportsLanguage(
  manifest: Pick<LocalModelManifest, 'languages'>,
  appLanguage: string | null | undefined
): boolean {
  const base = (appLanguage ?? '').toLowerCase().split(/[-_]/)[0];

  return base === '' ? true : manifest.languages.includes(base);
}
