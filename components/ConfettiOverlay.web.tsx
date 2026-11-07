import confetti from 'canvas-confetti';
import { useEffect } from 'react';
import { View } from 'react-native';

import { LoggyCameo } from '@/components/LoggyCameo';
import type { LoggyPoseName } from '@/components/LoggyPose';

type Props = {
  /** See `ConfettiOverlay.tsx`: the default, and off for a screen that already shows him. */
  withLoggy?: boolean;
  /** See `ConfettiOverlay.tsx`. */
  pose?: LoggyPoseName;
};

const ConfettiOverlay = ({ withLoggy = true, pose }: Props) => {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999';
    document.body.appendChild(canvas);

    const myConfetti = confetti.create(canvas, { resize: true });
    myConfetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.4 },
    });

    return () => {
      myConfetti.reset();
      canvas.remove();
    };
  }, []);

  if (!withLoggy) {
    return null;
  }

  // Fixed to the viewport like the confetti canvas: this overlay mounts inside whichever screen
  // fired it, and Loggy belongs at the bottom of the window, not of that screen's container.
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'fixed' as never,
        top: 0,
        left: 0,
        width: '100vw' as never,
        height: '100vh' as never,
        zIndex: 999999,
      }}
    >
      <LoggyCameo pose={pose} />
    </View>
  );
};

export default ConfettiOverlay;
