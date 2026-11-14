import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Phones3D, PhoneSpec } from '../components/Phones3D';
import { Headline, Sub } from '../components/Text';

const THEMES = ['shock', 'volt', 'light', 'depth', 'blush', 'scope', 'varia'];

/** Seven phones on a slowly turning arc, one per theme. */
export const ThemesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const turn = (frame / fps) * 0.06 - 0.18;
  const R = 7;
  const phones: PhoneSpec[] = THEMES.map((id, i) => {
    const a = (i - 3) * 0.24 + turn;
    return {
      screen: `screens/theme-kinetic-${id}.png`,
      x: R * Math.sin(a),
      y: -0.55,
      z: R * Math.cos(a) - R - 0.6 - Math.abs(i - 3) * 0.05,
      height: 3.35,
      rotY: a * 1.1,
      delay: 6 + Math.abs(i - 3) * 5,
      phase: i * 0.9,
      sway: 0.5,
    };
  });
  return (
    <AbsoluteFill>
      <Phones3D phones={phones} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 60 }}>
        <Headline text="Make it yours" accent={['yours']} size={88} align="center" delay={4} />
        <Sub
          text="Seven themes. The app icon follows along."
          align="center"
          delay={20}
          style={{ marginTop: 14 }}
        />
      </div>
    </AbsoluteFill>
  );
};
