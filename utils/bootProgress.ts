import { useEffect, useRef, useState } from 'react';

export type BootProgressState = {
  active: boolean;
  /** Completed weight — real, honest progress. */
  completed: number;
  /** Total weight across all steps. */
  total: number;
  /**
   * Weight the in-flight step will reach once it completes. The trickle
   * animation eases toward this ceiling (never past it) while that step runs,
   * so the bar keeps moving during long, progress-less phases without ever
   * overshooting real progress.
   */
  target: number;
};

const EMPTY_BOOT_PROGRESS: BootProgressState = {
  active: false,
  completed: 0,
  total: 0,
  target: 0,
};

let state = EMPTY_BOOT_PROGRESS;
let stepWeights: number[] = [];
let stepIndex = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function setBootProgress(next: BootProgressState) {
  state = next;
  emit();
}

// The ceiling for the step currently in flight: completed weight plus the weight
// of the step that is about to run (clamped to total, 0 once every step is done).
function ceilingFor(completed: number, index: number, total: number): number {
  const inFlightWeight = stepWeights[index] ?? 0;
  return Math.min(total, completed + inFlightWeight);
}

/**
 * Start a run. Each entry in `weights` is one step's relative share of the bar;
 * steps expected to take longer (e.g. the DB-ready step that hides the
 * pre-migration backup + schema migration on an upgrade) should get a larger
 * weight so the trickle has room to move while they run. `completeBootProgressStep`
 * must be called once per weight, in order.
 */
export function beginBootProgress(weights: number[]): void {
  const normalized = weights.filter((w) => Number.isFinite(w) && w > 0);
  const total = normalized.reduce((sum, w) => sum + w, 0);

  if (total <= 0) {
    stepWeights = [];
    stepIndex = 0;
    setBootProgress(EMPTY_BOOT_PROGRESS);
    return;
  }

  stepWeights = normalized;
  stepIndex = 0;
  setBootProgress({
    active: true,
    completed: 0,
    total,
    target: ceilingFor(0, 0, total),
  });
}

export function completeBootProgressStep(): void {
  if (!state.active || state.total <= 0 || stepIndex >= stepWeights.length) {
    return;
  }

  const completed = Math.min(state.total, state.completed + stepWeights[stepIndex]);
  stepIndex += 1;

  setBootProgress({
    ...state,
    completed,
    target: ceilingFor(completed, stepIndex, state.total),
  });
}

export function finishBootProgress(): void {
  if (!state.active) {
    return;
  }

  stepWeights = [];
  stepIndex = 0;
  setBootProgress({
    active: false,
    completed: state.total,
    total: state.total,
    target: state.total,
  });
}

function getBootProgressSnapshot(): BootProgressState {
  return state;
}

export function subscribeBootProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBootProgress(): BootProgressState {
  const [snapshot, setSnapshot] = useState(getBootProgressSnapshot);

  useEffect(() => {
    return subscribeBootProgress(() => {
      setSnapshot(getBootProgressSnapshot());
    });
  }, []);

  return snapshot;
}

// Trickle animation. While a step is in flight the displayed value eases toward
// that step's ceiling (asymptotically — it never actually reaches it), and snaps
// forward the instant real progress lands. This keeps the bar visibly moving
// during long, progress-less phases (the pre-migration backup / schema
// migration) instead of sitting frozen at 0%. It never regresses and never
// overshoots real progress, so it can't lie by more than the in-flight step.
const TRICKLE_INTERVAL_MS = 100;
const TRICKLE_EASING = 0.05;
const TRICKLE_MIN_STEP = 0.0004;

export function useBootProgressDisplay(): { active: boolean; ratio: number } {
  const progress = useBootProgress();
  const [displayed, setDisplayed] = useState(0);

  // Keep the latest snapshot in a ref so a single long-lived interval can always
  // animate toward the current targets without re-subscribing on every step.
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const id = setInterval(() => {
      const { active, completed, total, target } = progressRef.current;

      if (!active || total <= 0) {
        // Reset to empty between runs so the next boot trickles up from 0.
        setDisplayed((current) => (current === 0 ? current : 0));
        return;
      }

      const real = completed / total;
      const ceiling = target / total;
      setDisplayed((current) => {
        // Real progress always wins: snap forward, never regress.
        const base = current < real ? real : current;
        const next = Math.min(base + (ceiling - base) * TRICKLE_EASING, ceiling);
        // Bail out (return the same value) once movement is sub-pixel so we stop
        // re-rendering while parked just under the ceiling.
        return next - current < TRICKLE_MIN_STEP ? current : next;
      });
    }, TRICKLE_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);

  return { active: progress.active, ratio: displayed };
}
