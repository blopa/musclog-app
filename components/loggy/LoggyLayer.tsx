import type { ComponentType, ReactNode } from 'react';
import { Platform } from 'react-native';
import Animated, { type SharedValue, useAnimatedProps } from 'react-native-reanimated';
import type { GProps, SvgProps } from 'react-native-svg';
import { G } from 'react-native-svg';

import type { LoggyColors } from '@/components/loggy/useLoggyColors';
import {
  type LoggyAnimation,
  type LoggyLayerAnimation,
  loggyMatrixToTransform,
  sampleLoggyLayer,
} from '@/utils/loggyAnimation';

/** Milliseconds into the pose's loop. One clock drives every layer of a pose. */
export type LoggyClock = SharedValue<number>;

/**
 * What a generated pose draws from: the greens to paint him in, and the clock that moves him.
 * Without a clock every layer is a plain group, which is the drawn pose itself: a layer's keyframes
 * open and close on the identity frame, so there is nothing to sample.
 */
export type LoggyAnimatedArtProps = SvgProps & { clock?: LoggyClock; colors: LoggyColors };

/** What `scripts/generate-loggy-animated.js` writes per pose: the artwork and its motion. */
export type LoggyAnimatedPose = {
  Art: ComponentType<LoggyAnimatedArtProps>;
  animation: LoggyAnimation;
  /** The width and height of the drawing's `viewBox`, which give the pose its proportions. */
  size: readonly [width: number, height: number];
};

const AnimatedG = Animated.createAnimatedComponent(G);

const IS_WEB = Platform.OS === 'web';

type LoggyLayerProps = {
  /** Left out, the layer does not move: the pose is drawn as it stands. */
  clock?: LoggyClock;
  layer: LoggyLayerAnimation;
  children: ReactNode;
};

/**
 * One moving group of the drawing: it plays `layer`'s keyframes against `clock`.
 *
 * Native react-native-svg takes the transform as a `matrix`; its web build only knows the SVG
 * `transform` attribute, so the same matrix goes out as that string there.
 */
export function LoggyLayer({ clock, layer, children }: LoggyLayerProps) {
  // Two components rather than a condition around the hook inside `MovingLayer`: a still pays for
  // no animated props at all, and the hook order of each component never changes.
  if (!clock) {
    return <G>{children}</G>;
  }

  return (
    <MovingLayer clock={clock} layer={layer}>
      {children}
    </MovingLayer>
  );
}

function MovingLayer({ clock, layer, children }: LoggyLayerProps & { clock: LoggyClock }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const pose = sampleLoggyLayer(layer, clock.value);
    const transform = IS_WEB
      ? { transform: loggyMatrixToTransform(pose.matrix) }
      : { matrix: pose.matrix };

    const props = layer.animatesOpacity ? { ...transform, opacity: pose.opacity } : transform;

    // `matrix` is a real prop of the native group but is missing from react-native-svg's types.
    return props as unknown as Partial<GProps>;
  });

  return <AnimatedG animatedProps={animatedProps}>{children}</AnimatedG>;
}
