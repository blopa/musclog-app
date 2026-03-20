import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';

interface UseRepeatPressOptions {
  onPress: () => void;
  initialDelay?: number;
  initialInterval?: number;
  acceleratedInterval?: number;
}

/**
 * A custom hook to handle repeating logic for button presses on mobile.
 */
export function useRepeatPress({
  onPress,
  initialDelay = 500,
  initialInterval = 100,
  acceleratedInterval = 50,
}: UseRepeatPressOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const repeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  // Use refs for all props to ensure the returned handlers are COMPLETELY stable.
  // This is CRITICAL to prevent "Maximum update depth exceeded" errors on standard RN buttons.
  const propsRef = useRef({
    onPress,
    initialDelay,
    initialInterval,
    acceleratedInterval
  });

  // Always sync props to the ref
  propsRef.current = {
    onPress,
    initialDelay,
    initialInterval,
    acceleratedInterval
  };

  const stopRepeating = useCallback(() => {
    isActiveRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (repeatTimerRef.current) {
      clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }, []);

  const startRepeating = useCallback(() => {
    if (Platform.OS === 'web') return;

    // Safety cleanup
    stopRepeating();

    isActiveRef.current = true;

    // Trigger initial press immediately
    propsRef.current.onPress();

    // Start delay timer for repeating
    timerRef.current = setTimeout(() => {
      if (!isActiveRef.current) return;

      // Haptic feedback when repeating starts
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let currentInterval = propsRef.current.initialInterval;
      let count = 0;

      const runRepeat = () => {
        if (!isActiveRef.current) return;

        propsRef.current.onPress();

        // Throttled haptics
        count++;
        if (currentInterval >= 100 || count % 2 === 0) {
           Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        const scheduledInterval = currentInterval;

        // Acceleration logic
        if (currentInterval === propsRef.current.initialInterval) {
          currentInterval = propsRef.current.acceleratedInterval;
        }

        repeatTimerRef.current = setTimeout(runRepeat, scheduledInterval);
      };

      runRepeat();
    }, propsRef.current.initialDelay);
  }, [stopRepeating]);

  // RETURNED HANDLERS ARE NOW COMPLETELY STABLE.
  // The only dependency is start/stopRepeating which are also stable.
  return useMemo(() => {
    if (Platform.OS === 'web') {
      return {
        onPress: () => {
          propsRef.current.onPress();
        }
      };
    }

    return {
      onPressIn: startRepeating,
      onPressOut: stopRepeating,
    };
  }, [startRepeating, stopRepeating]);
}
