import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';

import Celebrating from '@/assets/avatars/loggy-poses/loggy-celebrating.svg';
import Coffee from '@/assets/avatars/loggy-poses/loggy-coffee.svg';
import Creatine from '@/assets/avatars/loggy-poses/loggy-creatine.svg';
import Default from '@/assets/avatars/loggy-poses/loggy-default.svg';
import Drinking from '@/assets/avatars/loggy-poses/loggy-drinking.svg';
import Eating from '@/assets/avatars/loggy-poses/loggy-eating.svg';
import Flex from '@/assets/avatars/loggy-poses/loggy-flex.svg';
import Lifting from '@/assets/avatars/loggy-poses/loggy-lifting.svg';
import Magnify from '@/assets/avatars/loggy-poses/loggy-magnify.svg';
import Nutrition from '@/assets/avatars/loggy-poses/loggy-nutrition.svg';
import Panic from '@/assets/avatars/loggy-poses/loggy-panic.svg';
import Pointing from '@/assets/avatars/loggy-poses/loggy-pointing.svg';
import Reading from '@/assets/avatars/loggy-poses/loggy-reading.svg';
import Running from '@/assets/avatars/loggy-poses/loggy-running.svg';
import Salad from '@/assets/avatars/loggy-poses/loggy-salad.svg';
import Shrug from '@/assets/avatars/loggy-poses/loggy-shrug.svg';
import Thinking from '@/assets/avatars/loggy-poses/loggy-thinking.svg';
import Trophy from '@/assets/avatars/loggy-poses/loggy-trophy.svg';
import Wave from '@/assets/avatars/loggy-poses/loggy-wave.svg';
import Writing from '@/assets/avatars/loggy-poses/loggy-writing.svg';
import { LoggyCelebratingAnimated } from '@/components/loggy/animated/LoggyCelebratingAnimated';
import { LoggyCoffeeAnimated } from '@/components/loggy/animated/LoggyCoffeeAnimated';
import { LoggyCreatineAnimated } from '@/components/loggy/animated/LoggyCreatineAnimated';
import { LoggyDefaultAnimated } from '@/components/loggy/animated/LoggyDefaultAnimated';
import { LoggyDrinkingAnimated } from '@/components/loggy/animated/LoggyDrinkingAnimated';
import { LoggyEatingAnimated } from '@/components/loggy/animated/LoggyEatingAnimated';
import { LoggyFlexAnimated } from '@/components/loggy/animated/LoggyFlexAnimated';
import { LoggyLiftingAnimated } from '@/components/loggy/animated/LoggyLiftingAnimated';
import { LoggyMagnifyAnimated } from '@/components/loggy/animated/LoggyMagnifyAnimated';
import { LoggyNutritionAnimated } from '@/components/loggy/animated/LoggyNutritionAnimated';
import { LoggyPanicAnimated } from '@/components/loggy/animated/LoggyPanicAnimated';
import { LoggyPointingAnimated } from '@/components/loggy/animated/LoggyPointingAnimated';
import { LoggyReadingAnimated } from '@/components/loggy/animated/LoggyReadingAnimated';
import { LoggyRunningAnimated } from '@/components/loggy/animated/LoggyRunningAnimated';
import { LoggySaladAnimated } from '@/components/loggy/animated/LoggySaladAnimated';
import { LoggyShrugAnimated } from '@/components/loggy/animated/LoggyShrugAnimated';
import { LoggyThinkingAnimated } from '@/components/loggy/animated/LoggyThinkingAnimated';
import { LoggyTrophyAnimated } from '@/components/loggy/animated/LoggyTrophyAnimated';
import { LoggyWaveAnimated } from '@/components/loggy/animated/LoggyWaveAnimated';
import { LoggyWritingAnimated } from '@/components/loggy/animated/LoggyWritingAnimated';
import type { LoggyAnimatedPose } from '@/components/loggy/LoggyLayer';
import { useLoggyClock } from '@/components/loggy/useLoggyClock';
import { useSettings } from '@/hooks/useSettings';

export type LoggyPoseName =
  | 'celebrating'
  | 'coffee'
  | 'creatine'
  | 'default'
  | 'drinking'
  | 'eating'
  | 'flex'
  | 'lifting'
  | 'magnify'
  | 'nutrition'
  | 'panic'
  | 'pointing'
  | 'reading'
  | 'running'
  | 'salad'
  | 'shrug'
  | 'thinking'
  | 'trophy'
  | 'wave'
  | 'writing';

/**
 * Width over height of each pose: the `viewBox` of its SVG, since the canvases differ. Each SVG is
 * compiled to a component at build time by react-native-svg-transformer (`metro.config.js`). The
 * SVGs are generated, not drawn here: edit a part in `assets/avatars/loggy-parts` and run
 * `npm run generate-loggy`.
 *
 * These are the static poses, and the fallback for `animated` under reduced motion. The animated
 * ones (`assets/avatars/loggy-animated/`) are layers moved by CSS `@keyframes`, which
 * react-native-svg cannot run, so they are not imported here: `ANIMATED_POSES` holds components
 * generated from them, with the layers driven by Reanimated.
 */
