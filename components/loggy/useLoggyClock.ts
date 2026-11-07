import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { LoggyClock } from '@/components/loggy/LoggyLayer';

/**
 * The clock an animated pose runs on: milliseconds into its loop, counting up forever. Layers take
 * the remainder against their own duration (`sampleLoggyLayer`), so one linear clock drives layers
 * with different periods. It starts at 0, the still's own frame.
 */
export function useLoggyClock(loopMs: number): LoggyClock {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(withTiming(loopMs, { duration: loopMs, easing: Easing.linear }), -1);

    return () => cancelAnimation(clock);
  }, [clock, loopMs]);

  return clock;
}
