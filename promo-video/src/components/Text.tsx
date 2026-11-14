import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from '../theme';

/** Words rise into place one after another. Words listed in `accent` take the brand green. */
export const Headline: React.FC<{
  text: string;
  accent?: string[];
  size?: number;
  delay?: number;
  stagger?: number;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
}> = ({ text, accent = [], size = 92, delay = 0, stagger = 3, align = 'left', style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = text.split('\n');
  let index = 0;
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.04,
        color: C.text,
        textAlign: align,
        ...style,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ whiteSpace: 'nowrap' }}>
          {line.split(' ').map((word, wi) => {
            const i = index++;
            const s = spring({
              frame: frame - delay - i * stagger,
              fps,
              config: { damping: 14, stiffness: 140 },
            });
            const clean = word.replace(/[.,!?]/g, '');
            return (
              <span
                key={wi}
                style={{
                  display: 'inline-block',
                  marginRight: '0.26em',
                  opacity: s,
                  transform: `translateY(${interpolate(s, [0, 1], [size * 0.55, 0])}px)`,
                  color: accent.includes(clean) ? C.brandBright : undefined,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export const Sub: React.FC<{
  text: string;
  delay?: number;
  size?: number;
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
}> = ({ text, delay = 0, size = 38, align = 'left', style }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - delay, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.3,
        color: C.textSecondary,
        textAlign: align,
        opacity: o,
        transform: `translateY(${(1 - o) * 18}px)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

export const Label: React.FC<{ text: string; delay?: number; style?: React.CSSProperties }> = ({
  text,
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 30,
        color: C.brandBright,
        opacity: o,
        transform: `translateX(${(1 - o) * -16}px)`,
        marginBottom: 18,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

export const Chips: React.FC<{ items: string[]; delay?: number; style?: React.CSSProperties }> = ({
  items,
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, ...style }}>
      {items.map((item, i) => {
        const s = spring({
          frame: frame - delay - i * 6,
          fps,
          config: { damping: 12, stiffness: 160 },
        });
        return (
          <div
            key={item}
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: 28,
              color: C.brandPale,
              background: 'rgba(6, 78, 59, 0.55)',
              border: `2px solid rgba(52, 211, 153, 0.45)`,
              borderRadius: 999,
              padding: '12px 26px',
              opacity: s,
              transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`,
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
};
