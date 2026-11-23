import { useSyncExternalStore } from 'react';

import {
  getLocalModelSnapshot,
  type LocalModelSnapshot,
  subscribeLocalModel,
} from '@/services/localModels/modelStore';

/** The downloaded on-device model's install state; updates as a download progresses. */
export function useLocalModel(): LocalModelSnapshot {
  return useSyncExternalStore(subscribeLocalModel, getLocalModelSnapshot, getLocalModelSnapshot);
}
