import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';

import { LoggyPose, type LoggyPoseName, useLoggyVisible } from '@/components/LoggyPose';

/** Long enough to register, short enough that he is gone before the screen needs the space. */
const CAMEO_VISIBLE_MS = 3200;
/**
 * Where his middle sits, as a share of the screen's height: the same 40% the web confetti bursts
 * from. The bottom edge was tried first and covered whatever lived there (the tab bar, a sheet's
 * Save button); no control sits in the upper middle of a screen, and the confetti is already there.
 */
const CENTER_FROM_TOP = '40%';

type Props = {
  pose?: LoggyPoseName;
  height?: number;
};

/**
 * Loggy pops in with the confetti for a moment and leaves. It is the face of a once-ever first (the
 * first meal, the first workout), and the whole overlay ignores touches, so the screen under it
 * stays usable. Entering and leaving use Reanimated's default reduce-motion handling, so under the
 * system setting he simply appears and disappears. With "Show Loggy" off only the confetti remains.
 */
export function LoggyCameo({ pose = 'celebrating', height = 200 }: Props) {
  const showLoggy = useLoggyVisible();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!showLoggy) {
      return;
    }

    const timer = setTimeout(() => setVisible(false), CAMEO_VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [showLoggy]);

  if (!showLoggy) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {visible ? (
        <Animated.View
          entering={ZoomIn.duration(300)}
          exiting={FadeOut.duration(260)}
          // A style, not a class: NativeWind does not reach reanimated's Animated.View.
          style={{
            alignSelf: 'center',
            marginTop: -height / 2,
            position: 'absolute',
            top: CENTER_FROM_TOP,
          }}
        >
          <LoggyPose pose={pose} height={height} />
        </Animated.View>
      ) : null}
    </View>
  );
}
