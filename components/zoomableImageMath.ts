/**
 * The geometry of pinch-zoom, pan and double-tap-zoom, kept out of the gesture code so it runs in
 * the Jest `node` project. All coordinates are relative to the CENTER of the viewport (the image is
 * laid out centered), so "the point under the finger" has the same meaning at every scale.
 */
export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const DOUBLE_TAP_SCALE = 2.5;
/** Below this a zoom is considered "at rest" (1×), so a pinch that ends a hair above 1 snaps back. */
const REST_EPSILON = 0.02;

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export function clampScale(scale: number): number {
  'worklet';
  if (!Number.isFinite(scale)) {
    return MIN_SCALE;
  }
  return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/** True when the image is (close enough to) fitted: panning is locked and swipe-down may close. */
export function isAtRest(scale: number): boolean {
  'worklet';
  return scale <= MIN_SCALE + REST_EPSILON;
}

/**
 * How far the image may be dragged from center at `scale`. The scaled content may only be dragged
 * until its edge meets the viewport edge, never past it, and not at all along an axis where it is
 * still smaller than the viewport.
 */
export function maxTranslation(scale: number, viewport: Size, content: Size): Point {
  'worklet';
  return {
    x: Math.max(0, (content.width * scale - viewport.width) / 2),
    y: Math.max(0, (content.height * scale - viewport.height) / 2),
  };
}

export function clampTranslation(
  translation: Point,
  scale: number,
  viewport: Size,
  content: Size
): Point {
  'worklet';
  const max = maxTranslation(scale, viewport, content);
  return {
    x: clamp(translation.x, -max.x, max.x),
    y: clamp(translation.y, -max.y, max.y),
  };
}

/**
 * Zooms to `nextScale` while keeping the image point under `focal` where it is on screen, which is
 * what makes a pinch or a double-tap feel anchored to the fingers rather than to the center.
 * Derivation: the image point under the focal at scale s with translation t is (focal - t) / s;
 * holding it fixed at scale s' gives t' = focal - (focal - t) * s' / s.
 */
export function zoomAroundPoint(
  current: { scale: number; translation: Point },
  nextScale: number,
  focal: Point,
  viewport: Size,
  content: Size
): { scale: number; translation: Point } {
  'worklet';
  const scale = clampScale(nextScale);
  const ratio = scale / current.scale;
  const translation = clampTranslation(
    {
      x: focal.x - (focal.x - current.translation.x) * ratio,
      y: focal.y - (focal.y - current.translation.y) * ratio,
    },
    scale,
    viewport,
    content
  );
  return { scale, translation };
}

/** A double-tap zooms in to `DOUBLE_TAP_SCALE`, or back out to fitted when already zoomed. */
export function doubleTapTargetScale(currentScale: number): number {
  'worklet';
  return isAtRest(currentScale) ? DOUBLE_TAP_SCALE : MIN_SCALE;
}

/** The size an image occupies when fitted ("contain") inside the viewport. */
export function fitContain(image: Size, viewport: Size): Size {
  'worklet';
  if (!(image.width > 0) || !(image.height > 0)) {
    return viewport;
  }
  const ratio = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { width: image.width * ratio, height: image.height * ratio };
}

/** A downward swipe past this many pixels at rest closes the viewer. */
export const DISMISS_DISTANCE = 120;

export function shouldDismissOnSwipe(translationY: number, scale: number): boolean {
  'worklet';
  return isAtRest(scale) && translationY > DISMISS_DISTANCE;
}
