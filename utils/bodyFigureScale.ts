/** One body figure is drawn `BODY_FIGURE_WIDTH * scale` wide by the body highlighter libraries. */
export const BODY_FIGURE_WIDTH = 200;

/** The smallest scale worth drawing; below it the muscles are too small to tell apart. */
const MIN_BODY_SCALE = 0.4;

/**
 * The scale at which the front and back figures, side by side with `gap` between them, fit
 * `containerWidth`. The figures are 200 wide each, so at the libraries' default scale a phone
 * shows only part of the pair (the view shrank them to 140 and cut them off). Before the width is
 * known (`null`) the requested scale stands; it is never raised above what was asked for.
 */
export function bodyFigureScale(
  containerWidth: number | null,
  requestedScale: number,
  gap: number
): number {
  if (containerWidth === null || containerWidth <= 0) {
    return requestedScale;
  }

  const fitting = (containerWidth - gap) / (2 * BODY_FIGURE_WIDTH);

  return Math.max(MIN_BODY_SCALE, Math.min(requestedScale, Math.floor(fitting * 100) / 100));
}
