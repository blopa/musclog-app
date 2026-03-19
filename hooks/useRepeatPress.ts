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
  const onPressRef = useRef(onPress);

  // Keep onPressRef up to date to avoid stale closures
  onPressRef.current = onPress;

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

    // Guard against multiple concurrent start calls
    if (isActiveRef.current) return;
    isActiveRef.current = true;

    // Trigger initial press immediately
    onPressRef.current();

    // Start delay timer for repeating
    timerRef.current = setTimeout(() => {
      if (!isActiveRef.current) return;

      // Haptic feedback when repeating starts
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let currentInterval = initialInterval;
      let count = 0;

      const runRepeat = () => {
        if (!isActiveRef.current) return;

        onPressRef.current();

        // Throttled haptics for performance
        count++;
        if (currentInterval >= 100 || count % 2 === 0) {
           Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        const scheduledInterval = currentInterval;

        // Acceleration logic
        if (currentInterval === initialInterval) {
          currentInterval = acceleratedInterval;
        }

        repeatTimerRef.current = setTimeout(runRepeat, scheduledInterval);
      };

      runRepeat();
    }, initialDelay);
  }, [initialDelay, initialInterval, acceleratedInterval]);

  // Memoize the return object to prevent unnecessary re-renders of the component using this hook.
  // Using a stable function for web as well.
  return useMemo(() => {
    if (Platform.OS === 'web') {
      return { onPress: () => onPressRef.current() };
    }

    return {
      onPressIn: startRepeating,
      onPressOut: stopRepeating,
    };
  }, [startRepeating, stopRepeating]);
}
