export type BootProgressSnapshot = {
  active: boolean;
  completed: number;
  total: number;
  target: number;
};

type BootProgressState = BootProgressSnapshot & {
  stepWeights: number[];
  stepIndex: number;
};

const EMPTY_BOOT_PROGRESS: BootProgressState = {
  active: false,
  completed: 0,
  total: 0,
  target: 0,
  stepWeights: [],
  stepIndex: 0,
};

let state = EMPTY_BOOT_PROGRESS;
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

function ceilingFor(
  completed: number,
  index: number,
  total: number,
  stepWeights: number[]
): number {
  const inFlightWeight = stepWeights[index] ?? 0;
  return Math.min(total, completed + inFlightWeight);
}

export function startBootProgress(weights: number[]): void {
  const stepWeights = weights.filter((weight) => Number.isFinite(weight) && weight > 0);
  const total = stepWeights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) {
    setBootProgress(EMPTY_BOOT_PROGRESS);
    return;
  }

  setBootProgress({
    active: true,
    completed: 0,
    total,
    target: ceilingFor(0, 0, total, stepWeights),
    stepWeights,
    stepIndex: 0,
  });
}

export function advanceBootProgressStep(): void {
  if (!state.active || state.total <= 0 || state.stepIndex >= state.stepWeights.length) {
    return;
  }

  const completed = Math.min(state.total, state.completed + state.stepWeights[state.stepIndex]);
  const stepIndex = state.stepIndex + 1;

  setBootProgress({
    ...state,
    completed,
    stepIndex,
    target: ceilingFor(completed, stepIndex, state.total, state.stepWeights),
  });
}

export function finishBootProgress(): void {
  if (!state.active) {
    return;
  }

  setBootProgress({
    ...EMPTY_BOOT_PROGRESS,
    completed: state.total,
    total: state.total,
    target: state.total,
  });
}

export function getBootProgressSnapshot(): BootProgressSnapshot {
  const { active, completed, total, target } = state;
  return { active, completed, total, target };
}

export function subscribeBootProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
