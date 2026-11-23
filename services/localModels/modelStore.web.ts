/**
 * Web has no filesystem to install a model into: every call reports "unsupported" and does
 * nothing. Same exports as `modelStore.ts` (`platformModuleParity`).
 */
import {
  DEFAULT_LOCAL_MODEL_SELECTION,
  type LocalModelSelection,
  NOT_INSTALLED,
} from '@/utils/localModels/install';

import type { InstalledLocalModel, LocalModelSnapshot } from './modelStore';

export type { InstalledLocalModel, LocalModelSnapshot };

const snapshot: LocalModelSnapshot = {
  supported: false,
  state: NOT_INSTALLED,
  selection: DEFAULT_LOCAL_MODEL_SELECTION,
  updateAvailable: false,
  projectorInstalled: false,
};

export function getLocalModelSnapshot(): LocalModelSnapshot {
  return snapshot;
}

export function subscribeLocalModel(_listener: () => void): () => void {
  return () => undefined;
}

export function registerLocalModelUnloader(_fn: () => Promise<void>) {}

export function getLocalModelRoot(): string | null {
  return null;
}

export async function refreshLocalModel(): Promise<void> {}

export async function getInstalledLocalModel(): Promise<InstalledLocalModel | null> {
  return null;
}

export async function getFreeDiskBytes(): Promise<number | null> {
  return null;
}

export async function startLocalModelDownload(_selection?: LocalModelSelection): Promise<void> {}

export async function pauseLocalModelDownload(): Promise<void> {}

export async function resumeLocalModelDownload(): Promise<void> {}

export async function cancelLocalModelDownload(): Promise<void> {}

export async function deleteLocalModel(): Promise<void> {}

export function resetLocalModelStoreForTests() {}
