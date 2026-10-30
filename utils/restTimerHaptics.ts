import * as Haptics from 'expo-haptics';

import type { RestHapticStrength } from '@/constants/settings';

import type { HapticBeat } from './restTimer';

const STRONG_REPEAT_DELAY_MS = 180;

/**
 * Plays one beat of the rest countdown: a medium tap for the heads-up, a light tick for the last
 * few seconds, a success buzz at zero. `strong` swaps in heavier impacts and doubles the final
 * buzz, for a lifter who feels the standard one through a glove or a pocket. Never throws — a
 * device without a haptic engine (and web, where expo-haptics does nothing) must not break the
 * timer.
 */
export async function playRestBeat(
  beat: HapticBeat,
  strength: RestHapticStrength = 'standard'
): Promise<void> {
  const strong = strength === 'strong';
  try {
    if (beat === 'done') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (strong) {
        await new Promise((resolve) => setTimeout(resolve, STRONG_REPEAT_DELAY_MS));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else if (beat === 'headsUp') {
      await Haptics.impactAsync(
        strong ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium
      );
    } else {
      await Haptics.impactAsync(
        strong ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      );
    }
  } catch {
    // Haptics are a nicety; the countdown itself does not depend on them.
  }
}
