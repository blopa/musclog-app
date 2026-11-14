import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * A piece of the app's UI lifted out of the phone: a crop of the same capture, enlarged, tilted
 * towards the camera and floating gently.
 */
export const FloatCard: React.FC<{
  src: string;
  left: number;
  top: number;
  width: number;
  delay?: number;
  tiltY?: number;
  tiltX?: number;
  rotate?: number;
  phase?: number;
  from?: 'left' | 'right' | 'below';
}> = ({
  src,
  left,
  top,
  width,
  delay = 0,
  tiltY = 0,
  tiltX = 0,
  rotate = 0,
  phase = 0,
  from = 'below',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 13, stiffness: 110, mass: 0.9 },
  });
  const off = 1 - s;
  const dx = from === 'left' ? -140 * off : from === 'right' ? 140 * off : 0;
  const dy = from === 'below' ? 120 * off : 0;
  const bob = Math.sin(frame / 22 + phase) * 7;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        opacity: Math.min(1, s * 1.5),
        transform: `translate(${dx}px, ${dy + bob}px) perspective(1800px) rotateY(${tiltY}deg) rotateX(${tiltX}deg) rotate(${rotate}deg) scale(${interpolate(s, [0, 1], [0.75, 1])})`,
        borderRadius: 26,
        overflow: 'hidden',
        border: '2px solid rgba(220, 229, 222, 0.14)',
        boxShadow: '0 40px 90px rgba(0, 0, 0, 0.6), 0 10px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      <Img src={staticFile(`cards/${src}.png`)} style={{ display: 'block', width: '100%' }} />
    </div>
  );
};
