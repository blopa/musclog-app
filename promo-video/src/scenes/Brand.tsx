import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { C, FONT } from '../theme';
import { Loggy } from '../components/Loggy';
import { Headline, Sub } from '../components/Text';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** The app icon tile (which carries the name and tagline) springing in with a small twist. */
const AppIcon: React.FC<{ delay: number; size: number; style?: React.CSSProperties }> = ({
  delay,
  size,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    frame: frame - delay,
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });
  const bob = Math.sin(frame / 18) * 6;
  return (
    <Img
      src={staticFile('icon.png')}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        transform: `translateY(${bob}px) scale(${pop}) rotate(${interpolate(pop, [0, 1], [-16, 0])}deg)`,
        ...style,
      }}
    />
  );
};

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 135], [1.05, 1], clamp);
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
      <AppIcon delay={2} size={400} style={{ left: 140, top: 330 }} />
      <Headline
        text={'Your workouts\nand your food,\nin one app'}
        accent={['workouts', 'food']}
        size={84}
        delay={18}
        stagger={4}
        style={{ position: 'absolute', left: 610, top: 350 }}
      />
      <Loggy pose="wave" height={600} delay={40} style={{ left: 1290, top: 350 }} />
    </AbsoluteFill>
  );
};

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const pill = spring({
    frame: frame - 34,
    fps,
    config: { damping: 9, stiffness: 140, mass: 0.7 },
  });
  const url = interpolate(frame - 48, [0, 14], [0, 1], clamp);
  const black = interpolate(frame, [durationInFrames - 24, durationInFrames - 2], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Loggy pose="wave" height={680} delay={8} style={{ left: 130, top: 290 }} />
      <AppIcon delay={0} size={300} style={{ left: 700, top: 300 }} />
      <div style={{ position: 'absolute', left: 1060, top: 310 }}>
        <Headline text={'Start logging\ntoday'} accent={['today']} size={92} delay={10} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 48 }}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 40,
              color: '#091310',
              background: C.brandBright,
              borderRadius: 999,
              padding: '20px 42px',
              transform: `scale(${pill})`,
              opacity: Math.min(1, pill * 2),
            }}
          >
            Free on Google Play
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 42,
              color: C.text,
              opacity: url,
              transform: `translateX(${(1 - url) * 24}px)`,
            }}
          >
            musclog.app
          </div>
        </div>
        <Sub text="iPhone beta on TestFlight" delay={62} size={32} style={{ marginTop: 30 }} />
      </div>
      <AbsoluteFill style={{ backgroundColor: '#000', opacity: black }} />
    </AbsoluteFill>
  );
};

export const Privacy: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = ['Works offline', 'Free', 'Open source'];
  return (
    <AbsoluteFill>
      <Loggy pose="lifting" height={600} delay={4} style={{ left: 150, top: 300 }} />
      <div style={{ position: 'absolute', left: 860, top: 250 }}>
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 124,
            lineHeight: 1.02,
            color: C.text,
          }}
        >
          {['No account.', 'No ads.'].map((l, i) => {
            const s = spring({
              frame: frame - 8 - i * 14,
              fps,
              config: { damping: 12, stiffness: 150 },
            });
            return (
              <div key={l} style={{ opacity: s, transform: `translateX(${(1 - s) * 80}px)` }}>
                {l}
              </div>
            );
          })}
        </div>
        <Sub
          text="Your data stays on your phone."
          delay={40}
          size={50}
          style={{ marginTop: 34, color: C.brandPale }}
        />
        <div style={{ display: 'flex', gap: 22, marginTop: 50 }}>
          {lines.map((l, i) => {
            const s = spring({
              frame: frame - 62 - i * 8,
              fps,
              config: { damping: 12, stiffness: 160 },
            });
            return (
              <div
                key={l}
                style={{
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: 32,
                  color: C.text,
                  border: `2px solid ${C.hairline}`,
                  background: 'rgba(23, 28, 25, 0.7)',
                  borderRadius: 999,
                  padding: '14px 30px',
                  opacity: s,
                  transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`,
                }}
              >
                {l}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
