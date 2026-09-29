import { syncDailySteps } from '@/services/healthConnectFitness';
import { localDayHalfOpenRange } from '@/utils/calendarDate';

/** How stale today's step count may get before a foreground resume re-reads it. */
export const STEPS_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Re-read today's steps from the platform health store, at most once per
 * `STEPS_REFRESH_INTERVAL_MS`.
 *
 * The throttle lives here rather than in the screen that triggers it: a foreground resume
 * is not the only thing that could ever want fresh steps, and a module-level clock sitting
 * in a route file is invisible to anyone reading the component and untestable from
 * outside it. `healthConnectFitness` resolves per platform, so the web no-op makes this
 * harmless there.
 *
 * The timestamp is recorded on SUCCESS only. Stamping before the call meant one failure —
 * a revoked permission, a health store that was not ready yet — suppressed every retry for
 * the next quarter of an hour. Concurrent callers share the in-flight promise instead of
 * issuing a second read.
 */
let lastSyncedAtMs = 0;
let inFlight: null | Promise<void> = null;

export function refreshDailyStepsIfStale(now: number = Date.now()): Promise<void> {
  if (inFlight) {
    return inFlight;
  }

  if (lastSyncedAtMs !== 0 && now - lastSyncedAtMs < STEPS_REFRESH_INTERVAL_MS) {
    return Promise.resolve();
  }

  const { start, nextStart } = localDayHalfOpenRange(new Date(now));

  inFlight = syncDailySteps({ startTime: start, endTime: nextStart })
    .then(() => {
      lastSyncedAtMs = now;
    })
    // Never unhandled: this throws on a device that has not granted the Steps permission,
    // and a declined permission is not an error worth surfacing — the same policy
    // AppBoot's health sync uses.
    .catch(() => undefined)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
