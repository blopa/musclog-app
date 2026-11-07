/**
 * Below this many points of effective width a phone holds roughly three-quarters of the words a
 * screen was designed for. A 360pt phone at 1.3x text, or the same phone's web layout at 1.3x
 * (browser zoom narrows the viewport instead of scaling `fontScale`), both land under it; a
 * 344pt phone at default text does not.
 */
export const CRAMPED_EFFECTIVE_WIDTH = 300;

/**
 * Whether the window is cramped for its text: the width divided by the OS text scale, so the
 * answer is the same whether large text arrives as `fontScale` (native) or as a narrower layout
 * (web, and the layout audit's emulation). Decorative furniture beside a label (a leading icon
 * tile, a chevron, mood captions) gives its room to the text when this is true: the label says
 * what the decoration did, and the control keeps its accessibility label.
 */
export function isCrampedLayout(windowWidth: number, fontScale: number): boolean {
  return windowWidth / Math.max(1, fontScale) < CRAMPED_EFFECTIVE_WIDTH;
}
