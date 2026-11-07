/**
 * The bottom padding a scrolling body needs so its last row clears a footer that floats over it.
 * `FullScreenModal` draws its footer on top of the body, so the body has to leave that room itself:
 * a fixed amount sized for one row of buttons let a footer that wraps (stacked buttons at large
 * text or in a long translation) cover the last rows of the content.
 *
 * `minimum` is the room a one-row footer always had, so a footer that fits on one line leaves the
 * layout exactly as it was; a taller measured footer asks for its own height plus `gap`. Until the
 * footer has been measured (`0`) the minimum applies.
 */
export function footerClearance(footerHeight: number, minimum: number, gap: number): number {
  if (!Number.isFinite(footerHeight) || footerHeight <= 0) {
    return minimum;
  }

  return Math.max(minimum, footerHeight + gap);
}
