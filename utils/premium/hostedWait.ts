import { createListeners } from '../createListeners';

// The calm "still working" cue for a slow Premium (hosted) AI reply. Pure and relative-import-only.
// `withLlmRetry` marks the time it spends backing off before a retry; screens turn that and the
// time since the request began into one line. No countdown, no percentage.

/** After this long with no first text, a hosted reply says it is still working. */
export const HOSTED_SLOW_MS = 8000;

export type HostedWaitLine = 'working' | 'busy';

let backingOff = 0;
const { subscribe, notify } = createListeners();

/** Wraps the wait before a hosted retry (409 in_progress, 429, 502/503/504). Safe to nest. */
export async function whileHostedBackingOff<T>(wait: () => Promise<T>): Promise<T> {
  backingOff += 1;
  notify();

  try {
    return await wait();
  } finally {
    backingOff -= 1;
    notify();
  }
}

export function isHostedBackingOff(): boolean {
  return backingOff > 0;
}

export const subscribeHostedBackoff = subscribe;

/** Backing off is shown at once; a plain slow reply only after `HOSTED_SLOW_MS`. */
export function hostedWaitLine(elapsedMs: number, isBackingOff: boolean): HostedWaitLine | null {
  if (isBackingOff) {
    return 'busy';
  }

  return elapsedMs >= HOSTED_SLOW_MS ? 'working' : null;
}
