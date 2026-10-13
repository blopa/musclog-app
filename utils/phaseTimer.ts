/**
 * Elapsed time per named phase of a slow operation, logged as one line. A slow first AI scan on a
 * release build is only diagnosable if the log says WHICH step was slow (`adb logcat`, filter on
 * the tag), the same way `useCameraCaptureFlow` reports its shutter phases.
 */
export function createPhaseTimer(tag: string, now: () => number = Date.now) {
  const startedAt = now();
  let last = startedAt;
  const phases: { phase: string; ms: number }[] = [];

  return {
    /** Ends the current phase: the time since the previous mark is attributed to `phase`. */
    mark(phase: string): number {
      const at = now();
      const ms = at - last;
      last = at;
      phases.push({ phase, ms });
      return ms;
    },
    /** The phases so far, in order. */
    phases: () => [...phases],
    /** Logs `tag phase=ms … total=ms` as a single line and returns it. */
    log(outcome: string): string {
      const line = `[${tag}] ${phases.map(({ phase, ms }) => `${phase}=${ms}ms`).join(' ')} total=${now() - startedAt}ms outcome=${outcome}`;
      console.log(line);
      return line;
    },
  };
}
