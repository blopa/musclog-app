import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Confetti } from 'react-native-fast-confetti';

import { LoggyCameo } from '@/components/LoggyCameo';
import type { LoggyPoseName } from '@/components/LoggyPose';

type Props = {
  /**
   * Loggy pops in with the confetti, the default because confetti is only for once-ever firsts.
   * A screen that already stands him up (the workout summary) passes `false`, so one screen shows
   * him once.
   */
  withLoggy?: boolean;
  /** The cameo's pose: the screen that fired the confetti knows what was just done. */
  pose?: LoggyPoseName;
};

const ConfettiOverlay = ({ withLoggy = true, pose }: Props) => {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* The library halves the particle count under reduced motion; a factor of 1 drops it. */}
      <Confetti autoplay={true} gravity={0.5} reduceMotion={{ mode: 'system', factor: 1 }} />
      {withLoggy ? <LoggyCameo pose={pose} /> : null}
    </View>
  );
};

export default ConfettiOverlay;
