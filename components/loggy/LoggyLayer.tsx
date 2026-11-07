import type { ComponentType, ReactNode } from 'react';
import { Platform } from 'react-native';
import Animated, { type SharedValue, useAnimatedProps } from 'react-native-reanimated';
import type { GProps, SvgProps } from 'react-native-svg';
import { G } from 'react-native-svg';

import {
  type LoggyAnimation,
  type LoggyLayerAnimation,
  loggyMatrixToTransform,
  sampleLoggyLayer,
} from '@/utils/loggyAnimation';

/** Milliseconds into the pose's loop. One clock drives every layer of a pose. */
export type LoggyClock = SharedValue<number>;

export type LoggyAnimatedArtProps = SvgProps & { clock: LoggyClock };

/** What `scripts/generate-loggy-animated.js` writes per pose: the artwork and its motion. */
export type LoggyAnimatedPose = {
  Art: ComponentType<LoggyAnimatedArtProps>;
  animation: LoggyAnimation;
};

const AnimatedG = Animated.createAnimatedComponent(G);

const IS_WEB = Platform.OS === 'web';

type LoggyLayerProps = {
  clock: LoggyClock;
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
