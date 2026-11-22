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

/**
 * The top of a `BottomButtonWrapper`: its padding above the buttons, which is a gradient that is
 * still see-through, so body content shows through it.
 */
export const BOTTOM_BUTTON_TOP_FADE = 24;

/**
 * Where a "more below" cue sits above a footer that floats over the scroller: its bottom edge goes
 * where the footer's gradient begins, so the cue's fade and the footer's fade meet instead of
 * leaving a strip of undimmed content (and the chevron floating away from the button) between them.
 */
export function scrollCueBottom(footerHeight: number): number {
  if (!Number.isFinite(footerHeight) || footerHeight <= 0) {
    return 0;
  }

  return Math.max(0, footerHeight - BOTTOM_BUTTON_TOP_FADE);
}
