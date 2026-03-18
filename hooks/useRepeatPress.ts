import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';
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
  const onPressRef = useRef(onPress);

  // Keep onPressRef up to date
  onPressRef.current = onPress;

  const stopRepeating = useCallback(() => {
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

    // Trigger initial press immediately
    onPressRef.current();

    // Start delay timer for repeating
    timerRef.current = setTimeout(() => {
      // Haptic feedback when repeating starts
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let currentInterval = initialInterval;

      const runRepeat = () => {
        onPressRef.current();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

  // For web, we just return standard onPress
  if (Platform.OS === 'web') {
    return { onPress };
  }

  return {
    onPressIn: startRepeating,
    onPressOut: stopRepeating,
  };
}
