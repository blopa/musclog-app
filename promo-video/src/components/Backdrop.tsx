import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { C } from '../theme';

/**
 * The Play listing's own backdrop (17280x3840, eight slides of waves) panned slowly from left to
 * right across the whole film, so the video and the store screenshots read as one set.
 */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  const scale = height / 3840;
  const width = 17280 * scale;
  const travel = width - 1920 - 200;
  const x = -interpolate(frame, [0, durationInFrames], [80, 80 + travel]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.base, overflow: 'hidden' }}>
      <Img
        src={staticFile('backdrop.svg')}
        style={{ position: 'absolute', left: x, top: 0, width, height }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 75% 70% at 50% 45%, rgba(13,18,16,0.3) 30%, rgba(9,19,16,0.8) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
