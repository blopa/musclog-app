import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig } from 'remotion';
import { BAR } from './theme';
import { Backdrop } from './components/Backdrop';
import { OVERLAP, Scene } from './components/Scene';
import { Intro, Outro, Privacy } from './scenes/Brand';
import { FoodScene, HomeScene, ProgressScene, ReviewScene, WorkoutScene } from './scenes/Features';
import { ThemesScene } from './scenes/Themes';

/** Scenes in bars of the 120 BPM track (one bar = 60 frames); each runs on under the next one's fade. */
const TIMELINE: { bars: number; component: React.FC }[] = [
  { bars: 2, component: Intro },
  { bars: 3, component: HomeScene },
  { bars: 4, component: WorkoutScene },
  { bars: 4, component: FoodScene },
  { bars: 4, component: ProgressScene },
  { bars: 3, component: ReviewScene },
  { bars: 3, component: ThemesScene },
  { bars: 3, component: Privacy },
  { bars: 3, component: Outro },
];

export const TOTAL_FRAMES = TIMELINE.reduce((n, s) => n + s.bars * BAR, 0);

export const MusclogPromo: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  let from = 0;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Audio
        src={staticFile('music.wav')}
        volume={(f) =>
          interpolate(f, [0, 8, durationInFrames - 40, durationInFrames], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />
      {TIMELINE.map((s, i) => {
        const start = from;
        const last = i === TIMELINE.length - 1;
        const duration = s.bars * BAR + (last ? 0 : OVERLAP);
        from += s.bars * BAR;
        return (
          <Sequence key={i} from={start} durationInFrames={duration}>
            <Scene duration={duration} fadeIn={i > 0} fadeOut={!last}>
              <s.component />
            </Scene>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
