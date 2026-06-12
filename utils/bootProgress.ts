import { useEffect, useState } from 'react';

export type BootProgressState = {
  active: boolean;
  completed: number;
  total: number;
};

const EMPTY_BOOT_PROGRESS: BootProgressState = {
  active: false,
  completed: 0,
  total: 0,
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

export function beginBootProgress(total: number): void {
  if (total <= 0) {
    setBootProgress(EMPTY_BOOT_PROGRESS);
    return;
  }

  setBootProgress({
    active: true,
    completed: 0,
    total,
  });
}

export function completeBootProgressStep(): void {
  if (!state.active || state.total <= 0) {
    return;
  }

  setBootProgress({
    ...state,
    completed: Math.min(state.total, state.completed + 1),
  });
}

export function finishBootProgress(): void {
  if (!state.active) {
    return;
  }

  setBootProgress({
    active: false,
    completed: state.total,
    total: state.total,
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
