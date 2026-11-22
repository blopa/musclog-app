// Which "still working" line a hosted AI wait shows, if any. `waiting` is true from the moment a
// request starts until its first text (or its end); the timer is one timeout, not a loop.
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  HOSTED_SLOW_MS,
  type HostedWaitLine,
  hostedWaitLine,
  isHostedBackingOff,
  subscribeHostedBackoff,
} from '@/utils/premium/hostedWait';

export function useHostedWaitCue(waiting: boolean): HostedWaitLine | null {
  const [slow, setSlow] = useState(false);
  const backingOff = useSyncExternalStore(
    subscribeHostedBackoff,
    isHostedBackingOff,
    isHostedBackingOff
  );

  useEffect(() => {
    if (!waiting) {
      return;
    }

    const timer = setTimeout(() => setSlow(true), HOSTED_SLOW_MS);

    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [waiting]);

  return waiting ? hostedWaitLine(slow ? HOSTED_SLOW_MS : 0, backingOff) : null;
}
