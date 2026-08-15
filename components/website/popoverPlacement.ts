const VIEWPORT_MARGIN = 16;
const TRIGGER_GAP = 12;

interface PopoverTopOptions {
  triggerRect: null | { bottom: number; top: number };
  popoverHeight: number;
  viewportHeight: number;
}

/**
 * Vertical placement for a popover anchored under a trigger, flipped above it
 * when the space below cannot hold it. Height is measured after the first
 * render, so `popoverHeight` is 0 on that pass and the popover simply opens
 * downward until the measurement lands.
 */
export function computePopoverTop({
  triggerRect,
  popoverHeight,
  viewportHeight,
}: PopoverTopOptions) {
  if (!triggerRect) {
    return 0;
  }

  const spaceBelow = viewportHeight - triggerRect.bottom - VIEWPORT_MARGIN;
  const shouldOpenUpward = popoverHeight > 0 && spaceBelow < popoverHeight + TRIGGER_GAP;

  return shouldOpenUpward
    ? Math.max(triggerRect.top - popoverHeight - TRIGGER_GAP, VIEWPORT_MARGIN)
    : triggerRect.bottom + TRIGGER_GAP;
}
