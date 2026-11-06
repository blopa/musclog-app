/**
 * The motion of an animated Loggy, as data and as the arithmetic that plays it.
 *
 * Each `assets/avatars/loggy-animated/*.svg` moves its layers with CSS `@keyframes`, which
 * react-native-svg cannot run. `scripts/generate-loggy-animated.js` reads those keyframes once and
 * writes them as a `LoggyAnimation` beside the artwork; this module is the other half: given a
 * layer and the time, it answers where the layer is, the way a browser would. Reanimated feeds it a
 * clock and puts the answer on an SVG group (`components/loggy/LoggyLayer.tsx`).
 *
 * Pure and worklet-safe (no React Native imports), so Jest can hold it to the CSS semantics.
 */

/** The CSS timing keywords the keyframes use, as cubic-bezier control points. */
export const LOGGY_EASING_CURVES = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
} as const;

export type LoggyEasing = keyof typeof LOGGY_EASING_CURVES;

/**
 * The CSS transform functions the keyframes use, folded to one name each: `translateY(3px)` is
 * `translate` with `[0, 3]`, `scaleY(.07)` is `scale` with `[1, .07]`. Rotations and skews are
 * degrees.
 */
export type LoggyTransformFn = 'translate' | 'rotate' | 'scale' | 'skewX';

export type LoggyKeyframe = {
  /** Position in the loop, 0 to 1 (CSS `0%` to `100%`). */
  at: number;
  /** One argument list per entry of the layer's `fns`, in the same order. */
  args: number[][];
  opacity?: number;
};

export type LoggyLayerAnimation = {
  /** CSS `transform-origin`, in the SVG's own units. */
  origin: [number, number];
  /** One loop of this layer; the pose's loop is a whole number of these. */
  durationMs: number;
  easing: LoggyEasing;
  /** The transform functions, applied left to right as in CSS. Every keyframe has all of them. */
  fns: LoggyTransformFn[];
  /** Sorted by `at`, opening at 0 and closing at 1. */
  frames: LoggyKeyframe[];
  /** Whether the keyframes move `opacity` as well (then every frame carries it). */
  animatesOpacity: boolean;
};

export type LoggyAnimation = {
  /** The longest layer loop. Every layer's duration divides it, so one clock drives them all. */
  loopMs: number;
  layers: Record<string, LoggyLayerAnimation>;
};

/** A 2D affine matrix in SVG's order: `matrix(a b c d e f)`. */
export type LoggyMatrix = [number, number, number, number, number, number];

export type LoggyLayerPose = {
  matrix: LoggyMatrix;
  opacity: number;
};

/** CSS cubic-bezier easing: the eased progress for `x` along the curve. */
function cubicBezier(curve: readonly number[], x: number): number {
  'worklet';
  const [x1, y1, x2, y2] = curve;

  if (x <= 0) {
    return 0;
  }

  if (x >= 1) {
    return 1;
  }

  // Solve bezierX(t) = x by bisection, then read bezierY at that t.
  let low = 0;
  let high = 1;
  let t = x;

  for (let i = 0; i < 24; i += 1) {
    const u = 1 - t;
    const bx = 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;

    if (bx < x) {
      low = t;
    } else {
      high = t;
    }

    t = (low + high) / 2;
  }

  const u = 1 - t;

  return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
}

function multiply(m: LoggyMatrix, n: LoggyMatrix): LoggyMatrix {
  'worklet';

  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function functionMatrix(fn: LoggyTransformFn, args: readonly number[]): LoggyMatrix {
  'worklet';

  if (fn === 'translate') {
    return [1, 0, 0, 1, args[0], args[1]];
  }

  if (fn === 'scale') {
    return [args[0], 0, 0, args[1], 0, 0];
  }

  const radians = (args[0] * Math.PI) / 180;

  if (fn === 'rotate') {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return [cos, sin, -sin, cos, 0, 0];
  }

  return [1, 0, Math.tan(radians), 1, 0, 0];
}

/**
 * Where a layer is at `timeMs` into the loop: the transform list interpolated between the two
 * surrounding keyframes (each interval eased by the layer's timing function, as CSS does), then
 * wrapped in the layer's `transform-origin`.
 */
export function sampleLoggyLayer(layer: LoggyLayerAnimation, timeMs: number): LoggyLayerPose {
  'worklet';
  const { frames, fns, origin } = layer;
  const phase =
    (((timeMs % layer.durationMs) + layer.durationMs) % layer.durationMs) / layer.durationMs;

  let index = 0;

  while (index < frames.length - 2 && frames[index + 1].at <= phase) {
    index += 1;
  }

  const from = frames[index];
  const to = frames[index + 1];
  const span = to.at - from.at;
  const raw = span > 0 ? Math.min(1, Math.max(0, (phase - from.at) / span)) : 1;
  const progress = cubicBezier(LOGGY_EASING_CURVES[layer.easing], raw);

  let matrix: LoggyMatrix = [1, 0, 0, 1, origin[0], origin[1]];

  for (let i = 0; i < fns.length; i += 1) {
    const start = from.args[i];
    const end = to.args[i];
    const args: number[] = [];

    for (let j = 0; j < start.length; j += 1) {
      args.push(start[j] + (end[j] - start[j]) * progress);
    }

    matrix = multiply(matrix, functionMatrix(fns[i], args));
  }

  matrix = multiply(matrix, [1, 0, 0, 1, -origin[0], -origin[1]]);

  const opacityFrom = from.opacity ?? 1;
  const opacityTo = to.opacity ?? 1;

  return { matrix, opacity: opacityFrom + (opacityTo - opacityFrom) * progress };
}

/** `matrix` as the SVG `transform` attribute, for the web, where react-native-svg has no `matrix` prop. */
export function loggyMatrixToTransform(matrix: LoggyMatrix): string {
  'worklet';

  return `matrix(${matrix[0]} ${matrix[1]} ${matrix[2]} ${matrix[3]} ${matrix[4]} ${matrix[5]})`;
}
