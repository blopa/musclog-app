import * as Haptics from 'expo-haptics';

import type { HapticBeat } from './restTimer';

/**
 * Plays one beat of the rest countdown: a light tick for the last few seconds, a success buzz at
 * zero. Never throws — a device without a haptic engine (and web, where expo-haptics does nothing)
 * must not break the timer.
 */
export async function playRestBeat(beat: HapticBeat): Promise<void> {
  try {
    if (beat === 'done') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Haptics are a nicety; the countdown itself does not depend on them.
  }
}
