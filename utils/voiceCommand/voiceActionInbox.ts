import { createListeners } from '@/utils/createListeners';
import type { VoiceAction } from '@/utils/voiceCommand/types';

/**
 * The one pending voice action, from the provider that understood a sentence to the screen that
 * performs it. Deliberately not an open-link kind: no outside link may trigger a command.
 */

let pending: VoiceAction | null = null;
const { subscribe, notify } = createListeners();

export function setPendingVoiceAction(action: VoiceAction | null) {
  pending = action;
  notify();
}

export const subscribePendingVoiceAction = subscribe;

/** Takes the pending action, so it is performed once. */
export function takePendingVoiceAction(): VoiceAction | null {
  const action = pending;
  pending = null;
  return action;
}
