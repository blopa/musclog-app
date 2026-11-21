import { createListeners } from '../createListeners';

// The last thing a hosted AI request told us about Premium's availability, kept in memory so the
// Premium screens can say "at capacity until tomorrow" or "removed from this subscription" without
// asking the Worker again. Pure and relative-import-only; never persisted, never carries a body.

export type HostedSignal = 'ok' | 'daily_full' | 'unavailable' | 'removed' | 'exhausted';

let current: HostedSignal | null = null;
const { subscribe, notify } = createListeners();

export function setHostedSignal(signal: HostedSignal | null): void {
  if (current === signal) {
    return;
  }

  current = signal;
  notify();
}

export function getHostedSignal(): HostedSignal | null {
  return current;
}

export const subscribeHostedSignal = subscribe;
