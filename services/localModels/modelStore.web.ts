/**
 * Web has no filesystem to install a model into: every call reports "unsupported" and does
 * nothing. Same exports as `modelStore.ts` (`platformModuleParity`).
 */
import { DEFAULT_LOCAL_MODEL, LOCAL_TEXT_MODEL } from '@/constants/localModels';
import {
  DEFAULT_LOCAL_MODEL_SELECTION,
  type LocalModelSelection,
  NOT_INSTALLED,
  type SpaceCheck,
} from '@/utils/localModels/install';

import { isDevWebLocalModel } from './devWebBridge';
import type { InstalledLocalModel, LocalModelSnapshot, LocalModelStore } from './modelStore';

export type { InstalledLocalModel, LocalModelSnapshot, LocalModelStore };

// Under the dev server the model "is installed": `llamaRuntime.web.ts` forwards to a desktop
// llama-server (`devWebBridge.ts`). Production web stays unsupported, and so does the text model.
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

const textSnapshot: LocalModelSnapshot = {
  supported: false,
  state: NOT_INSTALLED,
  selection: { withProjector: false },
  updateAvailable: false,
  projectorInstalled: false,
};

const ENOUGH: SpaceCheck = { enough: true };

function inertStore(
  manifest: LocalModelStore['manifest'],
  state: LocalModelSnapshot
): LocalModelStore {
  return {
    manifest,
    getSnapshot: () => state,
    subscribe: (_listener: () => void) => () => undefined,
    refresh: async () => {},
    getInstalled: async (): Promise<InstalledLocalModel | null> => null,
    getSpaceCheck: async (_selection: LocalModelSelection) => ENOUGH,
    start: async (_selection?: LocalModelSelection) => {},
    pause: async () => {},
    resume: async () => {},
    cancel: async () => {},
    remove: async () => {},
  };
}

export const localModelStore: LocalModelStore = inertStore(DEFAULT_LOCAL_MODEL, snapshot);

export const localTextModelStore: LocalModelStore = inertStore(LOCAL_TEXT_MODEL, textSnapshot);

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
): Promise<SpaceCheck> {
  return ENOUGH;
}

export async function startLocalModelDownload(_selection?: LocalModelSelection): Promise<void> {}

export async function pauseLocalModelDownload(): Promise<void> {}

export async function resumeLocalModelDownload(): Promise<void> {}

export async function cancelLocalModelDownload(): Promise<void> {}

export async function deleteLocalModel(): Promise<void> {}

export function resetLocalModelStoreForTests() {}
