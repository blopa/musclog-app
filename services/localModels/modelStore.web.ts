/**
 * Web has no filesystem to install a model into: every call reports "unsupported" and does
 * nothing. Same exports as `modelStore.ts` (`platformModuleParity`).
 */
import {
  DEFAULT_LOCAL_MODEL_SELECTION,
  type LocalModelSelection,
  NOT_INSTALLED,
} from '@/utils/localModels/install';

import { isDevWebLocalModel } from './devWebBridge';
import type { InstalledLocalModel, LocalModelSnapshot } from './modelStore';

export type { InstalledLocalModel, LocalModelSnapshot };

// Under the dev server the model "is installed": `llamaRuntime.web.ts` forwards to a desktop
// llama-server (`devWebBridge.ts`). Production web stays unsupported.
const devBridge = isDevWebLocalModel();
const snapshot: LocalModelSnapshot = {
  supported: devBridge,
  state: devBridge
    ? { kind: 'ready', revision: 'dev-web-bridge', withProjector: true }
    : NOT_INSTALLED,
  selection: DEFAULT_LOCAL_MODEL_SELECTION,
  updateAvailable: false,
  projectorInstalled: devBridge,
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

export async function getLocalModelSpaceCheck(
  _selection: LocalModelSelection
): Promise<{ enough: true }> {
  return { enough: true };
}

export async function startLocalModelDownload(_selection?: LocalModelSelection): Promise<void> {}

export async function pauseLocalModelDownload(): Promise<void> {}

export async function resumeLocalModelDownload(): Promise<void> {}

export async function cancelLocalModelDownload(): Promise<void> {}

export async function deleteLocalModel(): Promise<void> {}

export function resetLocalModelStoreForTests() {}
