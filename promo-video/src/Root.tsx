import React from 'react';
import { Composition } from 'remotion';
import { FPS } from './theme';
import { MusclogPromo, TOTAL_FRAMES } from './Promo';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MusclogPromo"
    component={MusclogPromo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
