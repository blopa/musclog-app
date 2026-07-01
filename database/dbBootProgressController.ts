import { useEffect, useRef, useState } from 'react';

import {
  beginBootProgress as beginBootProgressStore,
  finishBootProgress as finishBootProgressStore,
  setBootProgressCompleted,
  useBootProgress,
} from '@/utils/bootProgress';

type WeightedBootProgressState = {
  total: number;
  stepWeights: number[];
  stepIndex: number;
  target: number;
};

const EMPTY_WEIGHTED_PROGRESS: WeightedBootProgressState = {
  total: 0,
  stepWeights: [],
  stepIndex: 0,
  target: 0,
};

let weightedState = EMPTY_WEIGHTED_PROGRESS;

function ceilingFor(completed: number, index: number, total: number, stepWeights: number[]): number {
  const inFlightWeight = stepWeights[index] ?? 0;
  return Math.min(total, completed + inFlightWeight);
}

export function beginBootProgress(weights: number[]): void {
  const stepWeights = weights.filter((weight) => Number.isFinite(weight) && weight > 0);
  const total = stepWeights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) {
    weightedState = EMPTY_WEIGHTED_PROGRESS;
    beginBootProgressStore(0);
    return;
  }

  weightedState = {
    total,
    stepWeights,
    stepIndex: 0,
    target: ceilingFor(0, 0, total, stepWeights),
  };
  beginBootProgressStore(total);
}

export function completeBootProgressStep(): void {
  if (weightedState.total <= 0 || weightedState.stepIndex >= weightedState.stepWeights.length) {
    return;
  }

  const completed = weightedState.stepWeights
    .slice(0, weightedState.stepIndex + 1)
    .reduce((sum, weight) => sum + weight, 0);
  const stepIndex = weightedState.stepIndex + 1;

  weightedState = {
    ...weightedState,
    stepIndex,
    target: ceilingFor(completed, stepIndex, weightedState.total, weightedState.stepWeights),
  };
  setBootProgressCompleted(completed);
}

export function finishBootProgress(): void {
  weightedState = EMPTY_WEIGHTED_PROGRESS;
  finishBootProgressStore();
}

const TRICKLE_INTERVAL_MS = 100;
const TRICKLE_EASING = 0.05;
const TRICKLE_MIN_STEP = 0.0004;

export function useBootProgressDisplay(): { active: boolean; ratio: number } {
  const progress = useBootProgress();
  const [displayed, setDisplayed] = useState(0);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const id = setInterval(() => {
      const { active, completed, total } = progressRef.current;

      if (!active || total <= 0) {
        setDisplayed((current) => (current === 0 ? current : 0));
        return;
      }

      const real = completed / total;
      const ceiling = weightedState.total > 0 ? weightedState.target / weightedState.total : real;

      setDisplayed((current) => {
        const base = current < real ? real : current;
        const next = Math.min(base + (ceiling - base) * TRICKLE_EASING, ceiling);
        return next - current < TRICKLE_MIN_STEP ? current : next;
      });
    }, TRICKLE_INTERVAL_MS);

    return () => clearInterval(id);
  }, []);

  return { active: progress.active, ratio: displayed };
}