const POSES: Record<LoggyPoseName, { Art: ComponentType<SvgProps>; aspect: number }> = {
  celebrating: { Art: Celebrating, aspect: 0.875 },
  coffee: { Art: Coffee, aspect: 0.859 },
  creatine: { Art: Creatine, aspect: 0.8 },
  default: { Art: Default, aspect: 0.8 },
  drinking: { Art: Drinking, aspect: 0.844 },
  eating: { Art: Eating, aspect: 0.8 },
  flex: { Art: Flex, aspect: 0.8 },
  lifting: { Art: Lifting, aspect: 1 },
  magnify: { Art: Magnify, aspect: 0.844 },
  nutrition: { Art: Nutrition, aspect: 1 },
  panic: { Art: Panic, aspect: 0.8 },
  pointing: { Art: Pointing, aspect: 1 },
  reading: { Art: Reading, aspect: 0.8 },
  running: { Art: Running, aspect: 0.875 },
  salad: { Art: Salad, aspect: 0.8 },
  shrug: { Art: Shrug, aspect: 0.875 },
  thinking: { Art: Thinking, aspect: 0.767 },
  trophy: { Art: Trophy, aspect: 0.875 },
  wave: { Art: Wave, aspect: 0.875 },
  writing: { Art: Writing, aspect: 0.8 },
};

/**
 * The animated twin of each pose, generated by `npm run generate-loggy` (the drawing is the
 * still's, path for path: both are built from the parts in `assets/avatars/loggy-parts`). Its
 * aspect is the still's: `loggyPose.test.ts` holds them equal.
 */
const ANIMATED_POSES: Record<LoggyPoseName, LoggyAnimatedPose> = {
  celebrating: LoggyCelebratingAnimated,
  coffee: LoggyCoffeeAnimated,
  creatine: LoggyCreatineAnimated,
  default: LoggyDefaultAnimated,
  drinking: LoggyDrinkingAnimated,
  eating: LoggyEatingAnimated,
  flex: LoggyFlexAnimated,
  lifting: LoggyLiftingAnimated,
  magnify: LoggyMagnifyAnimated,
  nutrition: LoggyNutritionAnimated,
  panic: LoggyPanicAnimated,
  pointing: LoggyPointingAnimated,
  reading: LoggyReadingAnimated,
  running: LoggyRunningAnimated,
  salad: LoggySaladAnimated,
  shrug: LoggyShrugAnimated,
  thinking: LoggyThinkingAnimated,
  trophy: LoggyTrophyAnimated,
  wave: LoggyWaveAnimated,
  writing: LoggyWritingAnimated,
};

/**
 * The pose for a recoverable failure (a file that would not import, a screen that failed to load).
 * `panic` is an alarm and these are not emergencies: it stays on the year story's busiest month.
 * `shrug` (the question mark over his head) is the puzzled pose: it says "that did not work out",
 * not "something is on fire".
 */
export const LOGGY_FAILURE_POSE: LoggyPoseName = 'shrug';

type LoggyPoseProps = {
  /**
   * Loops the pose's idle motion. Left out, it follows the "Animated Loggy" setting (on by
   * default); `true`/`false` force it either way (the test screen, the share image). Either way the
   * still is drawn when the system asks for reduced motion.
   */
  animated?: boolean;
  /**
   * Whether he is drawn at all. Left out, it follows the "Show Loggy" setting (on by default);
   * only the `/app/test/loggy` comparison forces it.
   */
  visible?: boolean;
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

function AnimatedLoggy({
  pose,
  height,
  width,
}: {
  pose: LoggyPoseName;
  height: number;
  width: number;
}) {
  const { Art, animation } = ANIMATED_POSES[pose];
  const clock = useLoggyClock(animation.loopMs);

  return <Art {...HIDDEN_FROM_ASSISTIVE_TECH} clock={clock} height={height} width={width} />;
}

/**
 * Whether the person wants Loggy on screen (the "Show Loggy" setting). `LoggyPose` and
 * `LoggyCameo` already render nothing when it is off; a caller reads this only when the wrapper
 * around him would otherwise leave a gap (a margin, a positioned box) or stand in for something
 * else (`EmptyStateCard` draws its icon instead).
 */
export function useLoggyVisible(): boolean {
  return useSettings().showLoggy;
}

/** The mascot at a given height. Always decorative: the words around it carry the meaning. */
export function LoggyPose({ pose, height, animated, visible }: LoggyPoseProps) {
  const reduceMotion = useReducedMotion();
  const { animatedLoggy, showLoggy } = useSettings();
  const shouldAnimate = animated ?? animatedLoggy;
  const { Art, aspect } = POSES[pose];
  const width = height * aspect;

  if (!(visible ?? showLoggy)) {
    return null;
  }

  if (shouldAnimate && !reduceMotion) {
    return <AnimatedLoggy pose={pose} height={height} width={width} />;
  }

  return <Art {...HIDDEN_FROM_ASSISTIVE_TECH} height={height} width={width} />;
}
