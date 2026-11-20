// The last thing a hosted AI request told us about Premium's availability, kept in memory so the
// Premium screens can say "at capacity until tomorrow" or "removed from this subscription" without
// asking the Worker again. Pure and relative-import-only; never persisted, never carries a body.

export type HostedSignal = 'ok' | 'daily_full' | 'unavailable' | 'removed' | 'exhausted';

let current: HostedSignal | null = null;
const listeners = new Set<() => void>();

export function setHostedSignal(signal: HostedSignal | null): void {
  if (current === signal) {
    return;
  }

  current = signal;
  listeners.forEach((listener) => listener());
}

export function getHostedSignal(): HostedSignal | null {
  return current;
}

export function subscribeHostedSignal(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
