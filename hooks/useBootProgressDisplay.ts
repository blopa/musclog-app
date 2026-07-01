import { useEffect, useRef, useState } from 'react';

import {
  type BootProgressSnapshot,
  getBootProgressSnapshot,
  subscribeBootProgress,
} from '@/utils/bootProgress';

const TRICKLE_INTERVAL_MS = 100;
const TRICKLE_EASING = 0.05;
const TRICKLE_MIN_STEP = 0.0004;

function useBootProgressSnapshot(): BootProgressSnapshot {
  const [snapshot, setSnapshot] = useState(getBootProgressSnapshot);

  useEffect(() => {
    return subscribeBootProgress(() => {
      setSnapshot(getBootProgressSnapshot());
    });
  }, []);

  return snapshot;
}

export function useBootProgressDisplay(): { active: boolean; ratio: number } {
  const progress = useBootProgressSnapshot();
  const [displayed, setDisplayed] = useState(0);
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const id = setInterval(() => {
      const { active, completed, total, target } = progressRef.current;

      if (!active || total <= 0) {
        setDisplayed((current) => (current === 0 ? current : 0));
        return;
      }

      const real = completed / total;
      const ceiling = target / total;

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
