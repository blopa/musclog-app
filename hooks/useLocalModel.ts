import { useSyncExternalStore } from 'react';

import {
  type LocalModelSnapshot,
  type LocalModelStore,
  localModelStore,
} from '@/services/localModels/modelStore';

/** A downloaded on-device model's install state (the main one by default); updates as a download progresses. */
export function useLocalModel(store: LocalModelStore = localModelStore): LocalModelSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
