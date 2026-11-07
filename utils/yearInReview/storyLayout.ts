/**
 * Type and art sizes for a story poster, from the space it actually got. A poster has a fixed
 * height, so a small phone scales it down instead of cutting the mascot off or scrolling.
 */

/** The poster height the sizes below were drawn for. */
const DESIGN_HEIGHT = 600;
const MIN_SCALE = 0.72;
const MAX_SCALE = 1.2;

/** A digit or letter of bold system type is about this wide, as a share of its font size. */
const GLYPH_WIDTH_RATIO = 0.62;

export function storyScale(posterHeight: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, posterHeight / DESIGN_HEIGHT));
}

/**
 * The largest size at which `text` fits one line of `availableWidth`, capped at `maxSize`. Worked
 * out rather than left to `adjustsFontSizeToFit`, which react-native-web ignores, so a large
 * "1,204,332" fits on every platform.
 */
export function fitFontSize(
  text: string,
  availableWidth: number,
  maxSize: number,
  glyphWidthRatio: number = GLYPH_WIDTH_RATIO
): number {
  const widest = text.length * glyphWidthRatio;
  return widest > 0 ? Math.min(maxSize, Math.floor(availableWidth / widest)) : maxSize;
}
