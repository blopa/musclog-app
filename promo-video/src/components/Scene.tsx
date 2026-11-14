import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export const OVERLAP = 15;

/** Fades a scene in over its first frames and out over the next scene's first frames. */
export const Scene: React.FC<{
  duration: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
  children: React.ReactNode;
}> = ({ duration, fadeIn = true, fadeOut = true, children }) => {
  const frame = useCurrentFrame();
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const inO = fadeIn ? interpolate(frame, [0, OVERLAP], [0, 1], clamp) : 1;
  const outO = fadeOut ? interpolate(frame, [duration - OVERLAP, duration], [1, 0], clamp) : 1;
  const scale = fadeOut ? interpolate(frame, [duration - OVERLAP, duration], [1, 1.04], clamp) : 1;
  return (
    <AbsoluteFill style={{ opacity: Math.min(inO, outO), transform: `scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  );
};
