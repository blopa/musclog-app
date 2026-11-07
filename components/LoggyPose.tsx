import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';

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
import {
  type LoggyAppearance,
  type LoggyColors,
  useLoggyColors,
} from '@/components/loggy/useLoggyColors';
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
 * Each pose's generated component and its width over height: the `viewBox` of its SVG, since the
 * canvases differ. The components are generated, not drawn here: edit a part in
 * `assets/avatars/loggy-parts` and run `npm run generate-loggy` (the same run writes the SVGs in
 * `assets/avatars/loggy-poses`, which `loggyPose.test.ts` holds these aspects equal to).
 *
 * One component serves both ways of drawing him. Given a clock it moves its layers by their CSS
 * `@keyframes`, which react-native-svg cannot run itself, so Reanimated drives them
 * (`components/loggy/LoggyLayer.tsx`); given none every layer is a plain group, and a layer's
 * keyframes open and close on the identity frame, so that is exactly the drawn pose. That still is
 * what he is drawn as under reduced motion or with "Animated Loggy" off.
 */
const POSES: Record<LoggyPoseName, { pose: LoggyAnimatedPose; aspect: number }> = {
  celebrating: { pose: LoggyCelebratingAnimated, aspect: 0.875 },
  coffee: { pose: LoggyCoffeeAnimated, aspect: 0.859 },
  creatine: { pose: LoggyCreatineAnimated, aspect: 0.8 },
  default: { pose: LoggyDefaultAnimated, aspect: 0.8 },
  drinking: { pose: LoggyDrinkingAnimated, aspect: 0.844 },
  eating: { pose: LoggyEatingAnimated, aspect: 0.8 },
  flex: { pose: LoggyFlexAnimated, aspect: 0.8 },
  lifting: { pose: LoggyLiftingAnimated, aspect: 1 },
  magnify: { pose: LoggyMagnifyAnimated, aspect: 0.844 },
  nutrition: { pose: LoggyNutritionAnimated, aspect: 1 },
  panic: { pose: LoggyPanicAnimated, aspect: 0.8 },
  pointing: { pose: LoggyPointingAnimated, aspect: 1 },
  reading: { pose: LoggyReadingAnimated, aspect: 0.8 },
  running: { pose: LoggyRunningAnimated, aspect: 0.875 },
  salad: { pose: LoggySaladAnimated, aspect: 0.8 },
  shrug: { pose: LoggyShrugAnimated, aspect: 0.875 },
  thinking: { pose: LoggyThinkingAnimated, aspect: 0.767 },
  trophy: { pose: LoggyTrophyAnimated, aspect: 0.875 },
  wave: { pose: LoggyWaveAnimated, aspect: 0.875 },
  writing: { pose: LoggyWritingAnimated, aspect: 0.8 },
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
  /**
   * The greens he is drawn in. Left out he follows the active theme; `classic` pins the green he
   * was drawn in, for a surface that takes its colours from him instead of from the theme (the
   * Year in Musclog posters).
   */
  appearance?: LoggyAppearance;
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
  colors,
  pose,
  height,
  width,
}: {
  colors: LoggyColors;
  pose: LoggyPoseName;
  height: number;
  width: number;
}) {
  const { Art, animation } = POSES[pose].pose;
  const clock = useLoggyClock(animation.loopMs);

  return (
    <Art
      {...HIDDEN_FROM_ASSISTIVE_TECH}
      clock={clock}
      colors={colors}
      height={height}
      width={width}
    />
  );
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
export function LoggyPose({ pose, height, animated, visible, appearance }: LoggyPoseProps) {
  const reduceMotion = useReducedMotion();
  const { animatedLoggy, showLoggy } = useSettings();
  const colors = useLoggyColors(appearance);
  const shouldAnimate = animated ?? animatedLoggy;
  const { pose: art, aspect } = POSES[pose];
  const width = height * aspect;

  if (!(visible ?? showLoggy)) {
    return null;
  }

  if (shouldAnimate && !reduceMotion) {
    return <AnimatedLoggy colors={colors} pose={pose} height={height} width={width} />;
  }

  return <art.Art {...HIDDEN_FROM_ASSISTIVE_TECH} colors={colors} height={height} width={width} />;
}
