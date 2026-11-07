/**
 * Type and art sizes for a story poster, from the space it actually got. A poster has a fixed
 * height, so a small phone scales it down instead of cutting the mascot off or scrolling.
 */

/** The poster height the sizes below were drawn for. */
const DESIGN_HEIGHT = 600;
const MIN_SCALE = 0.72;
const MAX_SCALE = 1.2;

export function storyScale(posterHeight: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, posterHeight / DESIGN_HEIGHT));
}
