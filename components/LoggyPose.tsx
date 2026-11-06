import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import type { SvgProps } from 'react-native-svg';

import Celebrating from '@/assets/avatars/loggy-poses/loggy-celebrating.svg';
import Coffee from '@/assets/avatars/loggy-poses/loggy-coffee.svg';
import Default from '@/assets/avatars/loggy-poses/loggy-default.svg';
import Flex from '@/assets/avatars/loggy-poses/loggy-flex.svg';
import Magnify from '@/assets/avatars/loggy-poses/loggy-magnify.svg';
import Panic from '@/assets/avatars/loggy-poses/loggy-panic.svg';
import Running from '@/assets/avatars/loggy-poses/loggy-running.svg';
import Thinking from '@/assets/avatars/loggy-poses/loggy-thinking.svg';
import Wave from '@/assets/avatars/loggy-poses/loggy-wave.svg';
import Writing from '@/assets/avatars/loggy-poses/loggy-writing.svg';

export type LoggyPoseName =
  | 'celebrating'
  | 'coffee'
  | 'default'
  | 'flex'
  | 'magnify'
  | 'panic'
  | 'running'
  | 'thinking'
  | 'wave'
  | 'writing';

/**
 * Width over height of each pose: the `viewBox` of its SVG, since the canvases differ. Each SVG is
 * compiled to a component at build time by react-native-svg-transformer (`metro.config.js`).
 *
 * These are the static poses. The animated ones (`assets/avatars/loggy-animated/`) are not here on
 * purpose: they are raster layers moved by CSS `@keyframes`, which react-native-svg cannot run, so
 * they will be layers driven by Reanimated. When they arrive, add an `animated` prop to
 * `LoggyPose` that picks them, and leave this table as the still fallback (and for reduced motion).
 */
const POSES: Record<LoggyPoseName, { Art: ComponentType<SvgProps>; aspect: number }> = {
  celebrating: { Art: Celebrating, aspect: 0.875 },
  coffee: { Art: Coffee, aspect: 0.859 },
  default: { Art: Default, aspect: 0.8 },
  flex: { Art: Flex, aspect: 0.8 },
  magnify: { Art: Magnify, aspect: 0.844 },
  panic: { Art: Panic, aspect: 0.8 },
  running: { Art: Running, aspect: 0.875 },
  thinking: { Art: Thinking, aspect: 0.767 },
  wave: { Art: Wave, aspect: 0.875 },
  writing: { Art: Writing, aspect: 0.8 },
};

/**
 * The pose for a recoverable failure (a file that would not import, a screen that failed to load).
 * `panic` is an alarm and these are not emergencies: it stays on the year story's busiest month.
 * `thinking` is the calm stand-in until a puzzled or apologetic pose is drawn, and then this one
 * line is the only thing to change.
 */
export const LOGGY_FAILURE_POSE: LoggyPoseName = 'thinking';

type LoggyPoseProps = {
  animated?: boolean; // TODO: implement this
  pose: LoggyPoseName;
  height: number;
};

/**
 * On web react-native-svg forwards unknown props straight to the DOM `<svg>`, so the native
 * accessibility props trigger React's "non-boolean attribute" and "does not recognize the prop"
 * warnings there; `aria-hidden` is the web equivalent.
 */
const HIDDEN_FROM_ASSISTIVE_TECH: SvgProps =
  Platform.OS === 'web'
    ? { 'aria-hidden': true }
    : {
        accessible: false,
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      };

/** The mascot at a given height. Always decorative: the words around it carry the meaning. */
export function LoggyPose({ pose, height, animated = false }: LoggyPoseProps) {
  const { Art, aspect } = POSES[pose];

  return <Art {...HIDDEN_FROM_ASSISTIVE_TECH} height={height} width={height * aspect} />;
}
