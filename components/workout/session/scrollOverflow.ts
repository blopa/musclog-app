/** Pixels of slack before content counts as hidden, so sub-pixel layout rounding never shows a fade. */
const OVERFLOW_SLACK = 2;

/**
 * Whether a horizontal scroller still hides content past its right edge — the condition for the
 * edge fade that tells the user the row scrolls. Pure, so it is testable without a layout pass.
 */
export function hidesContentToTheRight(
  viewportWidth: number,
  contentWidth: number,
  offsetX: number
): boolean {
  return viewportWidth > 0 && contentWidth - offsetX - viewportWidth > OVERFLOW_SLACK;
}
