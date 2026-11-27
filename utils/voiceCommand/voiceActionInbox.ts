import { createListeners } from '@/utils/createListeners';
import type { VoiceAction, VoiceActionKind } from '@/utils/voiceCommand/types';

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

function isOfKind<K extends VoiceActionKind>(
  action: VoiceAction,
  kinds: readonly K[]
): action is Extract<VoiceAction, { kind: K }> {
  return kinds.some((kind) => kind === action.kind);
}

/**
 * Takes the pending action, so it is performed once, but only if it is one of the `kinds` the
 * caller performs: a focused screen must never take a command meant for another one.
 */
export function takePendingVoiceAction<K extends VoiceActionKind>(
  kinds: readonly K[]
): Extract<VoiceAction, { kind: K }> | null {
  const action = pending;
  if (!action || !isOfKind(action, kinds)) {
    return null;
  }

  pending = null;

  return action;
}
