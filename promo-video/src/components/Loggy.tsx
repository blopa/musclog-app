import React, { useEffect, useState } from 'react';
import {
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export type LoggyPose = 'wave' | 'lifting' | 'reading' | 'thinking' | 'shrug';

// Each pose's viewBox width / height.
const ASPECT: Record<LoggyPose, string> = {
  wave: '560 / 640',
  lifting: '640 / 640',
  reading: '512 / 640',
  thinking: '512 / 668',
  shrug: '560 / 640',
};

/**
 * Loggy, drawn from the website's animated SVG. Its motion is CSS keyframes, which would run on
 * the wall clock and stutter in a frame-by-frame render, so the SVG is inlined and every
 * animation is paused and scrubbed to the current frame with a negative delay. Ids and keyframe
 * names get a per-pose prefix because an inline <style> is global to the page.
 */
const useLoggySvg = (pose: LoggyPose) => {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    const handle = delayRender(`loggy ${pose}`);
    fetch(staticFile(`loggy/loggy-${pose}.svg`))
      .then((r) => r.text())
      .then((raw) => {
        const p = `lg-${pose}-`;
        const ids = [...raw.matchAll(/id="([\w-]+)"/g)].map((m) => m[1]);
        let out = raw.replace(/<!--[\s\S]*?-->/g, '');
        for (const id of ids) {
          out = out.replace(new RegExp(`id="${id}"`, 'g'), `id="${p}${id}"`);
          out = out.replace(new RegExp(`#${id}(?![\\w-])`, 'g'), `#${p}${id}`);
        }
        out = out.replace(/loggy-([\w-]+)/g, `${p}kf-$1`);
        out = out.replace(
          /<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/,
          '<svg$1 width="100%" height="100%"'
        );
        out = out.replace(
          '</style>',
          `.${p}root * { animation-play-state: paused !important; animation-delay: var(--loggy-t) !important; }</style>`
        );
        setSvg(out);
        continueRender(handle);
      });
  }, [pose]);
  return svg;
};

export const Loggy: React.FC<{
  pose: LoggyPose;
  height: number;
  style?: React.CSSProperties;
  delay?: number;
  /** Entrance: "pop" springs up from below, "none" is simply there. */
  enter?: 'pop' | 'none';
  flip?: boolean;
}> = ({ pose, height, style, delay = 0, enter = 'pop', flip = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const svg = useLoggySvg(pose);
  const s =
    enter === 'pop'
      ? spring({ frame: frame - delay, fps, config: { damping: 11, stiffness: 120, mass: 0.9 } })
      : 1;
  const t = Math.max(0, frame - delay) / fps;
  const y = interpolate(s, [0, 1], [height * 0.5, 0]);
  return (
    <div
      className={`lg-${pose}-root`}
      style={{
        position: 'absolute',
        height,
        aspectRatio: ASPECT[pose],
        opacity: Math.min(1, s * 1.6),
        transform: `translateY(${y}px) scale(${interpolate(s, [0, 1], [0.6, 1])}) scaleX(${flip ? -1 : 1})`,
        transformOrigin: '50% 100%',
        ['--loggy-t' as string]: `${-t}s`,
        ...style,
      }}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
};
